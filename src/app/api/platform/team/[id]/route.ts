import { NextResponse } from "next/server";
import { STEP_UP_HEADER, apiError, authorize, consumeStepUp, platformDb, writeAudit } from "@/server/platform/auth";
import { isPlatformRole } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Změna role nebo vypnutí/zapnutí admina. Vyžaduje step-up token (X-Step-Up-Token) vydaný pro akci `team.update:<id>`.
 * Nelze změnit sebe sama ani odebrat posledního aktivního super-admina.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "team.manage");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Admin nebyl nalezen.", 404);
  if (id === a.ctx.userId) return apiError("self_change", "Vlastní roli ani aktivitu měnit nelze. Požádejte jiného super-admina.", 409);

  const body = (await req.json().catch(() => ({}))) as { role?: unknown; active?: unknown };
  if (body.role === undefined && body.active === undefined) return apiError("invalid_input", "Není co změnit.", 400);
  if (body.role !== undefined && !isPlatformRole(body.role)) return apiError("invalid_input", "Neznámá role.", 400);
  if (body.active !== undefined && typeof body.active !== "boolean") return apiError("invalid_input", "Neplatná hodnota aktivity.", 400);

  const db = platformDb();
  const { data: target } = await db.from("platform_admins").select("user_id, email, role, active").eq("user_id", id).maybeSingle();
  if (!target) return apiError("not_found", "Admin nebyl nalezen.", 404);

  const nextRole = (body.role as string | undefined) ?? target.role;
  const nextActive = (body.active as boolean | undefined) ?? target.active;
  if (nextRole === target.role && nextActive === target.active) return NextResponse.json({ ok: true, unchanged: true });

  if (target.role === "super_admin" && target.active && (nextRole !== "super_admin" || !nextActive)) {
    const { count } = await db.from("platform_admins").select("user_id", { count: "exact", head: true }).eq("role", "super_admin").eq("active", true);
    if ((count ?? 0) <= 1) return apiError("last_super_admin", "Musí zůstat aspoň jeden aktivní super-admin.", 409);
  }

  const action = `team.update:${id}`;
  if (!(await consumeStepUp(a.ctx, action, req.headers.get(STEP_UP_HEADER)))) {
    await writeAudit(a.ctx, { action: "denied:step_up", result: "denied", details: { for: action } });
    return apiError("step_up_required", "Potvrďte akci novým kódem TOTP.", 403);
  }

  const { error } = await db.from("platform_admins").update({ role: nextRole, active: nextActive }).eq("user_id", id);
  if (error) return apiError("update_failed", "Změnu se nepodařilo uložit.", 500);
  // Vypnutý admin ztrácí všechny otevřené relace hned.
  if (!nextActive) await db.from("platform_admin_sessions").update({ ended_at: new Date().toISOString() }).eq("admin_id", id).is("ended_at", null);
  await writeAudit(a.ctx, { action: "team.update", details: { admin: target.email, role: { from: target.role, to: nextRole }, active: { from: target.active, to: nextActive } } });
  return NextResponse.json({ ok: true });
}
