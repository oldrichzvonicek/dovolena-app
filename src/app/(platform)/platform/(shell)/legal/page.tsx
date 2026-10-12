import { redirect } from "next/navigation";
import { LegalFileLink, NewLegalDocumentDialog } from "@/components/platform/LegalControls";
import { Card, Empty, PageHeader, tableClass, tdClass, thClass } from "@/components/platform/ui";
import { formatDate } from "@/components/platform/format";
import { platformDb, resolveContext } from "@/server/platform/auth";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

const TYPES = [
  { key: "terms", label: "Obchodní podmínky (VOP)" },
  { key: "dpa", label: "Zpracovatelská smlouva (DPA)" },
  { key: "privacy", label: "Zásady zpracování údajů" },
];

interface Doc {
  id: string;
  type: string;
  version: string;
  effective_from: string;
  file_path: string | null;
  note: string | null;
}

export default async function LegalPage() {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "settings.write")) redirect("/login");
  const db = platformDb();
  const [{ data }, { data: consents }, { count: companyCount }] = await Promise.all([
    db.from("legal_documents").select("id, type, version, effective_from, file_path, note").order("effective_from", { ascending: false }),
    db.from("consents").select("document_id, company_id").eq("granted", true),
    db.from("companies").select("id", { count: "exact", head: true }).eq("status", "active").eq("is_test", false),
  ]);
  const docs = (data ?? []) as Doc[];
  const accepted = new Map<string, Set<string>>();
  for (const c of (consents ?? []) as { document_id: string; company_id: string }[]) accepted.set(c.document_id, (accepted.get(c.document_id) ?? new Set()).add(c.company_id));
  const anyConsent = (consents ?? []).length > 0;

  return (
    <>
      <PageHeader title="Právní dokumenty" subtitle="Verze VOP, DPA a zásad. Souhlasy se ukládají jen přidáváním, nic se nepřepisuje." actions={<NewLegalDocumentDialog types={TYPES} />} />
      {!anyConsent && (
        <p className="mb-4 rounded bg-warning-light px-3 py-2 text-sm text-warning-dark">
          Aplikace zatím souhlasy nesbírá (při registraci ani při nové verzi), proto jsou počty níže nulové. Tabulka <code>consents</code> je připravená; sběr je potřeba doplnit do zákaznické části.
        </p>
      )}
      <div className="space-y-6">
        {TYPES.map((t) => {
          const list = docs.filter((d) => d.type === t.key);
          return (
            <Card key={t.key} title={t.label}>
              {list.length === 0 ? (
                <Empty>Zatím žádná verze.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={thClass}>Verze</th>
                        <th className={thClass}>Účinnost od</th>
                        <th className={thClass}>Souhlas firem</th>
                        <th className={thClass}>Změny</th>
                        <th className={thClass}>Soubor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((d) => (
                        <tr key={d.id}>
                          <td className={`${tdClass} font-medium`}>{d.version}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{formatDate(d.effective_from)}</td>
                          <td className={`${tdClass} tabular-nums`}>{accepted.get(d.id)?.size ?? 0} / {companyCount ?? 0}</td>
                          <td className={`${tdClass} text-muted`}>{d.note ?? "–"}</td>
                          <td className={tdClass}>{d.file_path ? <LegalFileLink id={d.id} /> : <span className="text-muted">–</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
