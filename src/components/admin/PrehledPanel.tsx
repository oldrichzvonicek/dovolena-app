"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { fetchCompanyEmployees, fetchCompanyInvites, fetchBilling, AdminEmployeeRow } from "@/lib/admin-data";
import { fetchDepartments } from "@/lib/data";
import { DbDepartment } from "@/lib/supabase/types";
import { LoadingCard } from "@/components/ui/skeleton";

interface Issue {
  key: string;
  text: string;
  cta: string;
  href: string;
}

/** Health-check Nastavení firmy: admin za pár vteřin pozná, jestli je firma nastavená správně, a jedním
 *  klikem jde opravit, co chybí. Dřív se tohle dalo zjistit jen náhodou, procházením jednotlivých sekcí. */
export function PrehledPanel() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<{ people: number; departments: number; pendingInvites: number } | null>(null);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [employees, departments, invites, billing, company, emailFails] = await Promise.all([
        fetchCompanyEmployees(profile.company_id),
        fetchDepartments(profile.company_id),
        fetchCompanyInvites(profile.company_id),
        fetchBilling(profile.company_id),
        supabase.from("companies").select("require_mfa_staff, seniority_enabled").eq("id", profile.company_id).single(),
        supabase.rpc("email_log", { p_limit: 50 }),
      ]);

      const active = (employees as AdminEmployeeRow[]).filter((e) => e.active !== false && !e.join_pending);
      const depts = departments as DbDepartment[];
      const headedOrDeputized = new Set(depts.filter((d) => d.head_profile_id || d.deputy_head_profile_id).map((d) => d.id));
      const deptHasHead = new Set(depts.filter((d) => d.head_profile_id).map((d) => d.id));

      const noApprover = active.filter((e) => e.role !== "admin" && !e.manager_id && (!e.department_id || !deptHasHead.has(e.department_id)));
      const deptsWithoutHead = depts.filter((d) => !d.head_profile_id);
      const emptyDepts = depts.filter((d) => active.filter((e) => e.department_id === d.id).length === 0);
      const missingHireDate = company.data?.seniority_enabled ? active.filter((e) => !e.hire_date) : [];
      const failedEmails = ((emailFails.data as { status: string }[] | null) ?? []).filter((r) => r.status === "failed" || r.status === "retrying");

      const list: Issue[] = [];
      if (noApprover.length > 0)
        list.push({ key: "no-approver", text: `${noApprover.length} ${noApprover.length === 1 ? "člověk nemá" : "lidí nemá"} schvalovatele — žádosti padají na admina`, cta: "Zobrazit", href: "/admin/settings?sekce=users" });
      if (deptsWithoutHead.length > 0)
        list.push({ key: "no-head", text: `${deptsWithoutHead.length} ${deptsWithoutHead.length === 1 ? "oddělení nemá" : "oddělení nemá"} vedoucího`, cta: "Vyřešit", href: "/admin/settings?sekce=departments" });
      if (emptyDepts.length > 0)
        list.push({ key: "empty-dept", text: `${emptyDepts.length} ${emptyDepts.length === 1 ? "oddělení nemá" : "oddělení nemá"} žádné členy (${emptyDepts.map((d) => d.name).join(", ")})`, cta: "Zobrazit", href: "/admin/settings?sekce=departments" });
      if (company.data && company.data.require_mfa_staff !== true)
        list.push({ key: "mfa", text: "Dvoufázové ověření pro admina, HR a účetní je vypnuté", cta: "Zapnout", href: "/admin/settings?sekce=bezpecnost" });
      if (!billing.billing_ico)
        list.push({ key: "billing", text: "Chybí fakturační údaje (IČO)", cta: "Doplnit", href: "/admin/settings?sekce=billing" });
      if (invites.length > 0)
        list.push({ key: "invites", text: `${invites.length} nevyřízených pozvánek čeká na přijetí`, cta: "Zobrazit", href: "/admin/settings?sekce=users" });
      if (missingHireDate.length > 0)
        list.push({ key: "hire-date", text: `${missingHireDate.length} ${missingHireDate.length === 1 ? "člověku chybí" : "lidem chybí"} datum nástupu — nárok podle let se jim nepočítá`, cta: "Doplnit", href: "/admin/settings?sekce=users" });
      if (failedEmails.length > 0)
        list.push({ key: "emails", text: `${failedEmails.length} e-mailů se nepodařilo doručit`, cta: "Zobrazit", href: "/admin/settings?sekce=zaznamy-emaily" });

      setIssues(list);
      setStats({ people: active.length, departments: depts.length, pendingInvites: invites.length });
      setLoading(false);
    })();
  }, [profile]);

  if (loading || !stats) return <LoadingCard rows={6} />;

  return (
    <div className="max-w-[760px] space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${issues.length > 0 ? "bg-warning-light text-warning-dark" : "bg-teal-light text-teal-dark"}`}>
            {issues.length > 0 ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
          </div>
          <h2 className="font-display text-h2">{issues.length > 0 ? `Vyžaduje pozornost (${issues.length})` : "Vše v pořádku"}</h2>
        </div>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenašli jsme nic, co by stálo za doplnění — schvalovatelé, oddělení i zabezpečení vypadají v pořádku.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {issues.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{i.text}</span>
                <Link href={i.href} className="shrink-0 rounded border border-line px-2.5 py-1 text-xs font-medium text-teal-dark hover:border-teal/40 hover:bg-teal-light">
                  {i.cta}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-muted">Lidé</div>
          <div className="mt-1 font-display text-2xl">{stats.people}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Oddělení</div>
          <div className="mt-1 font-display text-2xl">{stats.departments}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Pozvánky čekají</div>
          <div className="mt-1 font-display text-2xl">{stats.pendingInvites}</div>
        </div>
      </div>
    </div>
  );
}
