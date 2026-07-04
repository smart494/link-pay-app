import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Send, ShieldCheck, Zap, Wallet, QrCode, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayLink — Send, receive, and manage money instantly" },
      {
        name: "description",
        content:
          "PayLink is a modern digital wallet. Send money in seconds with @handles, request payments, top up your balance, and track every transaction.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-hero">
            <Send className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">PayLink</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-xl px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Log in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> New — Instant transfers with @handles
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Money that moves at the <span className="text-primary">speed of a message</span>.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              PayLink is a modern digital wallet built for humans. Send, receive, and track your money with a beautiful, secure experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "register" }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-hero hover:opacity-90"
              >
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-accent"
              >
                Log in
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free forever. No hidden fees. Simulated balances for the demo experience.
            </p>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-hero">
                <p className="text-xs opacity-80">Available balance</p>
                <p className="mt-1 text-4xl font-bold tabular-nums">$12,480.55</p>
                <div className="mt-4 flex gap-2">
                  <div className="rounded-lg bg-white/15 px-3 py-1.5 text-xs">@you</div>
                  <div className="rounded-lg bg-white/15 px-3 py-1.5 text-xs">USD</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Send", icon: Send },
                  { label: "Request", icon: QrCode },
                  { label: "Top up", icon: Wallet },
                ].map((a) => (
                  <div key={a.label} className="rounded-xl border border-border bg-background p-3 text-center">
                    <a.icon className="mx-auto h-5 w-5 text-primary" />
                    <p className="mt-1 text-xs font-medium">{a.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { name: "Alex Kim", handle: "@alexk", amount: "+ $240.00", positive: true },
                  { name: "Coffee Bar", handle: "@coffeebar", amount: "- $6.20", positive: false },
                  { name: "Priya Patel", handle: "@priya", amount: "+ $85.00", positive: true },
                ].map((t) => (
                  <div
                    key={t.handle}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.handle}</p>
                    </div>
                    <p
                      className={
                        "text-sm font-semibold tabular-nums " +
                        (t.positive ? "text-success" : "text-destructive")
                      }
                    >
                      {t.amount}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Everything you need to move money</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A wallet designed to feel effortless — with the polish of a modern fintech and none of the friction.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Zap,
                title: "Instant transfers",
                body: "Send money to any @handle in seconds. Balances update the moment the transfer completes.",
              },
              {
                icon: QrCode,
                title: "Request with a link",
                body: "Share a payment link or QR code. Set an amount or leave it open — collect on your terms.",
              },
              {
                icon: LineChart,
                title: "Track everything",
                body: "See your balance history, filter transactions, and download receipts whenever you need them.",
              },
              {
                icon: Wallet,
                title: "Simple wallet",
                body: "Link accounts, top up your balance, and see your total at a glance.",
              },
              {
                icon: ShieldCheck,
                title: "Secure by default",
                body: "Two-factor authentication, biometric login, and encrypted sessions keep your money safe.",
              },
              {
                icon: Send,
                title: "Built for the modern web",
                body: "A responsive, accessible experience that feels great on every device.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-background p-6 shadow-card">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="rounded-3xl bg-primary p-10 text-center text-primary-foreground shadow-hero md:p-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Your money, beautifully organized.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Sign up in seconds and start sending money like a message.
          </p>
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent"
          >
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} PayLink</p>
          <div className="flex gap-4">
            <span>Simulated demo — no real money is moved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
