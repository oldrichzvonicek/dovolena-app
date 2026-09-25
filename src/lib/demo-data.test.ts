import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDemoData } from "./demo-data";
import { countWorkingDays } from "./working-days";

/** Minimální náhrada Supabase klienta: zapisuje, co se vkládá, a vrací pevná data. */
function fakeAdmin() {
  const log: { table: string; op: string; payload?: unknown; filter?: unknown }[] = [];
  let userSeq = 0;
  let idSeq = 0;

  function builder(table: string) {
    let op = "select";
    let payload: unknown;
    const b: Record<string, unknown> = {};
    const result = () => {
      if (op === "select" && table === "profiles") return { data: [], count: 0, error: null };
      if (op === "select" && table === "companies") return { data: { work_days: [1, 2, 3, 4, 5] }, error: null };
      if (op === "select" && table === "leave_types") {
        return { data: ["dovolena", "home_office", "lekar", "sick"].map((key) => ({ id: `type-${key}`, key })), error: null };
      }
      if (op === "insert" && table === "departments") return { data: (payload as { name: string }[]).map((d, i) => ({ id: `dept-${i}`, name: d.name })), error: null };
      if (op === "insert" && table === "leave_requests") return { data: (payload as unknown[]).map(() => ({ id: `req-${idSeq++}` })), error: null };
      return { data: null, error: null };
    };
    for (const m of ["select", "insert", "upsert", "update", "delete"]) {
      b[m] = (arg?: unknown) => {
        if (m !== "select") {
          op = m;
          payload = arg;
          log.push({ table, op: m, payload: arg });
        }
        return b;
      };
    }
    for (const m of ["eq", "in", "single"]) b[m] = (...args: unknown[]) => (log.push({ table, op: m, filter: args }), b);
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return b;
  }

  const client = {
    from: (table: string) => builder(table),
    auth: { admin: { createUser: async () => ({ data: { user: { id: `user-${userSeq++}` } }, error: null }), deleteUser: async () => ({ error: null }) } },
  };
  return { client: client as unknown as SupabaseClient, log };
}

describe("createDemoData", () => {
  it("creates people, entitlements and non-overlapping absences with valid working days", async () => {
    const { client, log } = fakeAdmin();
    const today = "2026-09-25";
    const out = await createDemoData(client, "company-1", today);
    expect(out.people).toBe(14);
    expect(out.requests).toBeGreaterThan(30);

    const reqs = log.find((l) => l.table === "leave_requests" && l.op === "insert")!.payload as {
      profile_id: string;
      leave_type_id: string;
      start_date: string;
      end_date: string;
      working_days: number;
      half_day: boolean;
      status: string;
    }[];
    expect(reqs.every((r) => r.status === "approved")).toBe(true);
    for (const r of reqs) {
      expect(r.start_date <= r.end_date).toBe(true);
      expect(r.working_days).toBeGreaterThan(0);
      if (!r.half_day) expect(r.working_days).toBe(countWorkingDays(r.start_date, r.end_date, [1, 2, 3, 4, 5]));
      expect(countWorkingDays(r.start_date, r.start_date, [1, 2, 3, 4, 5])).toBe(1); // začíná v pracovní den
    }
    // Nikdo nemá dvě překrývající se absence.
    const byPerson = new Map<string, typeof reqs>();
    for (const r of reqs) byPerson.set(r.profile_id, [...(byPerson.get(r.profile_id) ?? []), r]);
    for (const list of byPerson.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          expect(list[i].start_date <= list[j].end_date && list[i].end_date >= list[j].start_date).toBe(false);
        }
      }
    }
    // Ukázkové účty jsou označené a bez e-mailů.
    const profiles = log.find((l) => l.table === "profiles" && l.op === "upsert")!.payload as { is_demo: boolean; email_notifications: boolean; email: string }[];
    expect(profiles.every((p) => p.is_demo && !p.email_notifications && p.email.endsWith(".invalid"))).toBe(true);
    // Čekající žádosti vznikají přepnutím ze schválených (bez oznámení).
    const toPending = log.find((l) => l.table === "leave_requests" && l.op === "update");
    expect((toPending?.payload as { status: string }).status).toBe("pending");
  });
});
