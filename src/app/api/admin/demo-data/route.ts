import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDemoData, demoStatus, removeDemoData } from "@/lib/demo-data";

/**
 * Ukázková data firmy (fiktivní lidé a absence). Zakládat a mazat je smí jen admin své firmy;
 * účty vytváří a maže service role, proto to nejde z prohlížeče.
 */
export async function POST(req: NextRequest) {
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "create" && action !== "remove" && action !== "status") {
    return NextResponse.json({ error: "Neznámá akce." }, { status: 400 });
  }

  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single();
  if (!caller || caller.role !== "admin") return NextResponse.json({ error: "Ukázková data spravuje jen admin firmy." }, { status: 403 });

  const admin = createAdminClient();
  try {
    if (action === "status") return NextResponse.json({ ok: true, ...(await demoStatus(admin, caller.company_id)) });
    if (action === "remove") return NextResponse.json({ ok: true, removed: await removeDemoData(admin, caller.company_id) });
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });
    return NextResponse.json({ ok: true, ...(await createDemoData(admin, caller.company_id, today)) });
  } catch (e) {
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Neznámá chyba.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
