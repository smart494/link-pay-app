import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowUpRight, ArrowDownLeft, Clock, Send, QrCode, Plus, Loader2 } from "lucide-react";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PayLink" }] }),
  component: DashboardPage,
});

type Tx = {
  id: string;
  amount: number;
  type: "transfer" | "top_up" | "withdrawal";
  status: string;
  note: string | null;
  created_at: string;
  sender_id: string | null;
  recipient_id: string | null;
  sender: { full_name: string; paylink_id: string } | null;
  recipient: { full_name: string; paylink_id: string } | null;
};

function DashboardPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");
  const [showBalance, setShowBalance] = useState(true);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);

    const [wallet, txResult] = await Promise.all([
      supabase.from("wallets").select("balance, currency").eq("user_id", u.user.id).maybeSingle(),
      supabase
        .from("transactions")
        .select("id, amount, type, status, note, created_at, sender_id, recipient_id, sender:profiles!transactions_sender_id_fkey(full_name, paylink_id), recipient:profiles!transactions_recipient_id_fkey(full_name, paylink_id)")
        .or(`sender_id.eq.${u.user.id},recipient_id.eq.${u.user.id}`)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (wallet.data) {
      setBalance(Number(wallet.data.balance));
      setCurrency(wallet.data.currency);
    }
    if (txResult.data) setTxs(txResult.data as unknown as Tx[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = txs.filter((t) => new Date(t.created_at) >= monthStart);
  const inSum = thisMonth
    .filter((t) => t.recipient_id === uid && t.status === "completed")
    .reduce((a, t) => a + Number(t.amount), 0);
  const outSum = thisMonth
    .filter((t) => t.sender_id === uid && t.status === "completed")
    .reduce((a, t) => a + Number(t.amount), 0);
  const pending = txs.filter((t) => t.status === "pending");
  const pendingSum = pending.reduce((a, t) => a + Number(t.amount), 0);

  // Build balance history: walk backwards from current balance through txs
  const chartData = buildChart(txs, balance, uid ?? "");

  const recent = txs.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Balance hero */}
      <Card className="border-0 bg-primary p-6 text-primary-foreground shadow-hero md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">
              Available balance
            </p>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-4xl font-bold tabular-nums md:text-5xl">
                {showBalance ? formatCurrency(balance, currency) : "•••••"}
              </p>
              <button
                onClick={() => setShowBalance((v) => !v)}
                className="rounded-lg p-2 hover:bg-white/10"
                aria-label="Toggle balance visibility"
              >
                {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            <Link to="/send" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
              <Send className="mr-2 inline h-4 w-4" /> Send
            </Link>
            <Link to="/receive" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
              <QrCode className="mr-2 inline h-4 w-4" /> Receive
            </Link>
            <TopUpDialog onDone={refresh} />
          </div>
        </div>
        <div className="mt-4 flex gap-2 md:hidden">
          <Link to="/send" className="flex-1 rounded-xl bg-white/15 px-3 py-2 text-center text-sm font-semibold">
            Send
          </Link>
          <Link to="/receive" className="flex-1 rounded-xl bg-white/15 px-3 py-2 text-center text-sm font-semibold">
            Receive
          </Link>
          <TopUpDialog onDone={refresh} compact />
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<ArrowDownLeft className="h-4 w-4" />} label="Money in this month" value={formatCurrency(inSum, currency)} tone="success" />
        <StatCard icon={<ArrowUpRight className="h-4 w-4" />} label="Money out this month" value={formatCurrency(outSum, currency)} tone="destructive" />
        <StatCard icon={<Clock className="h-4 w-4" />} label={`Pending (${pending.length})`} value={formatCurrency(pendingSum, currency)} tone="warning" />
      </div>

      {/* Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Balance history</h3>
            <p className="text-xs text-muted-foreground">Derived from your transactions</p>
          </div>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" }}
                formatter={(v: number) => formatCurrency(v, currency)}
              />
              <Line type="monotone" dataKey="balance" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent transactions */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent transactions</h3>
          <Link to="/transactions" className="text-xs font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        <div className="mt-4">
          {recent.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((t) => (
                <TxRow key={t.id} tx={t} uid={uid ?? ""} currency={currency} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted">
        <Send className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium">No recent transactions yet</p>
      <p className="text-xs text-muted-foreground">Send money or top up your balance to get started.</p>
      <div className="mt-4 flex gap-2">
        <Link to="/send" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Send
        </Link>
        <Link to="/wallet" className="rounded-xl border border-border px-4 py-2 text-sm font-medium">
          Top up
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "destructive"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/10 text-warning";
  return (
    <Card className="p-5">
      <div className={"grid h-9 w-9 place-items-center rounded-xl " + toneClass}>{icon}</div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

function TxRow({ tx, uid, currency }: { tx: Tx; uid: string; currency: string }) {
  const incoming = tx.recipient_id === uid;
  const counter = incoming ? tx.sender : tx.recipient;
  const label =
    tx.type === "top_up"
      ? "Wallet top-up"
      : tx.type === "withdrawal"
        ? "Withdrawal"
        : counter?.full_name || (incoming ? "Received" : "Sent");
  const handle = counter?.paylink_id ? "@" + counter.paylink_id : "";
  return (
    <li className="flex items-center gap-3 py-3">
      <div
        className={
          "grid h-10 w-10 place-items-center rounded-xl " +
          (incoming ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")
        }
      >
        {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {handle || formatRelativeDate(tx.created_at)}
        </p>
      </div>
      <div className="text-right">
        <p className={"text-sm font-semibold tabular-nums " + (incoming ? "text-success" : "text-destructive")}>
          {incoming ? "+" : "-"} {formatCurrency(tx.amount, currency)}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {tx.status}
        </p>
      </div>
    </li>
  );
}

function buildChart(txs: Tx[], currentBalance: number, uid: string) {
  // Walk backward from current balance through the last 30 txs
  const sorted = [...txs].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const points: { label: string; balance: number }[] = [];
  let running = 0;
  for (const t of sorted) {
    const amt = Number(t.amount);
    if (t.recipient_id === uid) running += amt;
    if (t.sender_id === uid) running -= amt;
    points.push({
      label: new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      balance: running,
    });
  }
  // If no txs, flat line
  if (points.length === 0) {
    return [
      { label: "Start", balance: currentBalance },
      { label: "Today", balance: currentBalance },
    ];
  }
  return points;
}

function TopUpDialog({ onDone, compact = false }: { onDone: () => void; compact?: boolean }) {
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
    toast.success(`Added ${formatCurrency(n)} to your balance.`);
    setOpen(false);
    setAmount("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <button className="flex-1 rounded-xl bg-white/15 px-3 py-2 text-center text-sm font-semibold">
            <Plus className="mr-1 inline h-4 w-4" /> Top up
          </button>
        ) : (
          <button className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
            <Plus className="mr-2 inline h-4 w-4" /> Top up
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up your balance</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Simulated top-up. Real bank/card funding would integrate a provider like Stripe or Plaid here.
        </p>
        <div className="space-y-2">
          <Label htmlFor="topup">Amount</Label>
          <Input id="topup" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add funds"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
