import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { AppLockup } from "@/components/shared/AppLockup";

export const metadata: Metadata = { title: "Děkujeme – Dodio", robots: { index: false, follow: false } };

// shortcut: placeholder odkazy, nahradit skutečnými (Google Business Profile review link, Capterra, Firmy.cz)
// před prvním skutečným odesláním NPS e-mailu z cron/daily.
const REVIEW_LINKS = [
  { label: "Ohodnotit na Google", url: "https://g.page/r/REPLACE_ME/review" },
  { label: "Ohodnotit na Capterře", url: "https://www.capterra.com/p/REPLACE_ME/Dodio/reviews/new/" },
  { label: "Ohodnotit na Firmy.cz", url: "https://www.firmy.cz/REPLACE_ME" },
];

/**
 * Cíl NPS odkazu v e-mailu (src/app/api/nps) — stejná stránka pro každého, bez ohledu na odpověď. Žádný
 * selektivní filtr podle spokojenosti (review-gating Google výslovně zakazuje).
 */
export default function HodnoceniPage() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <AppLockup className="h-7 w-auto" />
        </div>
        <div className="card p-6">
          <h1 className="font-display text-h2">Díky za odpověď!</h1>
          <p className="mt-2 text-sm text-muted">Moc nám pomůže, když o nás necháte pár slov i veřejně — zabere to minutu.</p>
          <div className="mt-4 space-y-2">
            {REVIEW_LINKS.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("block w-full rounded border border-line px-4 py-2.5 text-center text-sm font-medium text-ink hover:bg-paper")}
              >
                {r.label}
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Nechcete hodnotit? Žádný problém, díky i tak za zpětnou vazbu.</p>
        </div>
      </div>
    </main>
  );
}
