import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteClient } from "@/lib/supabase/server";
import { verifyApprovalToken } from "@/lib/approval-token";
import { appUrl } from "@/lib/email";
import { headers } from "next/headers";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { computeBalance, remainingOf } from "@/lib/balances";
import { DEFAULT_WORK_DAYS } from "@/lib/working-days";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/shared/AppLogo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schválení žádosti – Dodio", robots: { index: false, follow: false }, referrer: "no-referrer" };

const fmt = (iso: string) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;
const czDayWord = (n: number) => (n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní");

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-paper px-4 py-10">
      <div className={cn("w-full", wide ? "max-w-lg" : "max-w-md")}>
        <div className="mb-4 flex items-center gap-2">
          <AppLogo className="h-7 w-7" />
          <span className="font-display text-xl text-teal-dark">Dodio</span>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}

function Message({ title, text, tone = "info" }: { title: string; text: string; tone?: "info" | "ok" | "error" }) {
  return (
    <Shell>
      <h1 className={`font-display text-h2 ${tone === "ok" ? "text-teal-dark" : tone === "error" ? "text-danger" : ""}`}>{title}</h1>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <a href={`${appUrl()}/approvals`} className="mt-5 inline-block text-sm font-medium text-teal-dark underline underline-offset-2">
        Otevřít žádosti v aplikaci
      </a>
    </Shell>
  );
}

const RESULT_TEXT: Record<string, { title: string; text: string; tone: "info" | "ok" | "error" }> = {
  already_decided: { title: "Žádost už je rozhodnutá", text: "Někdo ji mezitím schválil nebo zamítl.", tone: "info" },
  forbidden: { title: "Tuhle žádost teď nemůžete rozhodnout", text: "Nejste její schvalovatel, změnila se vaše role, nebo firma schvalování z e-mailu vypnula. Rozhodněte ji v aplikaci.", tone: "error" },
  not_found: { title: "Žádost nebyla nalezena", text: "Byla nejspíš smazána.", tone: "error" },
  reason_required: { title: "Chybí důvod zamítnutí", text: "Zamítnutí vyžaduje důvod. Vraťte se zpět a vyplňte ho.", tone: "error" },
  chyba: { title: "Něco se nepovedlo", text: "Rozhodnutí se nepodařilo uložit. Zkuste to prosím v aplikaci.", tone: "error" },
  neplatny: { title: "Odkaz je neplatný nebo vypršel", text: "Odkazy z e-mailu platí 7 dní. Žádost rozhodnete v aplikaci.", tone: "error" },
};

