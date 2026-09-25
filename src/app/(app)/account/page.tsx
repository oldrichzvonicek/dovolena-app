"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MfaSetup } from "@/components/account/MfaSetup";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";

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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

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
    if (password.length < 8) return setPwError("Heslo musí mít aspoň 8 znaků.");
    if (password !== confirm) return setPwError("Hesla se neshodují.");
    setPwBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPwBusy(false);
    if (error) return setPwError(errorMessage(error));
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

  async function signOutEverywhere() {
    if (!window.confirm("Odhlásit se ze všech zařízení včetně tohoto?")) return;
    await createClient().auth.signOut({ scope: "global" });
    router.replace("/login");
  }

  if (!profile) return null;

  return (
    <div>
      <Header title="Můj účet" subtitle="Přihlášení, zabezpečení a upozornění" />
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
        <div className="card p-5">
          <h2 className="font-display text-h2">Profil</h2>
          <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Jméno</dt>
            <dd className="font-medium">{profile.name}</dd>
            <dt className="text-muted">E-mail</dt>
            <dd>{email || "—"}</dd>
            <dt className="text-muted">Role</dt>
            <dd>{roleLabel(profile.role, profile.staff_role ?? null)}</dd>
            <dt className="text-muted">Oddělení</dt>
            <dd>{department ?? "—"}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">Jméno, oddělení, nadřízeného a roli nastavuje admin nebo HR (Nastavení firmy → Uživatelé).</p>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-h2">Heslo</h2>
          <form onSubmit={changePassword} className="mt-3 space-y-3">
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
            <Button type="submit" variant="primary" disabled={pwBusy || !password}>
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
