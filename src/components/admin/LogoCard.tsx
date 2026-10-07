"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { deleteCompanyLogo, fetchCompany, uploadCompanyLogo } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 1_000_000;

/** Company logo — shown in the app menu for everyone (so it lives with the company's general settings, not billing). */
export function LogoCard() {
  const { profile } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) fetchCompany(profile.company_id).then((c) => setLogoUrl(c.logo_url));
  }, [profile]);

  // Zruší náhled (object URL) při výběru jiného souboru nebo opuštění stránky, ať nezůstává v paměti prohlížeče.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Logo musí být obrázek PNG, JPG nebo WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Logo může mít nejvýše 1 MB.");
      return;
    }
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function cancelPending() {
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    if (!profile || !pendingFile) return;
    setError(null);
    setBusy(true);
    try {
      setLogoUrl(await uploadCompanyLogo(profile.company_id, pendingFile));
      cancelPending();
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
      <p className="text-xs text-muted">Zobrazí se vlevo nahoře v menu aplikace všem zaměstnancům. PNG, JPG nebo WebP, nejvýše 1 MB.</p>

      <div className="mt-2.5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Náhled nového loga" className="h-full w-full object-contain" />
          ) : logoUrl ? (
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
            onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
          />
          <div className="flex items-center gap-2">
            {pendingFile ? (
              <>
                <Button variant="primary" onClick={save} disabled={busy}>
                  {busy ? "Ukládám…" : "Uložit logo"}
                </Button>
                <Button variant="ghost" onClick={cancelPending} disabled={busy}>
                  Zrušit
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  {logoUrl ? "Nahradit logo" : "Nahrát logo"}
                </Button>
                {logoUrl && (
                  <Button variant="ghost" onClick={remove} disabled={busy}>
                    Smazat
                  </Button>
                )}
              </>
            )}
          </div>
          {pendingFile && !error && <p className="mt-1.5 text-xs text-muted">{pendingFile.name} — zatím neuloženo.</p>}
          {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
