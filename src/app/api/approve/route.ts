import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyApprovalToken } from "@/lib/approval-token";

export const dynamic = "force-dynamic";

/**
 * Potvrzení rozhodnutí z e-mailu (POST z formuláře na stránce /approve/[token]). GET nikdy nic nerozhoduje —
 * náhledy odkazů v e-mailových klientech by jinak žádosti schvalovaly samy.
 * Token jen dokazuje, komu odkaz patří; oprávnění a stav žádosti znovu ověřuje databázová funkce email_decide_request.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const decision = String(form.get("decision") ?? "");
  const reason = String(form.get("reason") ?? "").slice(0, 500);

  const back = (code: string) => NextResponse.redirect(new URL(`/approve/${encodeURIComponent(token)}?vysledek=${code}`, req.url), 303);

  const payload = verifyApprovalToken(token);
  if (!payload) return back("neplatny");
  if (decision !== "approved" && decision !== "rejected") return back("neplatny");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_decide_request", {
    p_request: payload.r,
    p_approver: payload.a,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) return back("chyba");
  return back(String(data));
}
