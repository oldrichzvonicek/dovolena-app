"use client";

import { useEffect, useState } from "react";
import { Banknote, Building2, Check, CreditCard, Download, FileArchive, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CompanyBilling, fetchBilling, fetchCompany, fetchCompanyInvoices, invoiceFileUrl, saveBilling } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/components/admin/PlanCard";
import { planByKey } from "@/lib/plans";
import { DbCompany, DbCompanyInvoice } from "@/lib/supabase/types";
import { cn, errorMessage } from "@/lib/utils";
import { LoadingCard, LoadingLines } from "@/components/ui/skeleton";

interface Draft {
  billing_name: string;
  billing_ico: string;
  billing_dic: string;
  billing_street: string;
  billing_city: string;
  billing_zip: string;
  billing_email: string;
}

const toDraft = (c: CompanyBilling): Draft => ({
  billing_name: c.billing_name ?? "",
  billing_ico: c.billing_ico ?? "",
  billing_dic: c.billing_dic ?? "",
  billing_street: c.billing_street ?? "",
  billing_city: c.billing_city ?? "",
  billing_zip: c.billing_zip ?? "",
  billing_email: c.billing_email ?? "",
});

export function BillingPanel() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [billing, setBilling] = useState<CompanyBilling | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [icoLookup, setIcoLookup] = useState("");
  const [aresLoading, setAresLoading] = useState(false);
  const [aresError, setAresError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!profile) return;
    Promise.all([fetchCompany(profile.company_id), fetchBilling(profile.company_id)]).then(([c, b]) => {
      setCompany(c);
      setBilling(b);
      setDraft(toDraft(b));
      setIcoLookup(b.billing_ico ?? "");
      setLoading(false);
    });
  }, [profile]);

  const dirty = !!billing && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(billing));

  // Explicit-save form: warn before the browser tab is closed with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function setField(key: keyof Draft, value: string) {
    setSaveMsg(null);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSaveBilling() {
    if (!profile || !billing || !draft) return;
    setSaving(true);
    setSaveMsg(null);
    const fields = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null])) as Partial<CompanyBilling>;
    try {
      await saveBilling(profile.company_id, fields);
      setBilling({ ...billing, ...fields });
      setSaveMsg({ text: "Fakturační údaje uloženy.", error: false });
    } catch (e) {
      setSaveMsg({ text: `Uložení se nezdařilo: ${errorMessage(e)}`, error: true });
    } finally {
      setSaving(false);
    }
  }

  async function setPaymentMethod(method: "invoice" | "card") {
    if (!profile || !billing) return;
    setBilling({ ...billing, payment_method: method });
    await saveBilling(profile.company_id, { payment_method: method });
  }

  async function handleAresLookup() {
    const ico = icoLookup.replace(/\D/g, "");
    if (ico.length !== 8) {
      setAresError("IČO musí mít 8 číslic.");
      return;
    }
    setAresError(null);
    setAresLoading(true);
    try {
      const res = await fetch(`/api/ares/${ico}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vyhledání v ARES se nezdařilo.");
      setSaveMsg(null);
      // Fills the form only — nothing is stored until "Uložit fakturační údaje".
      setDraft((d) => ({
        ...(d as Draft),
        billing_name: data.name ?? "",
        billing_ico: data.ico ?? ico,
        billing_dic: data.dic ?? "",
        billing_street: data.street ?? "",
        billing_city: data.city ?? "",
        billing_zip: data.zip ?? "",
      }));
    } catch (e) {
      setAresError(errorMessage(e));
    } finally {
      setAresLoading(false);
    }
  }

  if (loading || !company || !billing || !draft) return <LoadingCard rows={6} />;

  const field = (label: string, key: keyof Draft, span2 = false, type = "text") => (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input type={type} value={draft[key]} onChange={(e) => setField(key, e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
    </div>
  );

  return (
    <div className="space-y-6">
      <PlanCard planKey={company.plan} />

      <div className="card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-light text-sky-dark">
            <Building2 size={15} />
          </div>
          <h2 className="font-display text-h2">Fakturační údaje</h2>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 rounded border border-line bg-paper p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Načíst podle IČO z ARES</label>
            <input
              value={icoLookup}
              onChange={(e) => setIcoLookup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAresLookup()}
              placeholder="25596641" aria-label="IČO pro načtení z ARES"
              className="w-40 rounded border border-line px-3 py-2 text-sm"
            />
          </div>
          <Button variant="secondary" onClick={handleAresLookup} disabled={aresLoading}>
            <Search size={15} /> {aresLoading ? "Hledám…" : "Načíst z ARES"}
          </Button>
          {aresError && <p className="text-sm text-danger">{aresError}</p>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("Obchodní název", "billing_name", true)}
          {field("IČO", "billing_ico")}
          {field("DIČ", "billing_dic")}
          {field("Ulice a číslo", "billing_street", true)}
          {field("Město", "billing_city")}
          {field("PSČ", "billing_zip")}
          {field("E-mail pro faktury", "billing_email", true, "email")}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button onClick={handleSaveBilling} disabled={!dirty || saving}>
            {saving ? "Ukládám…" : "Uložit fakturační údaje"}
          </Button>
          {dirty && !saving && <span className="text-sm text-warning-dark">Máte neuložené změny.</span>}
          {saveMsg && (
            <span className={cn("flex items-center gap-1.5 text-sm", saveMsg.error ? "text-danger-dark" : "text-teal-dark")}>
              {!saveMsg.error && <Check size={14} />} {saveMsg.text}
            </span>
          )}
        </div>
      </div>

      {planByKey(company.plan).key !== "free" && (
        <div className="card p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moss-light text-moss-dark">
              <CreditCard size={15} />
            </div>
            <h2 className="font-display text-h2">Platební metoda</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setPaymentMethod("invoice")}
              className={cn("flex items-start gap-3 rounded border p-4 text-left", (billing.payment_method ?? "invoice") === "invoice" ? "border-teal ring-1 ring-teal" : "border-line hover:bg-paper")}
            >
              <Banknote size={18} className="mt-0.5 shrink-0 text-teal-dark" />
              <span>
                <span className="block text-sm font-medium">Faktura / bankovní převod</span>
                <span className="block text-xs text-muted">Fakturu posíláme na e-mail pro faktury, splatnost podle smlouvy.</span>
              </span>
            </button>
            <div className="flex items-start gap-3 rounded border border-dashed border-line p-4 opacity-70" aria-disabled="true">
              <CreditCard size={18} className="mt-0.5 shrink-0 text-muted" />
              <span>
                <span className="block text-sm font-medium">Platební karta</span>
                <span className="block text-xs text-muted">Uložení a správa karty (Stripe) připravujeme — zatím není dostupné.</span>
              </span>
            </div>
          </div>
        </div>
      )}

      <InvoiceArchiveSection companyId={company.id} />
    </div>
  );
}

function InvoiceArchiveSection({ companyId }: { companyId: string }) {
  const [invoices, setInvoices] = useState<DbCompanyInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanyInvoices(companyId).then((rows) => {
      setInvoices(rows);
      setLoading(false);
    });
  }, [companyId]);

  async function handleDownload(inv: DbCompanyInvoice) {
    if (!inv.file_url) return;
    const url = await invoiceFileUrl(inv.file_url);
    window.open(url, "_blank");
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-light text-gold-dark">
          <FileArchive size={15} />
        </div>
        <h2 className="font-display text-h2">Archiv vystavených faktur</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Faktury, které vám Dodio vystavilo za používání služby.</p>

      {loading ? (
        <div className="mt-4"><LoadingLines rows={2} /></div>
      ) : invoices.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Zatím žádné faktury.</p>
      ) : (
        <div className="mt-4 divide-y divide-line">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">{inv.number}</div>
                <div className="text-xs text-muted">
                  {new Date(inv.issue_date).toLocaleDateString("cs-CZ")} · {inv.amount.toLocaleString("cs-CZ")} {inv.currency}
                </div>
              </div>
              {inv.file_url && (
                <button
                  onClick={() => handleDownload(inv)}
                  className="flex shrink-0 items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark"
                >
                  <Download size={12} /> PDF
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
