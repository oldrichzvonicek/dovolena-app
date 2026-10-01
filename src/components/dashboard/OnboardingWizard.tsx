"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FlaskConical, Rocket, UserCog, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { callDemoData } from "@/lib/demo-data-client";
import { emitDataChanged } from "@/lib/events";
import { errorMessage } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const dismissedKey = (companyId: string) => `dodio:onboarding-wizard-dismissed:${companyId}`;

function OptionRow({ icon, title, hint, onClick, href, busy }: { icon: React.ReactNode; title: string; hint: string; onClick?: () => void; href?: string; busy?: boolean }) {
  const inner = (
    <>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <ChevronRight size={16} className="mt-1 shrink-0 text-muted" />
    </>
  );
  const className = "flex w-full items-start gap-3 rounded-lg border border-line p-4 text-left transition-colors hover:border-teal/40 hover:bg-paper disabled:opacity-60";
  return href ? (
    <Link href={href} onClick={onClick} className={className}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={busy} className={className}>
      {inner}
    </button>
  );
}

/**
 * Jednorázový uvítací průvodce pro úplně novou firmu (přesně ty podmínky, za kterých je "Ukázková data"
 * nabídnutelné — viz demoStatus.eligible): buď rovnou nastavit firmu (CSV import jako hlavní cesta k přidání
 * lidí), nebo si appku nejdřív prohlédnout na fiktivních datech. Kdykoliv přeskočitelné, nabídne se jen jednou.
 */
export function OnboardingWizard() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choice" | "steps">("choice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(dismissedKey(profile.company_id)) === "1";
    } catch {
      /* private mode — wizard will just offer itself again next visit */
    }
    if (dismissed) return;
    let alive = true;
    callDemoData("status")
      .then((r) => {
        if (alive && r.eligible) setOpen(true);
      })
      .catch(() => {
        /* status check failed — don't interrupt a brand-new admin's first visit with an error */
      });
    return () => {
      alive = false;
    };
  }, [profile]);

  function dismiss() {
    setOpen(false);
    if (!profile) return;
    try {
      localStorage.setItem(dismissedKey(profile.company_id), "1");
    } catch {
      /* ignore */
    }
  }

  async function tryDemo() {
    setBusy(true);
    setError(null);
    try {
      await callDemoData("create");
      emitDataChanged();
      dismiss();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!profile || profile.role !== "admin") return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent title="Vítejte v Dodiu" className="max-w-lg">
        {step === "choice" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Jak chcete začít?</p>
            <OptionRow
              icon={<Rocket size={18} className="text-teal-dark" />}
              title="Nastavit naši firmu"
              hint="Pár kroků a vaši lidé mohou žádat o absence."
              onClick={() => setStep("steps")}
            />
            <OptionRow
              icon={<FlaskConical size={18} className="text-violet-dark" />}
              title={busy ? "Připravuji ukázková data…" : "Nejdřív si to jen prohlédnout"}
              hint="Naplníme appku fiktivními lidmi a absencemi — jedním kliknutím je pak zase smažete."
              onClick={tryDemo}
              busy={busy}
            />
            {error && <p className="text-sm text-danger-dark">{error}</p>}
            <button type="button" onClick={dismiss} className="text-sm text-muted underline hover:text-ink">
              Přeskočit, prozkoumám sám
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">Nastavíme Dodio za pár minut — kdykoliv to můžete přeskočit a doplnit později v Nastavení.</p>
            <OptionRow
              icon={<Upload size={16} className="text-teal-dark" />}
              title="1. Přidejte zaměstnance"
              hint="Pozvěte lidi jednotlivě, odkazem, nebo rovnou hromadně nahrajte CSV."
              href="/admin/settings?sekce=users"
              onClick={dismiss}
            />
            <OptionRow
              icon={<UserCog size={16} className="text-teal-dark" />}
              title="2. Určete, kdo schvaluje žádosti"
              hint="Nastavte lidem nadřízeného, nebo oddělení určete vedoucího."
              href="/admin/settings?sekce=users&akce=schvalovatel"
              onClick={dismiss}
            />
            <OptionRow
              icon={<Rocket size={16} className="text-teal-dark" />}
              title="3. Zkontrolujte typy absencí a pravidla"
              hint="Nároky na dovolenou, předstih žádostí, převod do dalšího roku."
              href="/admin/settings?sekce=leave-types"
              onClick={dismiss}
            />
            <button type="button" onClick={dismiss} className="text-sm text-muted underline hover:text-ink">
              Přeskočit, prozkoumám sám
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
