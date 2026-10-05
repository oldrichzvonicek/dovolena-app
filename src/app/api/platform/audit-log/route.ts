import { authorize, writeAudit } from "@/server/platform/auth";
import { actionLabel, loadAudit } from "@/server/platform/audit-query";
import { toCsv } from "@/lib/payroll";

export const dynamic = "force-dynamic";

/** Export audit logu do CSV (Excel, středník, buňky chráněné proti vzorcům). Filtry jsou stejné jako na stránce Audit log. */
export async function GET(req: Request) {
  const a = await authorize(req, "audit.read");
  if (!a.ok) return a.res;
  const sp = new URL(req.url).searchParams;
  const filters = { q: sp.get("q") ?? undefined, action: sp.get("action") ?? undefined, company: sp.get("company") ?? undefined, result: sp.get("result") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined };
  const { rows } = await loadAudit(filters, 5000);
  await writeAudit(a.ctx, { action: "audit.export", details: { rows: rows.length, filters } });

  const csv = toCsv(
    ["Čas", "Kdo", "Akce", "Výsledek", "Firma", "Detail", "IP"],
    rows.map((r) => [new Date(r.created_at).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" }), r.actor_label ?? r.actor_type, actionLabel(r.action), r.result, r.company_label ?? "", JSON.stringify(r.details ?? {}), r.ip ?? ""])
  );
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
