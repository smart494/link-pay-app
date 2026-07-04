import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Loader2, Upload, Wallet, CreditCard, Shield } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — PayLink" }] }),
  component: ProfilePage,
});

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  paylink_id: string;
  avatar_url: string | null;
  is_verified: boolean;
};

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkedCount, setLinkedCount] = useState(0);

  async function refresh() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [p, la] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("linked_accounts").select("id", { count: "exact", head: true }).eq("user_id", u.user.id),
    ]);
    if (p.data) {
      setProfile(p.data as Profile);
      setFullName(p.data.full_name);
      setPhone(p.data.phone ?? "");
    }
    setLinkedCount(la.count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!profile) return;
    if (!fullName.trim()) return toast.error("Name is required.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated.");
    refresh();
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    // Store as data URL for demo (no storage bucket needed)
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const { error } = await supabase.from("profiles").update({ avatar_url: dataUrl }).eq("id", profile.id);
      setUploading(false);
      if (error) return toast.error(error.message);
      toast.success("Avatar updated.");
      refresh();
    };
    reader.readAsDataURL(file);
  }

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const initials = profile.full_name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
          <div className="relative">
            <Avatar className="h-24 w-24">
              {profile.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow-card hover:opacity-90">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
            </label>
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <h2 className="text-xl font-bold">{profile.full_name}</h2>
              {profile.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{profile.paylink_id}</p>
            <p className="mt-1 text-xs text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fn">Full name</Label>
            <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph">Phone</Label>
            <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <ProfileCard icon={<Wallet className="h-4 w-4" />} title="Linked accounts" desc={`${linkedCount} account${linkedCount === 1 ? "" : "s"}`} to="/wallet" />
        <ProfileCard icon={<CreditCard className="h-4 w-4" />} title="Payment methods" desc="Cards and bank accounts" to="/wallet" />
        <ProfileCard icon={<Shield className="h-4 w-4" />} title="Security" desc="Two-factor & biometrics" to="/settings" />
      </div>
    </div>
  );
}

function ProfileCard({
  icon,
  title,
  desc,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  to: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="p-5 transition-shadow hover:shadow-card">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </Card>
    </Link>
  );
}
