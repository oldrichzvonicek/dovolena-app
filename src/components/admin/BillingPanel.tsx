"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Download, FileArchive, Image as ImageIcon, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { deleteCompanyLogo, fetchCompany, fetchCompanyInvoices, invoiceFileUrl, updateCompany, uploadCompanyLogo } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { DbCompany, DbCompanyInvoice } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/utils";

export function BillingPanel() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [icoLookup, setIcoLookup] = useState("");
  const [aresLoading, setAresLoading] = useState(false);
  const [aresError, setAresError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    fetchCompany(profile.company_id).then((c) => {
      setCompany(c);
      setIcoLookup(c.billing_ico ?? "");
      setLoading(false);
    });
  }, [profile]);

  async function patch(fields: Partial<DbCompany>) {
    if (!profile || !company) return;
    setCompany({ ...company, ...fields });
    await updateCompany(profile.company_id, fields);
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
      await patch({
        billing_name: data.name,
        billing_ico: data.ico,
        billing_dic: data.dic || null,
        billing_street: data.street || null,
        billing_city: data.city || null,
        billing_zip: data.zip || null,
      });
    } catch (e) {
      setAresError(errorMessage(e));
    } finally {
      setAresLoading(false);
    }
  }

  async function handleLogoChange(file: File) {
    if (!profile) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const url = await uploadCompanyLogo(profile.company_id, file);
      setCompany((c) => (c ? { ...c, logo_url: url } : c));
    } catch (e) {
      setLogoError(errorMessage(e));
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogoDelete() {
    if (!profile) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      await deleteCompanyLogo(profile.company_id);
      setCompany((c) => (c ? { ...c, logo_url: null } : c));
    } catch (e) {
      setLogoError(errorMessage(e));
    } finally {
      setLogoUploading(false);
    }
  }

  if (loading || !company) return <div className="card p-8 text-center text-sm text-muted">Načítám…</div>;

  return (
    <div className="space-y-6">
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
              placeholder="25596641" aria-label="25596641"
              className="w-40 rounded border border-line px-3 py-2 text-sm"
            />
          </div>
          <Button variant="secondary" onClick={handleAresLookup} disabled={aresLoading}>
            <Search size={15} /> {aresLoading ? "Hledám…" : "Načíst z ARES"}
          </Button>
          {aresError && <p className="text-sm text-danger">{aresError}</p>}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Obchodní název</label>
            <input
              defaultValue={company.billing_name ?? ""}
              onBlur={(e) => patch({ billing_name: e.target.value || null })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              key={`name-${company.billing_name}`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">IČO</label>
            <input
              defaultValue={company.billing_ico ?? ""}
              onBlur={(e) => patch({ billing_ico: e.target.value || null })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              key={`ico-${company.billing_ico}`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">DIČ</label>
            <input
              defaultValue={company.billing_dic ?? ""}
              onBlur={(e) => patch({ billing_dic: e.target.value || null })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              key={`dic-${company.billing_dic}`}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Ulice a číslo</label>
            <input
              defaultValue={company.billing_street ?? ""}
              onBlur={(e) => patch({ billing_street: e.target.value || null })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              key={`street-${company.billing_street}`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Město</label>
            <input
              defaultValue={company.billing_city ?? ""}
              onBlur={(e) => patch({ billing_city: e.target.value || null })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              key={`city-${company.billing_city}`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">PSČ</label>
            <input
              defaultValue={company.billing_zip ?? ""}
              onBlur={(e) => patch({ billing_zip: e.target.value || null })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              key={`zip-${company.billing_zip}`}
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum-light text-plum-dark">
            <ImageIcon size={15} />
          </div>
          <h2 className="font-display text-h2">Logo firmy</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Zobrazí se v hlavičce administrace.</p>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="Logo firmy" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon size={20} className="text-muted" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleLogoChange(e.target.files[0])}
            />
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={logoUploading}>
                {logoUploading ? "Pracuji…" : company.logo_url ? "Nahradit logo" : "Nahrát logo"}
              </Button>
              {company.logo_url && (
                <Button variant="ghost" onClick={handleLogoDelete} disabled={logoUploading}>
                  Smazat
                </Button>
              )}
            </div>
            {logoError && <p className="mt-1.5 text-sm text-danger">{logoError}</p>}
          </div>
        </div>
      </div>

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
        <p className="mt-4 text-sm text-muted">Načítám…</p>
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
