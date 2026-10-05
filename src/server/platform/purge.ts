import { platformDb } from "./auth";
import { setCompanyStatus } from "./status";

/**
 * Definitivní smazání firmy po ochranné lhůtě. Idempotentní a dělené na krátké kroky (funkce na Vercelu mají limit délky):
 * 1) smaže členy přes Auth API (profil, žádosti, nároky a notifikace zmizí kaskádou), 2) soubory ve Storage,
 * 3) firemní tabulky funkcí platform_purge_company, 4) řádek companies změní na „náhrobek“ a zapíše audit.
 * Faktury, platby, upomínky a GDPR žádosti zůstávají. Když úloha spadne v půlce, další běh dokončí zbytek.
 */
export interface PurgeProgress {
  done: boolean;
  deletedUsers: number;
  skipped?: "status" | "early";
  counts?: Record<string, number>;
}

const BATCH = 20;

async function removeFolder(bucket: string, folder: string): Promise<number> {
  const storage = platformDb().storage.from(bucket);
  let removed = 0;
  for (let i = 0; i < 20; i++) {
    const { data } = await storage.list(folder, { limit: 100 });
    const names = (data ?? []).filter((f) => f.name && f.id).map((f) => `${folder}/${f.name}`);
    if (names.length === 0) break;
    await storage.remove(names);
    removed += names.length;
  }
  return removed;
}

export async function purgeCompanyStep(companyId: string, timeBudgetMs = 35_000): Promise<PurgeProgress> {
  const db = platformDb();
  const { data: company } = await db.from("companies").select("id, status, deletion_scheduled_at").eq("id", companyId).maybeSingle();
  if (!company || company.status !== "pending_deletion") return { done: true, deletedUsers: 0, skipped: "status" };
  if (company.deletion_scheduled_at && new Date(company.deletion_scheduled_at).getTime() > Date.now()) return { done: true, deletedUsers: 0, skipped: "early" };

  const started = Date.now();
  let deletedUsers = 0;
  for (;;) {
    const { data: members } = await db.from("profiles").select("id").eq("company_id", companyId).limit(BATCH);
    if (!members || members.length === 0) break;
    for (const m of members) {
      const { error } = await db.auth.admin.deleteUser(m.id);
      if (error && !/not found/i.test(error.message)) throw new Error(`Smazání účtu selhalo: ${error.message}`);
      // Účet v Auth už neexistuje, ale profil zbyl (nedokončená kaskáda): smaže se přímo.
      if (error) await db.from("profiles").delete().eq("id", m.id);
      deletedUsers++;
    }
    if (Date.now() - started > timeBudgetMs) return { done: false, deletedUsers };
  }

  await removeFolder("company-logos", companyId);
  await removeFolder("company-exports", companyId);
  const { data: counts, error } = await db.rpc("platform_purge_company", { p_company: companyId });
  if (error) throw new Error(`Smazání firemních dat selhalo: ${error.message}`);

  const r = await setCompanyStatus(null, companyId, "deleted", {
    action: "company.deleted",
    details: { deletedUsers, tables: counts },
    extra: { name: "Smazaná firma", deleted_at: new Date().toISOString(), logo_url: null, email_settings: {}, pending_plan: null, pending_plan_from: null, addons: [], locked_plan_id: null, seniority_enabled: false, seniority_rules: [] },
  });
  if (!r.ok && r.code !== "bad_transition") throw new Error(r.message);
  return { done: true, deletedUsers, counts: (counts ?? {}) as Record<string, number> };
}
