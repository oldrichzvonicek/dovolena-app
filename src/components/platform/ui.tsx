import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div>
        <h1 className="font-display text-[24px] leading-[30px] sm:text-h1">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded border border-line bg-surface p-4 sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-h2">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** `href` dělá z celé karty odkaz; `linkLabel` („Seznam firem →“) říká, kam vede, a je zároveň jediná afordance. */
export function Stat({ label, value, hint, href, linkLabel }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; linkLabel?: string }) {
  const body = (
    <>
      <div className="text-label text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-caption text-muted">{hint}</div>}
      {href && linkLabel && <div className="mt-2 text-caption font-medium text-teal-dark">{linkLabel} →</div>}
    </>
  );
  if (href) {
    // Hover jen na zařízeních, která ho mají: na telefonu jinak po klepnutí zůstane karta „vybraná“ (zelený rámeček).
    return (
      <Link href={href} title={linkLabel} className="block rounded border border-line bg-surface p-4 transition-colors [@media(hover:hover)]:hover:border-teal-dark [@media(hover:hover)]:hover:bg-paper">
        {body}
      </Link>
    );
  }
  return <div className="rounded border border-line bg-surface p-4">{body}</div>;
}

export function Pill({ className, children, title }: { className: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium", className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "border-b border-line px-3 py-2 text-label text-muted whitespace-nowrap";
export const tdClass = "border-b border-line/60 px-3 py-2.5 align-middle";
export const inputClass = "w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-dark dark:bg-surface";
export const labelClass = "mb-1 block text-label text-muted";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

/** Pozitivní prázdný stav (na rozdíl od Empty) — použít tam, kde "nic tu není" je dobrá zpráva, ne jen chybějící data. */
export function AllGood({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-teal/40 bg-teal-light/40 px-4 py-8 text-center text-sm text-teal-dark">
      <CheckCircle2 size={22} />
      {children}
    </div>
  );
}