export default async function ApprovePage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ akce?: string; vysledek?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const token = decodeURIComponent(params.token);
  if (!(await allowRequest(`approve-page:${clientIp(await headers())}`, 60, 60))) return <Message title="Příliš mnoho požadavků" text="Zkuste to prosím za chvíli." tone="error" />;
  const payload = verifyApprovalToken(token);
  if (!payload) return <Message {...RESULT_TEXT.neplatny} />;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("leave_requests")
    .select(
      "status, start_date, end_date, working_days, half_day, note, rejection_reason, leave_type:leave_types(label, counts_against), profile:profiles!leave_requests_profile_id_fkey(id, name, company_id, department_id)"
    )
    .eq("id", payload.r)
    .single();
  if (!req) return <Message {...RESULT_TEXT.not_found} />;

  const profile = req.profile as unknown as { id: string; name: string; company_id: string; department_id: string | null } | null;
  const leaveType = req.leave_type as unknown as { label: string; counts_against: "vacation" | "sick" | "none" } | null;
  const type = leaveType?.label ?? "absenci";
  const range = req.start_date === req.end_date ? fmt(req.start_date) : `${fmt(req.start_date)} – ${fmt(req.end_date)}`;
  const days = Number(req.working_days);
  const dayWord = days === 1 ? "pracovní den" : days > 1 && days < 5 ? "pracovní dny" : "pracovních dnů";

  if (req.status !== "pending") {
    const done = req.status === "approved" ? "schválena" : "zamítnuta";
    const justNow = searchParams.vysledek === "ok";
    return (
      <Message
        title={justNow ? `Hotovo — žádost je ${done}` : `Žádost už je ${done}`}
        text={`${profile?.name ?? "Zaměstnanec"}: ${type}, ${range}.${justNow ? " Zaměstnanci jsme dali vědět." : ""}${req.status === "rejected" && req.rejection_reason ? ` Důvod: ${req.rejection_reason}` : ""}`}
        tone={justNow ? "ok" : "info"}
      />
    );
  }

  // Jste v tomhle prohlížeči zrovna přihlášený jako přesně ten schvalovatel, komu e-mail patří? Pak ať žádost
  // rozhodnete rovnou v appce (Ke schválení, žádost zvýrazněná) — ne na samostatné stránce mimo Dodio. Tahle
  // stránka mimo aplikaci zůstává jako záloha pro případ, že přihlášení nejste (např. odkaz otevřený na mobilu).
  const routeClient = await createRouteClient();
  const {
    data: { user },
  } = await routeClient.auth.getUser();
  if (user?.id === payload.a) redirect(`/approvals?zadost=${payload.r}`);

  // Kontext pro rozhodnutí, stejný jako v appce: zůstatek dovolené po schválení a kdo další z oddělení v tomto
  // termínu chybí. Bez přihlášení (odkaz z e-mailu), proto se čte servisním klíčem — jen k tomuto jednomu požadavku.
  let balanceLine: { before: number; after: number; unit: string } | null = null;
  let overlapping: { name: string; label: string; start_date: string; end_date: string }[] = [];
  let deptSize: number | null = null;
  let deptName: string | null = null;

  if (profile) {
    const year = new Date().getFullYear();
    const [{ data: company }, { data: ents }, { data: approvedReqs }] = await Promise.all([
      admin.from("companies").select("max_carryover_days, carryover_expiry_md, work_days").eq("id", profile.company_id).single(),
      leaveType?.counts_against === "vacation" || leaveType?.counts_against === "sick"
        ? admin
            .from("leave_entitlements")
            .select("profile_id, year, total_days, opening_used_days, leave_type:leave_types(counts_against)")
            .eq("profile_id", profile.id)
            .in("year", [year - 1, year])
        : Promise.resolve({ data: [] as unknown[] }),
      leaveType?.counts_against === "vacation" || leaveType?.counts_against === "sick"
        ? admin
            .from("leave_requests")
            .select("id, profile_id, start_date, end_date, working_days, leave_type:leave_types(counts_against)")
            .eq("profile_id", profile.id)
            .eq("status", "approved")
            .gte("start_date", `${year - 1}-01-01`)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    if (leaveType?.counts_against === "vacation" || leaveType?.counts_against === "sick") {
      const balance = computeBalance(
        leaveType.counts_against,
        (ents as never[]) ?? [],
        (approvedReqs as never[]) ?? [],
        year,
        new Date().toLocaleDateString("sv-SE"),
        {
          max: company?.max_carryover_days !== null && company?.max_carryover_days !== undefined ? Number(company.max_carryover_days) : null,
          expiryMD: (company?.carryover_expiry_md as string | null) ?? null,
        },
        (company?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS
      );
      const before = remainingOf(balance);
      balanceLine = { before, after: before - days, unit: leaveType.counts_against === "vacation" ? "dovolené" : "sick days" };
    }

    if (profile.department_id) {
      const [{ data: dept }, { data: colleagues }, { data: overlap }] = await Promise.all([
        admin.from("departments").select("name").eq("id", profile.department_id).single(),
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("department_id", profile.department_id).eq("active", true),
        admin
          .from("leave_requests")
          .select("start_date, end_date, leave_type:leave_types(label, hide_from_colleagues), profile:profiles!leave_requests_profile_id_fkey(id, name, department_id, active)")
          .eq("status", "approved")
          .lte("start_date", req.end_date)
          .gte("end_date", req.start_date),
      ]);
      deptName = (dept?.name as string | undefined) ?? null;
      deptSize = (colleagues as unknown as { length: number } | null)?.length ?? null;
      type OverlapRow = { start_date: string; end_date: string; leave_type: { label: string; hide_from_colleagues: boolean } | null; profile: { id: string; name: string; department_id: string | null; active: boolean } | null };
      overlapping = ((overlap as unknown as OverlapRow[]) ?? [])
        .filter((o) => o.profile?.active && o.profile.department_id === profile.department_id && o.profile.id !== profile.id)
        .map((o) => ({ name: o.profile!.name, label: o.leave_type?.hide_from_colleagues ? "Nepřítomen" : (o.leave_type?.label ?? "Absence"), start_date: o.start_date, end_date: o.end_date }))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
    }
  }

  const failure = searchParams.vysledek && searchParams.vysledek !== "ok" ? RESULT_TEXT[searchParams.vysledek] : null;
  const reject = searchParams.akce === "zamitnout" || searchParams.vysledek === "reason_required";

  return (
    <Shell wide>
      <h1 className="font-display text-h2">Žádost o absenci ke schválení</h1>
      <div className="mt-4 rounded border border-line p-4">
        <div className="font-medium">{profile?.name ?? "Zaměstnanec"}</div>
        <div className="mt-1 text-sm">
          {type} · {range}
        </div>
        <div className="text-sm text-muted">{req.half_day ? "půlden" : `${days} ${dayWord}`}</div>
        {req.note && <div className="mt-2 text-sm text-muted">Poznámka: {req.note}</div>}
      </div>

      {balanceLine && (
        <div className="mt-3 rounded border border-line p-3 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              balanceLine.after < 0 ? "bg-danger-light text-danger-dark" : balanceLine.after < 3 ? "bg-warning-light text-warning-dark" : "bg-paper text-ink"
            )}
          >
            Zůstatek {balanceLine.unit}: {balanceLine.before} → po schválení {balanceLine.after} {czDayWord(Math.round(Math.abs(balanceLine.after)))}
            {balanceLine.after < 0 ? " (minus)" : ""}
          </span>
        </div>
      )}

      {deptName && (
        <div className="mt-3 rounded border border-line p-4">
          <div className="text-sm font-medium">
            {deptName}
            {deptSize !== null && <span className="font-normal text-muted"> ({deptSize} lidí)</span>} — kdo v tomto termínu ještě chybí
          </div>
          {overlapping.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">✓ Nikdo další z oddělení nemá ve stejném termínu schválenou absenci.</p>
          ) : (
            <ul className="mt-1.5 space-y-1 text-sm">
              {overlapping.map((o, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{o.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {o.label} · {o.start_date === o.end_date ? fmt(o.start_date) : `${fmt(o.start_date)} – ${fmt(o.end_date)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {failure && <p className="mt-3 rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{failure.title}. {failure.text}</p>}

      <form method="post" action="/api/approve" className="mt-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="decision" value="approved" />
        <button type="submit" className="w-full rounded bg-teal px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-dark">
          Schválit žádost
        </button>
      </form>

      <form method="post" action="/api/approve" className="mt-3 rounded border border-line p-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="decision" value="rejected" />
        <label htmlFor="reason" className="mb-1.5 block text-sm font-medium">
          Zamítnout — důvod (povinný)
        </label>
        <textarea id="reason" name="reason" rows={3} required maxLength={500} autoFocus={reject} className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="Např. v tomto termínu je tým bez kapacity" />
        <button type="submit" className="mt-2 w-full rounded border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger-light">
          Zamítnout žádost
        </button>
      </form>

      <p className="mt-4 text-xs text-muted">Rozhodnutí se uloží hned po kliknutí. Odkaz je určený jen vám — nepřeposílejte ho.</p>
    </Shell>
  );
}
