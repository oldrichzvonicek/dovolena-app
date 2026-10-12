import { redirect } from "next/navigation";
import { TeamTable } from "@/components/platform/TeamTable";
import { Card, PageHeader } from "@/components/platform/ui";
import { platformDb, resolveContext } from "@/server/platform/auth";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "team.manage")) redirect("/login");
  const { data } = await platformDb().from("platform_admins").select("user_id, email, name, role, active, last_login_at").order("created_at");
  return (
    <>
      <PageHeader title="Admin tým" subtitle="Kdo smí do super-adminu a s jakou rolí. Změny vyžadují nový kód TOTP a zapisují se do audit logu." />
      <Card>
        <TeamTable members={data ?? []} selfId={r.ctx.userId} />
      </Card>
      <p className="mt-4 text-caption text-muted">Nové adminy zakládá skript <code>scripts/create-platform-admin.ts</code> (viz DEPLOY.md, kap. 6).</p>
    </>
  );
}
