import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — PayLink" }] }),
  component: SettingsPage,
});

type Settings = {
  two_factor_enabled: boolean;
  biometric_enabled: boolean;
  dark_mode: boolean;
  language: string;
  currency_preference: string;
  notification_preferences: {
    email?: boolean;
    push?: boolean;
    transactions?: boolean;
    marketing?: boolean;
  };
};

function SettingsPage() {
  const [uid, setUid] = useState("");
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const { data } = await supabase.from("settings").select("*").eq("user_id", u.user.id).maybeSingle();
      if (data) setS(data as unknown as Settings);
      setLoading(false);
    })();
  }, []);

  async function save(next: Partial<Settings>) {
    if (!s) return;
    const merged = { ...s, ...next };
    setS(merged);
    setSaving(true);
    const { error } = await supabase.from("settings").update(next).eq("user_id", uid);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if ("dark_mode" in next) {
      if (next.dark_mode) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
    toast.success("Saved");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || !s) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6">
        <h3 className="text-sm font-semibold">Security</h3>
        <div className="mt-4 space-y-4">
          <ToggleRow
            label="Two-factor authentication"
            desc="Require a code at sign-in for extra security."
            checked={s.two_factor_enabled}
            onChange={(v) => save({ two_factor_enabled: v })}
          />
          <ToggleRow
            label="Biometric login"
            desc="Use fingerprint or face ID when available."
            checked={s.biometric_enabled}
            onChange={(v) => save({ biometric_enabled: v })}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold">Preferences</h3>
        <div className="mt-4 space-y-4">
          <ToggleRow
            label="Dark mode"
            desc="Switch to a low-light theme."
            checked={s.dark_mode}
            onChange={(v) => save({ dark_mode: v })}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={s.language} onValueChange={(v) => save({ language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={s.currency_preference} onValueChange={(v) => save({ currency_preference: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  <SelectItem value="JPY">JPY — Japanese Yen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="mt-4 space-y-4">
          {(
            [
              ["email", "Email", "Receive email notifications."],
              ["push", "Push", "Push notifications on this device."],
              ["transactions", "Transaction alerts", "Notify me for every transaction."],
              ["marketing", "Product updates", "Occasional product news."],
            ] as const
          ).map(([k, label, desc]) => (
            <ToggleRow
              key={k}
              label={label}
              desc={desc}
              checked={!!s.notification_preferences?.[k]}
              onChange={(v) =>
                save({
                  notification_preferences: { ...s.notification_preferences, [k]: v },
                })
              }
            />
          ))}
        </div>
        {saving && <p className="mt-3 text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Saving…</p>}
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold">Account</h3>
        <p className="mt-1 text-xs text-muted-foreground">Sign out of your PayLink account on this device.</p>
        <Button variant="destructive" className="mt-4" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
