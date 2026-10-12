"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { getStepUpToken, platformFetch } from "./api";
import { formatDate, formatKc } from "./format";
import { inputClass, labelClass } from "./ui";

export interface PlanPrice {
  code: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  price_extra_user_monthly: number | null;
  price_extra_user_yearly: number | null;
  included_users: number | null;
}

interface Preview {
  affected: number;
  locked: number;
  mrrBefore: number;
  mrrAfter: number;
  delta: number;
  effectiveFrom: string;
}

/** Změna ceny: náhled dopadu (kolik firem, o kolik se změní MRR, od kdy), pak uložení s novým kódem TOTP. */
export function PricingPanel({ current }: { current: PlanPrice[] }) {
  const router = useRouter();
  const [code, setCode] = useState(current[0]?.code ?? "basic");
  const plan = current.find((p) => p.code === code) ?? current[0];
  const [monthly, setMonthly] = useState(String(plan?.price_monthly ?? 0));
  const [yearly, setYearly] = useState(String(plan?.price_yearly ?? 0));
  const [extraM, setExtraM] = useState(plan?.price_extra_user_monthly != null ? String(plan.price_extra_user_monthly) : "");
  const [extraY, setExtraY] = useState(plan?.price_extra_user_yearly != null ? String(plan.price_extra_user_yearly) : "");
  const [applyTo, setApplyTo] = useState<"new_only" | "all_after_notice">("all_after_notice");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function pick(next: string) {
    const p = current.find((x) => x.code === next);
    setCode(next);
    if (!p) return;
    setMonthly(String(p.price_monthly));
    setYearly(String(p.price_yearly));
    setExtraM(p.price_extra_user_monthly != null ? String(p.price_extra_user_monthly) : "");
    setExtraY(p.price_extra_user_yearly != null ? String(p.price_extra_user_yearly) : "");
    setPreview(null);
    setError(null);
    setDone(null);
  }

  const body = () => ({ plan: code, price_monthly: monthly, price_yearly: yearly, price_extra_user_monthly: extraM, price_extra_user_yearly: extraY, apply_to: applyTo });
  const unchanged = plan && Number(monthly.replace(",", ".")) === plan.price_monthly && Number(yearly.replace(",", ".")) === plan.price_yearly && (extraM === "" ? null : Number(extraM.replace(",", "."))) === plan.price_extra_user_monthly && (extraY === "" ? null : Number(extraY.replace(",", "."))) === plan.price_extra_user_yearly;

  async function runPreview() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await platformFetch<{ preview: Preview }>("/plans/preview", { json: body() });
      setPreview(r.preview);
    } catch (e) {
      setPreview(null);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const token = await getStepUpToken(`pricing.write:${code}`, totp);
      const r = await platformFetch<{ locked: number; notified: number; effectiveFrom: string }>("/plans", { json: body(), headers: { "X-Step-Up-Token": token } });
      setDone(`Uloženo. Novou cenu platí ${applyTo === "new_only" ? "noví zákazníci od dnešního dne" : `všichni od ${formatDate(r.effectiveFrom)}`}. Zamčená původní cena: ${r.locked} firem, upozorněno: ${r.notified} e-mailů.`);
      setPreview(null);
      setTotp("");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!plan) return <p className="text-sm text-muted">Ceník není v databázi. Spusťte migraci fáze 2 a 3.</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="pr-plan">Tarif</label>
          <select id="pr-plan" className={inputClass} value={code} onChange={(e) => pick(e.target.value)}>
            {current.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="pr-m">Cena měsíčně (Kč)</label>
          <input id="pr-m" inputMode="decimal" className={inputClass} value={monthly} onChange={(e) => { setMonthly(e.target.value); setPreview(null); }} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pr-y">Cena ročně (Kč)</label>
          <input id="pr-y" inputMode="decimal" className={inputClass} value={yearly} onChange={(e) => { setYearly(e.target.value); setPreview(null); }} />
        </div>
        {plan.included_users === null && (
          <p className="text-caption text-muted sm:col-span-3">
            Cena za dalšího uživatele se u tarifu {plan.name} neúčtuje, má pevný limit uživatelů. Platí jen u tarifu s uživateli v ceně (Pro).
          </p>
        )}
        {plan.included_users !== null && (
          <>
            <div>
              <label className={labelClass} htmlFor="pr-em">Dalšího uživatele měsíčně (Kč)</label>
              <input id="pr-em" inputMode="decimal" className={inputClass} value={extraM} onChange={(e) => { setExtraM(e.target.value); setPreview(null); }} />
            </div>
            <div>
              <label className={labelClass} htmlFor="pr-ey">Dalšího uživatele ročně (Kč)</label>
              <input id="pr-ey" inputMode="decimal" className={inputClass} value={extraY} onChange={(e) => { setExtraY(e.target.value); setPreview(null); }} />
            </div>
          </>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Na koho se změna vztahuje</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="apply" className="mt-1" checked={applyTo === "all_after_notice"} onChange={() => { setApplyTo("all_after_notice"); setPreview(null); }} />
          <span><strong>Na všechny po upozornění.</strong> Firmám odejde e-mail a nová cena se jim přepne za 30 dní. Do té doby platí původní.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="apply" className="mt-1" checked={applyTo === "new_only"} onChange={() => { setApplyTo("new_only"); setPreview(null); }} />
          <span><strong>Jen pro nové zákazníky.</strong> Stávajícím firmám zůstává původní cena napořád.</span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={runPreview} disabled={busy || !!unchanged}>Spočítat dopad</Button>
        {unchanged && <span className="text-caption text-muted">Změňte aspoň jednu cenu.</span>}
      </div>

      {preview && (
        <div className="space-y-3 rounded border border-line bg-paper/60 p-4 text-sm">
          <h3 className="font-display text-h2">Potvrzení změny cen</h3>
          <p>
            Tato změna {preview.delta === 0 ? "nezmění" : preview.delta > 0 ? "zvýší" : "sníží"} měsíční příjmy (MRR){preview.delta !== 0 && ` o ${preview.delta > 0 ? "+" : ""}${formatKc(preview.delta)}`} na celkových <strong>{formatKc(preview.mrrAfter)}</strong>.{" "}
            {preview.affected > 0 ? (
              <>Dotkne se <strong>{preview.affected}</strong> {preview.affected === 1 ? "platící firmy" : "platících firem"}.</>
            ) : (
              "Žádnou stávající platící firmu se okamžitě nedotkne."
            )}
          </p>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-label text-muted">Dotčené firmy</dt><dd className="tabular-nums">{preview.affected}{applyTo === "new_only" ? " (jen noví zákazníci)" : ""}</dd></div>
            <div><dt className="text-label text-muted">Zamčená původní cena</dt><dd className="tabular-nums">{preview.locked} firem</dd></div>
            <div><dt className="text-label text-muted">MRR dnes → po změně</dt><dd className="tabular-nums">{formatKc(preview.mrrBefore)} → {formatKc(preview.mrrAfter)}</dd></div>
            <div><dt className="text-label text-muted">Dopad</dt><dd className={`tabular-nums font-semibold ${preview.delta < 0 ? "text-danger-dark" : ""}`}>{preview.delta >= 0 ? "+" : ""}{formatKc(preview.delta)} / měsíc</dd></div>
            <div><dt className="text-label text-muted">Účinnost</dt><dd>{formatDate(preview.effectiveFrom)}</dd></div>
          </dl>
          <div className="rounded border border-line bg-surface p-3">
            <label className={labelClass} htmlFor="pr-totp">Kód TOTP z vaší aplikace (citlivá akce)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input id="pr-totp" inputMode="numeric" maxLength={7} autoComplete="one-time-code" className={`${inputClass} max-w-[10rem] font-mono tracking-widest`} value={totp} onChange={(e) => setTotp(e.target.value)} />
              <Button onClick={save} disabled={busy || totp.replace(/\s/g, "").length !== 6}>{busy ? "Ukládám…" : "Uložit novou cenu"}</Button>
            </div>
          </div>
        </div>
      )}
      {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
      {done && <p role="status" className="rounded bg-teal-light px-3 py-2 text-sm text-teal-dark">{done}</p>}
    </div>
  );
}
