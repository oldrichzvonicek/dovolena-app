"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchCompany, updateCompany } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { DbCompany } from "@/lib/supabase/types";
import { SaveStatusBar, useSaveStatus } from "@/components/shared/SaveStatus";
import { LogoCard } from "@/components/admin/LogoCard";
import { LoadingCard } from "@/components/ui/skeleton";

function SectionHeader({ icon, title, className }: { icon: React.ReactNode; title: string; className?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${className ?? "bg-moss-light text-moss-dark"}`}>{icon}</div>
      <h2 className="font-display text-h2">{title}</h2>
    </div>
  );
}

/** Firemní identita — zobrazovaný název, logo a ID firmy. Odděleno od Kalendáře a provozu, kam věcně nepatří. */
export function CompanyProfilePanel() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const save = useSaveStatus();
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (profile) fetchCompany(profile.company_id).then((c) => {
      setCompany(c);
      setLoading(false);
    });
  }, [profile]);

  async function patch(fields: Partial<DbCompany>) {
    if (!profile || !company) return;
    setCompany({ ...company, ...fields });
    await save.run(() => updateCompany(profile.company_id, fields));
  }

  if (loading || !company) return <LoadingCard rows={6} />;

  return (
    <div className="max-w-[640px]">
      <div className="card p-5">
        <SectionHeader icon={<Building2 size={15} />} title="Profil firmy" className="bg-sky-light text-sky-dark" />

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium">Název firmy</label>
          <input
            defaultValue={company.name}
            aria-label="Název firmy"
            className="w-full max-w-sm rounded border border-line bg-white px-3 py-2 text-sm"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== company.name) patch({ name: v });
              else e.target.value = company.name;
            }}
          />
          <p className="mt-1 text-xs text-muted">Zobrazovaný název — v hlavičce appky a v e-mailech. Na faktuře se nepoužívá, tu řídí Obchodní název ve Fakturaci.</p>
        </div>

        <div className="mt-4">
          <LogoCard />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-muted">ID firmy</label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-line bg-paper px-2 py-1 font-mono text-xs tracking-wide text-muted">DOD-{company.seq_id}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`DOD-${company.seq_id}`);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                } catch {
                  /* clipboard blocked */
                }
              }}
            >
              {copiedId ? <Check size={12} className="text-teal-dark" /> : <Copy size={12} />} {copiedId ? "Zkopírováno" : "Kopírovat"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted">Použijte při komunikaci s podporou.</p>
        </div>
      </div>

      <SaveStatusBar status={save.status} error={save.error} />
    </div>
  );
}
