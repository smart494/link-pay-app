import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, QrCode as QrIcon, X } from "lucide-react";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/receive")({
  head: () => ({ meta: [{ title: "Receive Money — PayLink" }] }),
  component: ReceivePage,
});

type PaymentRequest = {
  id: string;
  amount: number | null;
  note: string | null;
  status: "open" | "paid" | "expired" | "cancelled";
  created_at: string;
};

function ReceivePage() {
  const [handle, setHandle] = useState<string>("");
  const [uid, setUid] = useState<string>("");
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const payLink = handle ? `${baseUrl}/send?to=${encodeURIComponent(handle)}` : "";

  async function refresh() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("paylink_id").eq("id", u.user.id).maybeSingle(),
      supabase.from("payment_requests").select("*").eq("requester_id", u.user.id).order("created_at", { ascending: false }).limit(10),
    ]);
    if (p.data) setHandle(p.data.paylink_id);
    if (r.data) setRequests(r.data as PaymentRequest[]);
    setInitLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createRequest() {
    const n = amount ? parseFloat(amount) : null;
    if (amount && (!Number.isFinite(n!) || n! <= 0)) return toast.error("Enter a valid amount.");
    setLoading(true);
    const { error } = await supabase.from("payment_requests").insert({
      requester_id: uid,
      amount: n,
      note: note || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Payment request created.");
    setAmount("");
    setNote("");
    refresh();
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function cancelRequest(id: string) {
    const { error } = await supabase.from("payment_requests").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Request cancelled");
    refresh();
  }

  if (initLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl border border-border bg-background p-4">
              {payLink ? <QRCodeSVG value={payLink} size={192} fgColor="#2A2F7C" /> : null}
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight">@{handle}</p>
            <p className="text-xs text-muted-foreground">Share your PayLink handle to get paid</p>
            <Button variant="outline" className="mt-4" onClick={() => copyLink(payLink)}>
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Request a specific amount</h3>
            <p className="text-xs text-muted-foreground">Creates a shareable request with a pre-filled amount.</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="req-amt">Amount (optional)</Label>
                <Input id="req-amt" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Open amount" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-note">Note (optional)</Label>
                <Textarea id="req-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={140} />
              </div>
              <Button onClick={createRequest} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><QrIcon className="mr-2 h-4 w-4" /> Create request</>}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold">Your payment requests</h3>
        <div className="mt-4">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment requests yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((r) => {
                const link = `${baseUrl}/send?to=${encodeURIComponent(handle)}${r.amount ? `&amount=${r.amount}` : ""}`;
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {r.amount ? formatCurrency(r.amount) : "Open amount"}
                        {r.note ? <span className="ml-2 text-xs text-muted-foreground">— {r.note}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelativeDate(r.created_at)}</p>
                    </div>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide " +
                        (r.status === "open"
                          ? "bg-warning/15 text-warning"
                          : r.status === "paid"
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {r.status}
                    </span>
                    <button className="rounded-lg p-2 hover:bg-accent" onClick={() => copyLink(link)} aria-label="Copy">
                      <Copy className="h-4 w-4" />
                    </button>
                    {r.status === "open" && (
                      <button
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                        onClick={() => cancelRequest(r.id)}
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
