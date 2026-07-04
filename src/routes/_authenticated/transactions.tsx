import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Search, Download, Receipt } from "lucide-react";
import { formatCurrency, formatDateTime, formatRelativeDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — PayLink" }] }),
  component: TxPage,
});

type Tx = {
  id: string;
  amount: number;
  type: "transfer" | "top_up" | "withdrawal";
  status: "completed" | "pending" | "failed";
  note: string | null;
  created_at: string;
  sender_id: string | null;
  recipient_id: string | null;
  sender: { full_name: string; paylink_id: string } | null;
  recipient: { full_name: string; paylink_id: string } | null;
};

type Filter = "all" | "in" | "out" | "pending";

function TxPage() {
  const [uid, setUid] = useState("");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Tx | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const { data } = await supabase
        .from("transactions")
        .select("id, amount, type, status, note, created_at, sender_id, recipient_id, sender:profiles!transactions_sender_id_fkey(full_name, paylink_id), recipient:profiles!transactions_recipient_id_fkey(full_name, paylink_id)")
        .or(`sender_id.eq.${u.user.id},recipient_id.eq.${u.user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);
      setTxs((data ?? []) as unknown as Tx[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = txs;
    if (filter === "in") list = list.filter((t) => t.recipient_id === uid);
    else if (filter === "out") list = list.filter((t) => t.sender_id === uid);
    else if (filter === "pending") list = list.filter((t) => t.status === "pending");
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (t) =>
          (t.note ?? "").toLowerCase().includes(s) ||
          (t.sender?.full_name ?? "").toLowerCase().includes(s) ||
          (t.recipient?.full_name ?? "").toLowerCase().includes(s) ||
          (t.sender?.paylink_id ?? "").toLowerCase().includes(s) ||
          (t.recipient?.paylink_id ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [txs, filter, q, uid]);

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="in">Money in</TabsTrigger>
              <TabsTrigger value="out">Money out</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search notes or names" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No transactions found</p>
              <p className="text-xs text-muted-foreground">Try changing the filter or search.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const incoming = t.recipient_id === uid;
                const counter = incoming ? t.sender : t.recipient;
                const label =
                  t.type === "top_up"
                    ? "Wallet top-up"
                    : t.type === "withdrawal"
                      ? "Withdrawal"
                      : counter?.full_name || (incoming ? "Received" : "Sent");
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelected(t)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-accent/40"
                    >
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
                          {formatRelativeDate(t.created_at)}{t.note ? ` · ${t.note}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={"text-sm font-semibold tabular-nums " + (incoming ? "text-success" : "text-destructive")}>
                          {incoming ? "+" : "-"} {formatCurrency(t.amount)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.status}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Transaction detail</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-muted p-6 text-center">
                <p className="text-xs uppercase text-muted-foreground">Amount</p>
                <p
                  className={
                    "mt-1 text-3xl font-bold tabular-nums " +
                    (selected.recipient_id === uid ? "text-success" : "text-destructive")
                  }
                >
                  {selected.recipient_id === uid ? "+" : "-"} {formatCurrency(selected.amount)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{selected.status}</p>
              </div>
              <Detail k="Type" v={selected.type.replace("_", " ")} />
              <Detail k="Date" v={formatDateTime(selected.created_at)} />
              <Detail k="From" v={selected.sender ? `${selected.sender.full_name} (@${selected.sender.paylink_id})` : "—"} />
              <Detail k="To" v={selected.recipient ? `${selected.recipient.full_name} (@${selected.recipient.paylink_id})` : "—"} />
              {selected.note && <Detail k="Note" v={selected.note} />}
              <Detail k="Reference" v={selected.id.slice(0, 8).toUpperCase()} />
              <Button className="w-full" onClick={() => downloadReceipt(selected)}>
                <Download className="mr-2 h-4 w-4" /> Download receipt
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
      <span className="text-sm text-muted-foreground">{k}</span>
      <span className="text-right text-sm font-medium">{v}</span>
    </div>
  );
}

function downloadReceipt(t: Tx) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${t.id}</title>
<style>body{font-family:Inter,system-ui,sans-serif;max-width:520px;margin:40px auto;padding:24px;color:#1A1A2E}
h1{color:#2A2F7C}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #EAEAF0}
.amt{font-size:32px;font-weight:800;text-align:center;margin:24px 0}</style></head><body>
<h1>PayLink Receipt</h1>
<p class="amt">${formatCurrency(t.amount)}</p>
<div class="row"><span>Type</span><b>${t.type}</b></div>
<div class="row"><span>Status</span><b>${t.status}</b></div>
<div class="row"><span>Date</span><b>${formatDateTime(t.created_at)}</b></div>
<div class="row"><span>From</span><b>${t.sender?.full_name ?? "—"}</b></div>
<div class="row"><span>To</span><b>${t.recipient?.full_name ?? "—"}</b></div>
${t.note ? `<div class="row"><span>Note</span><b>${t.note}</b></div>` : ""}
<div class="row"><span>Reference</span><b>${t.id}</b></div>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
}
