import { NextResponse } from "next/server";
import { apiError, authorize, platformDb } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

/** Odstraní znaky se zvláštním významem v PostgREST filtru (čárka, závorky, procenta). */
const cleanSearch = (s: string) => s.replace(/[^\p{L}\p{N} @._#-]/gu, "").trim().slice(0, 80);

export interface SearchCompanyHit {
  id: string;
  name: string;
  seq_id: number;
  /** Vyplněno, jen když shoda přišla přes e-mail nebo jméno člověka ve firmě, ne přes název firmy. */
  matchedPerson?: string;
}

/**
 * Rychlé hledání pro Cmd/Ctrl+K: firma podle názvu nebo čísla, nebo firma dohledaná podle e-mailu / jména jejího
 * uživatele. Vrací nejvýš 8 firem, beze všech dat firmy (jen id, název, číslo).
 */
export async function GET(req: Request) {
  const a = await authorize(req, "company.read_billing");
  if (!a.ok) return a.res;
  const raw = new URL(req.url).searchParams.get("q") ?? "";
  const q = cleanSearch(raw);
  if (q.length < 2) return NextResponse.json({ companies: [] satisfies SearchCompanyHit[] });

  const db = platformDb();
  const bySeq = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
  const [{ data: byName }, { data: byPeople }] = await Promise.all([
    bySeq !== null
      ? db.from("companies").select("id, name, seq_id").eq("seq_id", bySeq).limit(8)
      : db.from("companies").select("id, name, seq_id").ilike("name", `%${q}%`).order("name").limit(8),
    db.from("profiles").select("name, email, company_id").or(`email.ilike.%${q}%,name.ilike.%${q}%`).eq("is_demo", false).limit(8),
  ]);

  const hits = new Map<string, SearchCompanyHit>();
  for (const c of byName ?? []) hits.set(c.id, { id: c.id, name: c.name, seq_id: c.seq_id });
  const peopleCompanyIds = Array.from(new Set((byPeople ?? []).map((p) => p.company_id).filter((x): x is string => !!x && !hits.has(x))));
  if (peopleCompanyIds.length > 0) {
    const { data: extra } = await db.from("companies").select("id, name, seq_id").in("id", peopleCompanyIds);
    const byId = new Map((extra ?? []).map((c) => [c.id, c]));
    for (const p of byPeople ?? []) {
      if (!p.company_id || hits.has(p.company_id)) continue;
      const c = byId.get(p.company_id);
      if (c) hits.set(c.id, { id: c.id, name: c.name, seq_id: c.seq_id, matchedPerson: p.name || p.email || undefined });
    }
  }
  return NextResponse.json({ companies: Array.from(hits.values()).slice(0, 8) });
}
