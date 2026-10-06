"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchCompany, updateCompany } from "@/lib/admin-data";
import { useSaveStatus } from "@/components/shared/SaveStatus";
import { DbCompany } from "@/lib/supabase/types";

/**
 * Koncept firemních nastavení s Uložit/Zrušit (ne autosave) — u kritických pravidel pro celou firmu je
 * bezpečnější dát adminovi šanci rozmyšlenou úpravu vzít zpět, než ji hned nevratně propsat. Sdílené napříč
 * stránkami Nastavení firmy (Pracovní kalendář, Nároky a zůstatky, Pravidla žádostí, Bezpečnost a soukromí…),
 * ať se v každé nezavádí vlastní kopie stejné logiky.
 */
export function useCompanyDraft() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);
  // Poslední uložený stav — zdroj pravdy pro "Zrušit" a pro to, které pole se při "Uložit změny" odešlou.
  const [saved, setSaved] = useState<DbCompany | null>(null);
  const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<keyof DbCompany>>(new Set());
  // Needitovaná číselná pole (UnitInput apod., defaultValue kvůli psaní bez poskakování kurzoru) se po "Zrušit"
  // sama nepřekreslí na starou hodnotu, dokud je nepřinutíme se znovu examountovat — viz `key={resetToken}`.
  const [resetToken, setResetToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const save = useSaveStatus();

  async function load() {
    if (!profile) return;
    const c = await fetchCompany(profile.company_id);
    setCompany(c);
    setSaved(c);
    setDirtyKeys(new Set());
    setResetToken((n) => n + 1);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function patch(fields: Partial<DbCompany>) {
    if (!company) return;
    setCompany({ ...company, ...fields });
    setDirtyKeys((prev) => new Set([...prev, ...(Object.keys(fields) as (keyof DbCompany)[])]));
  }

  const dirty = dirtyKeys.size > 0;

  // Varování při zavření/obnovení karty s neuloženou změnou — in-app navigace v appce neprochází (Next.js
  // router to nezachytí bez větších zásahů), ale tohle pokryje nejčastější riziko ztráty rozepsané úpravy.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function cancel() {
    if (!saved) return;
    setCompany(saved);
    setDirtyKeys(new Set());
    setResetToken((n) => n + 1);
  }

  function save_() {
    if (!profile || !company || !dirty) return;
    const fields: Partial<DbCompany> = {};
    for (const k of dirtyKeys) (fields as Record<string, unknown>)[k] = company[k];
    save.run(async () => {
      await updateCompany(profile.company_id, fields);
      setSaved(company);
      setDirtyKeys(new Set());
    });
  }

  return { company, loading, patch, dirty, resetToken, cancel, save: save_, saveStatus: save.status, saveError: save.error, reload: load };
}
