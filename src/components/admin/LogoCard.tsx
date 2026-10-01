"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { deleteCompanyLogo, fetchCompany, uploadCompanyLogo } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";

/** Company logo — shown in the app menu for everyone (so it lives with the company's general settings, not billing). */
export function LogoCard() {
  const { profile } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) fetchCompany(profile.company_id).then((c) => setLogoUrl(c.logo_url));
  }, [profile]);

  async function change(file: File) {
    if (!profile) return;
    setError(null);
    setBusy(true);
    try {
      setLogoUrl(await uploadCompanyLogo(profile.company_id, file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!profile) return;
    setError(null);
    setBusy(true);
    try {
      await deleteCompanyLogo(profile.company_id);
      setLogoUrl(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">Logo firmy</label>
      <p className="text-xs text-muted">Zobrazí se vlevo nahoře v menu aplikace všem zaměstnancům.</p>

      <div className="mt-2.5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo firmy" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon size={20} className="text-muted" />
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            aria-label="Soubor s logem"
            onChange={(e) => e.target.files?.[0] && change(e.target.files[0])}
          />
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              {busy ? "Pracuji…" : logoUrl ? "Nahradit logo" : "Nahrát logo"}
            </Button>
            {logoUrl && (
              <Button variant="ghost" onClick={remove} disabled={busy}>
                Smazat
              </Button>
            )}
          </div>
          {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
