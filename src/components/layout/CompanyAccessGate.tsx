"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/shared/AppLogo";

interface AccessState {
  status: "active" | "suspended" | "pending_deletion" | "deleted";
  deletion_scheduled_at: string | null;
}

/**
 * Stav účtu firmy nastavuje provozovatel (super-admin). Firma ke smazání nemá k datům přístup (RLS ji nepustí), proto se ukáže
 * vysvětlující obrazovka; pozastavená firma je jen pro čtení, o čemž informuje pruh (zápisy blokuje databáze).
 * Když databázová funkce ještě není nasazená, chyba se ignoruje a účet se bere jako aktivní.
 */
export function CompanyAccessGate({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const [state, setState] = useState<AccessState | null>(null);

  useEffect(() => {
    if (!profile) return;
    createClient()
      .rpc("company_access_state")
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!error && row) setState(row as AccessState);
      });
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state && (state.status === "pending_deletion" || state.status === "deleted")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 text-center">
        <AppLogo className="h-10 w-10" />
        <h1 className="font-display text-h1">Účet vaší firmy je uzavřen</h1>
        <p className="max-w-md text-sm text-muted">
          {state.status === "deleted"
            ? "Data vaší firmy byla smazána."
            : `Účet je naplánovaný ke smazání${state.deletion_scheduled_at ? ` dne ${new Date(state.deletion_scheduled_at).toLocaleDateString("cs-CZ")}` : ""}. Do té doby se do aplikace nelze přihlásit. Pokud jde o omyl, napište nám a účet obnovíme.`}
        </p>
        <Button onClick={() => signOut()}>Odhlásit se</Button>
      </div>
    );
  }

  return (
    <>
      {state?.status === "suspended" && (
        <div role="status" className="bg-warning-light px-4 py-2 text-center text-sm text-warning-dark">
          Účet vaší firmy je pozastaven: data vidíte, ale nic nejde měnit. Kontaktujte prosím provozovatele služby.
        </div>
      )}
      {children}
    </>
  );
}
