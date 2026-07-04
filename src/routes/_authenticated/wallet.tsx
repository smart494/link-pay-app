import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { CreditCard, Landmark, Plus, Trash2, Loader2, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — PayLink" }] }),
  component: WalletPage,
});

type LinkedAccount = {
  id: string;
  account_name: string;
  account_type: "bank" | "card";
  masked_number: string;
  is_primary: boolean;
};

function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [w, a] = await Promise.all([
      supabase.from("wallets").select("balance, currency").eq("user_id", u.user.id).maybeSingle(),
      supabase.from("linked_accounts").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }),
    ]);
    if (w.data) {
      setBalance(Number(w.data.balance));
      setCurrency(w.data.currency);
    }
    if (a.data) setAccounts(a.data as LinkedAccount[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-primary p-6 text-primary-foreground shadow-hero md:p-8">
        <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Total balance</p>
        <p className="mt-2 text-4xl font-bold tabular-nums md:text-5xl">{formatCurrency(balance, currency)}</p>
        <div className="mt-4 flex gap-2">
          <TopUpDialog onDone={refresh} />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Linked accounts</h3>
            <p className="text-xs text-muted-foreground">Bank accounts and cards linked to your wallet</p>
          </div>
          <AddAccountDialog onDone={refresh} />
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted">
                <WalletIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No linked bank account</p>
              <p className="text-xs text-muted-foreground">Add one to fund and withdraw from your wallet.</p>
              <div className="mt-4">
                <AddAccountDialog onDone={refresh} />
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    {a.account_type === "card" ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.account_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.account_type === "card" ? "Card" : "Bank"} · •••• {a.masked_number}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from("linked_accounts").delete().eq("id", a.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Account removed");
                        refresh();
                      }
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {/* Integration note */}
          Linked accounts are simulated for demo. To connect real bank accounts, integrate Plaid here. Card funding &amp; payouts can use Stripe.
        </p>
      </Card>
    </div>
  );
}

function TopUpDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a positive amount.");
    setLoading(true);
    const { error } = await supabase.rpc("top_up", { top_amount: n });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Balance updated.");
    setOpen(false);
    setAmount("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
          <Plus className="mr-2 inline h-4 w-4" /> Add money
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add money to your wallet</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Simulated. Integrate Stripe or Plaid to fund from a real card or bank.
        </p>
        <div className="space-y-2">
          <Label htmlFor="amt">Amount</Label>
          <Input id="amt" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add funds"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAccountDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"bank" | "card">("bank");
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Enter an account name.");
    if (!/^\d{4}$/.test(last4)) return toast.error("Enter the last 4 digits.");
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("linked_accounts").insert({
      user_id: u.user.id,
      account_name: name.trim(),
      account_type: type,
      masked_number: last4,
      is_primary: false,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account linked.");
    setOpen(false);
    setName("");
    setLast4("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Link account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a new account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "bank" | "card")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank account</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-name">Account name</Label>
            <Input id="acct-name" placeholder="Chase checking" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last4">Last 4 digits</Label>
            <Input id="last4" placeholder="1234" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
