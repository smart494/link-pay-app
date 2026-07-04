import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/format";
import { Search, Loader2, CheckCircle2, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  to: z.string().optional(),
  amount: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/send")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Send Money — PayLink" }] }),
  component: SendPage,
});

type Profile = { id: string; full_name: string; paylink_id: string; avatar_url: string | null };

type Step = "recipient" | "amount" | "confirm" | "success";

function SendPage() {
  const initialSearch = useSearch({ from: "/_authenticated/send" });
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("recipient");
  const [query, setQuery] = useState(initialSearch.to ?? "");
  const [results, setResults] = useState<Profile[]>([]);
  const [recentRecipients, setRecentRecipients] = useState<Profile[]>([]);
  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [amount, setAmount] = useState(initialSearch.amount ?? "");
  const [note, setNote] = useState("");
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [w, rec] = await Promise.all([
        supabase.from("wallets").select("balance, currency").eq("user_id", u.user.id).maybeSingle(),
        supabase
          .from("transactions")
          .select("recipient_id, recipient:profiles!transactions_recipient_id_fkey(id, full_name, paylink_id, avatar_url)")
          .eq("sender_id", u.user.id)
          .not("recipient_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (w.data) {
        setBalance(Number(w.data.balance));
        setCurrency(w.data.currency);
      }
      if (rec.data) {
        const seen = new Set<string>();
        const dedup: Profile[] = [];
        for (const r of rec.data as unknown as { recipient: Profile | null }[]) {
          if (r.recipient && !seen.has(r.recipient.id)) {
            seen.add(r.recipient.id);
            dedup.push(r.recipient);
          }
        }
        setRecentRecipients(dedup.slice(0, 5));
      }
    })();
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const q = query.replace(/^@/, "").toLowerCase();
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, paylink_id, avatar_url")
        .ilike("paylink_id", `%${q}%`)
        .limit(10);
      setResults((data as Profile[]) ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function confirmSend() {
    if (!recipient) return;
    const n = parseFloat(amount);
    setLoading(true);
    const { error } = await supabase.rpc("send_money", {
      recipient_handle: recipient.paylink_id,
      transfer_amount: n,
      transfer_note: note || "",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep("success");
  }

  if (step === "success") {
    return (
      <div className="mx-auto max-w-md">
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold">Money sent!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You sent {formatCurrency(parseFloat(amount), currency)} to {recipient?.full_name}.
          </p>
          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => navigate({ to: "/dashboard" })}>
              Done
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStep("recipient");
                setRecipient(null);
                setAmount("");
                setNote("");
                setQuery("");
              }}
            >
              Send again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {step !== "recipient" && (
        <button
          onClick={() => setStep(step === "confirm" ? "amount" : "recipient")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      {step === "recipient" && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Who are you sending to?</h2>
          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by @paylink id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <ul className="mt-4 space-y-1">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-accent"
                    onClick={() => {
                      setRecipient(r);
                      setStep("amount");
                    }}
                  >
                    <Avatar className="h-10 w-10">
                      {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                      <AvatarFallback>{r.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">@{r.paylink_id}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {recentRecipients.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
              <ul className="mt-3 space-y-1">
                {recentRecipients.map((r) => (
                  <li key={r.id}>
                    <button
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-accent"
                      onClick={() => {
                        setRecipient(r);
                        setStep("amount");
                      }}
                    >
                      <Avatar className="h-10 w-10">
                        {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                        <AvatarFallback>{r.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{r.full_name}</p>
                        <p className="text-xs text-muted-foreground">@{r.paylink_id}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {step === "amount" && recipient && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {recipient.avatar_url && <AvatarImage src={recipient.avatar_url} />}
              <AvatarFallback>{recipient.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">To {recipient.full_name}</p>
              <p className="text-xs text-muted-foreground">@{recipient.paylink_id}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-2xl h-14 tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Available balance: {formatCurrency(balance, currency)}
              </p>
              {amount && parseFloat(amount) > balance && (
                <p className="text-xs text-destructive">Insufficient balance.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={140} placeholder="What's it for?" />
            </div>
            <Button
              className="w-full"
              disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
              onClick={() => setStep("confirm")}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === "confirm" && recipient && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Confirm transfer</h2>
          <div className="mt-6 space-y-4 rounded-xl bg-muted p-4">
            <Row label="To" value={`${recipient.full_name} (@${recipient.paylink_id})`} />
            <Row label="Amount" value={formatCurrency(parseFloat(amount), currency)} strong />
            {note && <Row label="Note" value={note} />}
          </div>
          <Button className="mt-6 w-full" onClick={confirmSend} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Send now</>}
          </Button>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-lg font-bold tabular-nums" : "font-medium"}>{value}</span>
    </div>
  );
}
