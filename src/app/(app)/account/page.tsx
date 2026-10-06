"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MfaSetup } from "@/components/account/MfaSetup";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { ICalExportPanel } from "@/components/calendar/ICalExportPanel";

// Jen rastrové obrázky (SVG může nést skripty). Přípona se odvozuje z typu souboru, ne z jeho názvu — stejný
// vzor jako uploadCompanyLogo v admin-data.ts, jen jedna fotka na osobu místo na firmu.
const AVATAR_EXT_BY_TYPE: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = AVATAR_EXT_BY_TYPE[file.type];
  if (!ext) throw new Error("Fotka musí být obrázek PNG, JPG nebo WebP.");
  if (file.size > 2_000_000) throw new Error("Fotka může mít nejvýše 2 MB.");
  const supabase = createClient();
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`; // cache-bust so a re-upload shows immediately
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) throw error;
  return url;
}

async function deleteAvatar(userId: string) {
  const supabase = createClient();
  const { data: files, error: listError } = await supabase.storage.from("avatars").list(userId);
  if (listError) throw listError;
  if (files && files.length > 0) {
    const { error: removeError } = await supabase.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
    if (removeError) throw removeError;
  }
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw error;
}

const roleLabel = (role: string, staff: string | null) => {
  const base = role === "admin" ? "Admin" : role === "manager" ? "Manažer" : "Zaměstnanec";
  return staff === "hr" ? `${base} + HR` : staff === "accountant" ? `${base} + Účetní` : base;
};

export default function AccountPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [department, setDepartment] = useState<string | null>(null);
  const [emailOn, setEmailOn] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setEmailOn(profile.email_notifications !== false);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? profile.email ?? ""));
    if (profile.department_id) supabase.from("departments").select("name").eq("id", profile.department_id).single().then(({ data }) => setDepartment((data?.name as string) ?? null));
  }, [profile]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (!currentPassword) return setPwError("Zadejte současné heslo.");
    if (password.length < 8) return setPwError("Nové heslo musí mít aspoň 8 znaků.");
    if (password !== confirm) return setPwError("Nová hesla se neshodují.");
    setPwBusy(true);
    const supabase = createClient();
    // Kdokoli u odemčeného počítače by jinak mohl heslo změnit bez jeho znalosti — Supabase samo o sobě
    // staré heslo při updateUser nevyžaduje (platná session stačí), proto se ověřuje ručně přihlášením.
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      setPwBusy(false);
      return setPwError("Současné heslo není správně.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    setPwBusy(false);
    if (error) return setPwError(errorMessage(error));
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    showToast("Heslo je změněné.");
  }

  async function toggleEmail(next: boolean) {
    if (!profile) return;
    setEmailOn(next);
    const { error } = await createClient().from("profiles").update({ email_notifications: next }).eq("id", profile.id);
    if (error) {
      setEmailOn(!next);
      showToast(errorMessage(error), "error");
      return;
    }
    await refreshProfile();
    showToast(next ? "E-mailová upozornění jsou zapnutá." : "E-mailová upozornění jsou vypnutá. V aplikaci se zobrazují dál.", "info");
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // ať jde znovu vybrat i stejný soubor (např. po neúspěchu)
    if (!file || !profile) return;
    setAvatarBusy(true);
    try {
      await uploadAvatar(profile.id, file);
      await refreshProfile();
      showToast("Fotka je nahraná.");
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (!profile) return;
    setAvatarBusy(true);
    try {
      await deleteAvatar(profile.id);
      await refreshProfile();
      showToast("Fotka je odebraná.");
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function signOutEverywhere() {
    if (!(await confirmDialog("Odhlásit se ze všech zařízení včetně tohoto?", { confirmLabel: "Odhlásit ze všech", danger: true }))) return;
    await createClient().auth.signOut({ scope: "global" });
    router.replace("/login");
  }

  if (!profile) return null;

  return (
    <div>
      <Header title="Můj účet" subtitle="Přihlášení, zabezpečení a upozornění" />
      <div className="max-w-[900px] space-y-6 p-4 sm:p-8">
        <div className="card p-5">
          <h2 className="font-display text-h2">Profil</h2>
          <div className="mt-3 flex items-center gap-4">
            <Avatar url={profile.avatar_url} initials={profile.avatar_initials} name={profile.name} className="h-16 w-16 shrink-0 bg-teal-light text-lg font-medium text-teal-dark" />
            <div className="flex flex-wrap items-center gap-2">
              <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarChange} />
              <Button type="button" variant="secondary" disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
                {avatarBusy ? "Nahrávám…" : profile.avatar_url ? "Změnit fotku" : "Nahrát fotku"}
              </Button>
              {profile.avatar_url && (
                <Button type="button" variant="secondary" disabled={avatarBusy} onClick={removeAvatar}>
                  Odebrat fotku
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">PNG, JPG nebo WebP, nejvýše 2 MB. Bez fotky se zobrazují iniciály.</p>
          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Jméno</dt>
            <dd className="font-medium">{profile.name}</dd>
            <dt className="text-muted">E-mail</dt>
            <dd>{email || "—"}</dd>
            <dt className="text-muted">Role</dt>
            <dd>{roleLabel(profile.role, profile.staff_role ?? null)}</dd>
            <dt className="text-muted">Oddělení</dt>
            <dd>{department ?? "—"}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">Jméno, oddělení, nadřízeného a roli nastavuje admin nebo HR (Nastavení firmy → Lidé).</p>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-h2">Heslo</h2>
          <form onSubmit={changePassword} className="mt-3 space-y-3">
            <div>
              <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium">
                Současné heslo
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">
                Nové heslo
              </label>
              <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">
                Nové heslo znovu
              </label>
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
            </div>
            {pwError && <p className="text-sm text-danger">{pwError}</p>}
            <Button type="submit" variant="primary" disabled={pwBusy || !currentPassword || !password}>
              {pwBusy ? "Ukládám…" : "Změnit heslo"}
            </Button>
          </form>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-h2">Dvoufázové ověření</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Kromě hesla se zadává i kód z telefonu. Silně doporučeno pro správce, HR a účetní, kteří vidí data všech kolegů.</p>
          <MfaSetup />
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-h2">E-mailová upozornění</h2>
              <p className="mt-1 text-sm text-muted">Posílat mi e-maily o žádostech, schválení a přehledy. Upozornění v aplikaci (zvoneček) zůstávají vždy.</p>
            </div>
            <Switch checked={emailOn} onCheckedChange={toggleEmail} label="E-mailová upozornění" />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-h2">Kalendář (iCal)</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Přihlaste si svoje absence do Google Kalendáře, Outlooku nebo Applu — nové schválené absence se pak promítnou samy.</p>
          <ICalExportPanel />
        </div>

        <div className="card p-5">
          <h2 className="font-display text-h2">Přihlášená zařízení</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Ztratili jste telefon nebo jste zapomněli odhlášení na cizím počítači? Odhlaste se všude.</p>
          <Button variant="secondary" onClick={signOutEverywhere}>
            Odhlásit ze všech zařízení
          </Button>
        </div>
      </div>
    </div>
  );
}
