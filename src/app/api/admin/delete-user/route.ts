import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes a company member entirely (auth user + profile, cascaded by the
 * profiles.id → auth.users.id FK). Client-side code can't do this itself —
 * only a service-role key can delete an auth.users row, and that key must
 * never reach the browser — so this route re-checks the caller is an admin
 * of the SAME company as the target before touching anything.
 */
export async function POST(req: NextRequest) {
  const { targetProfileId } = await req.json();
  if (!targetProfileId || typeof targetProfileId !== "string") {
    return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
  }

  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  }

  const { data: caller } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Jen admin firmy může mazat uživatele." }, { status: 403 });
  }
  if (targetProfileId === user.id) {
    return NextResponse.json({ error: "Nemůžete smazat sami sebe." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("company_id").eq("id", targetProfileId).single();
  if (!target || target.company_id !== caller.company_id) {
    return NextResponse.json({ error: "Uživatel nebyl nalezen." }, { status: 404 });
  }

  const { error } = await admin.auth.admin.deleteUser(targetProfileId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
