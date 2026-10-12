import { strToU8, zipSync } from "fflate";
import { fetchAll } from "@/lib/fetch-all";
import { toCsv } from "@/lib/payroll";
import { platformDb } from "./auth";

/**
 * Export dat firmy pro jejího vlastníka (před smazáním, nebo na žádost): ZIP s CSV pro Excel a JSON s nastavením.
 * Obsahuje jen data této firmy, včetně jejích lidí a absencí — ta patří firmě, která je správcem údajů.
 */

// Sloupce companies, které jsou interní pro provozovatele a do exportu nepatří.
const INTERNAL_COMPANY_KEYS = ["status", "discount_pct", "is_test", "last_activity_at", "deletion_scheduled_at", "deletion_reason", "status_before_deletion", "deleted_at", "locked_plan_id"];

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export interface ExportResult {
  zip: Uint8Array;
  counts: Record<string, number>;
}

/** Dotaz po dávkách id; každá dávka se čte po stránkách (PostgREST vrací nejvýš 1 000 řádků). */
async function inChunks<T>(ids: string[], size: number, run: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    const { data, error } = await fetchAll<T>((from, to) => run(chunk, from, to));
    if (error) throw new Error(error.message);
    out.push(...data);
  }
  return out;
}

export async function buildCompanyExport(companyId: string): Promise<ExportResult> {
  const db = platformDb();
  const { data: company } = await db.from("companies").select("*").eq("id", companyId).maybeSingle();
  if (!company) throw new Error("Firma nebyla nalezena.");
  for (const k of INTERNAL_COMPANY_KEYS) delete (company as Row)[k];

  const [{ data: billing }, { data: departments }, { data: types }, { data: profiles }, { data: invoices }] = await Promise.all([
    db.from("company_billing").select("*").eq("company_id", companyId).maybeSingle(),
    db.from("departments").select("id, name, head_profile_id, deputy_head_profile_id").eq("company_id", companyId),
    db.from("leave_types").select("id, key, label, counts_against, paid, requires_approval, active").eq("company_id", companyId).order("sort_order"),
    fetchAll<Row>((from, to) => db.from("profiles").select("id, name, email, role, staff_role, active, department_id, manager_id, created_at").eq("company_id", companyId).eq("is_demo", false).order("id").range(from, to)),
    db.from("company_invoices").select("number, issue_date, due_at, paid_at, amount, vat, currency, status").eq("company_id", companyId).order("issue_date"),
  ]);
  const people = ((profiles ?? []) as Row[]).sort((a, b) => str(a.name).localeCompare(str(b.name), "cs"));
  const ids = people.map((p) => String(p.id));
  const nameOf = new Map(people.map((p) => [String(p.id), str(p.name)]));
  const deptName = new Map(((departments ?? []) as Row[]).map((d) => [String(d.id), str(d.name)]));
  const typeLabel = new Map(((types ?? []) as Row[]).map((t) => [String(t.id), str(t.label)]));

  const hr = await inChunks<Row>(ids, 150, (c, from, to) => db.from("profile_hr").select("profile_id, hire_date, termination_date, personal_number").in("profile_id", c).order("profile_id").range(from, to));
  const hrOf = new Map(hr.map((h) => [String(h.profile_id), h]));
  const requests = await inChunks<Row>(ids, 100, (c, from, to) =>
    db.from("leave_requests").select("profile_id, leave_type_id, start_date, end_date, half_day, working_days, status, note, created_at").in("profile_id", c).order("id").range(from, to)
  );
  const entitlements = await inChunks<Row>(ids, 100, (c, from, to) => db.from("leave_entitlements").select("profile_id, leave_type_id, year, total_days, opening_used_days").in("profile_id", c).order("id").range(from, to));

  const files: Record<string, Uint8Array> = {};
  const put = (name: string, headers: string[], rows: string[][]) => (files[name] = strToU8(toCsv(headers, rows)));

  put("lide.csv", ["Jméno", "E-mail", "Role", "Doplňková role", "Aktivní", "Oddělení", "Nadřízený", "Datum nástupu", "Datum ukončení", "Osobní číslo"], people.map((p) => {
    const h = hrOf.get(String(p.id));
    return [str(p.name), str(p.email), str(p.role), str(p.staff_role), p.active ? "ano" : "ne", deptName.get(str(p.department_id)) ?? "", nameOf.get(str(p.manager_id)) ?? "", str(h?.hire_date), str(h?.termination_date), str(h?.personal_number)];
  }));
  put("oddeleni.csv", ["Oddělení", "Vedoucí", "Zástupce"], ((departments ?? []) as Row[]).map((d) => [str(d.name), nameOf.get(str(d.head_profile_id)) ?? "", nameOf.get(str(d.deputy_head_profile_id)) ?? ""]));
  put("typy-absenci.csv", ["Klíč", "Název", "Čerpá z", "Placená", "Vyžaduje schválení", "Aktivní"], ((types ?? []) as Row[]).map((t) => [str(t.key), str(t.label), str(t.counts_against), t.paid ? "ano" : "ne", t.requires_approval ? "ano" : "ne", t.active ? "ano" : "ne"]));
  put("zadosti-o-absenci.csv", ["Zaměstnanec", "Typ", "Od", "Do", "Půl dne", "Pracovních dní", "Stav", "Poznámka", "Vytvořeno"], requests.map((r) => [
    nameOf.get(str(r.profile_id)) ?? "", typeLabel.get(str(r.leave_type_id)) ?? "", str(r.start_date), str(r.end_date), r.half_day ? "ano" : "ne", str(r.working_days), str(r.status), str(r.note), str(r.created_at),
  ]));
  put("naroky.csv", ["Zaměstnanec", "Typ", "Rok", "Nárok (dní)", "Počáteční čerpání (dní)"], entitlements.map((e) => [nameOf.get(str(e.profile_id)) ?? "", typeLabel.get(str(e.leave_type_id)) ?? "", str(e.year), str(e.total_days), str(e.opening_used_days)]));
  put("faktury.csv", ["Číslo", "Vystaveno", "Splatnost", "Zaplaceno", "Částka", "DPH", "Měna", "Stav"], ((invoices ?? []) as Row[]).map((i) => [str(i.number), str(i.issue_date), str(i.due_at), str(i.paid_at), str(i.amount), str(i.vat), str(i.currency), str(i.status)]));
  files["nastaveni-firmy.json"] = strToU8(JSON.stringify({ firma: company, fakturacni_udaje: billing ?? null }, null, 2));
  files["README.txt"] = strToU8(
    [
      "Export dat firmy z Dodio",
      `Vytvořeno: ${new Date().toISOString()}`,
      "",
      "CSV soubory jsou v kódování UTF-8 se středníkem (otevřou se rovnou v Excelu). nastaveni-firmy.json obsahuje nastavení firmy a fakturační údaje.",
      "Soubor obsahuje osobní údaje vašich zaměstnanců. Uchovávejte ho zabezpečeně a po použití smažte.",
    ].join("\r\n")
  );

  const counts = { lide: people.length, oddeleni: (departments ?? []).length, typy_absenci: (types ?? []).length, zadosti: requests.length, naroky: entitlements.length, faktury: (invoices ?? []).length };
  return { zip: zipSync(files, { level: 6 }), counts };
}

/** Nahraje ZIP do soukromého bucketu company-exports a vrátí cestu k souboru. */
export async function storeCompanyExport(companyId: string, zip: Uint8Array): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const path = `${companyId}/export-${stamp}.zip`;
  const { error } = await platformDb().storage.from("company-exports").upload(path, zip, { contentType: "application/zip", upsert: false });
  if (error) throw new Error(`Export se nepodařilo uložit: ${error.message}`);
  return path;
}

export async function signedExportUrl(path: string, seconds: number): Promise<string | null> {
  const { data } = await platformDb().storage.from("company-exports").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Nejnovější hotový export firmy (z úloh), nebo null. */
export async function latestExportPath(companyId: string): Promise<string | null> {
  const { data } = await platformDb().from("platform_jobs").select("result").eq("type", "company.export").eq("company_id", companyId).eq("status", "done").order("finished_at", { ascending: false }).limit(1);
  const r = data?.[0]?.result as { path?: string } | undefined;
  return r?.path ?? null;
}
