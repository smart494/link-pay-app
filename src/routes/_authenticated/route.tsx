import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedShell,
});

type ProfileMini = { full_name: string; paylink_id: string; avatar_url: string | null };

function AuthedShell() {
  const [profile, setProfile] = useState<ProfileMini | null>(null);
  const [title, setTitle] = useState("Dashboard");
  const navigate = useNavigate();

  // Derive title from pathname
  useEffect(() => {
    const map: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/wallet": "Wallet",
      "/send": "Send Money",
      "/receive": "Receive Money",
      "/transactions": "Transactions",
      "/profile": "Profile",
      "/settings": "Settings",
    };
    const update = () => setTitle(map[window.location.pathname] ?? "PayLink");
    update();
    window.addEventListener("popstate", update);
    // Update on navigation via a MutationObserver on doc title (simple)
    const iv = setInterval(update, 200);
    return () => {
      window.removeEventListener("popstate", update);
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, paylink_id, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!cancelled && data) setProfile(data as ProfileMini);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <AppLayout title={title} profile={profile}>
      <Outlet />
    </AppLayout>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
