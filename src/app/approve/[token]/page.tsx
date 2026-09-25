import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyApprovalToken } from "@/lib/approval-token";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schválení žádosti – Dodio", robots: { index: false, follow: false }, referrer: "no-referrer" };

const fmt = (iso: string) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 font-display text-xl text-teal-dark">Dodio</div>
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

export default async function ApprovePage({ params, searchParams }: { params: { token: string }; searchParams: { akce?: string; vysledek?: string } }) {
  const token = decodeURIComponent(params.token);
  const payload = verifyApprovalToken(token);
  if (!payload) return <Message {...RESULT_TEXT.neplatny} />;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("leave_requests")
    .select("status, start_date, end_date, working_days, half_day, note, rejection_reason, leave_type:leave_types(label), profile:profiles!leave_requests_profile_id_fkey(name, company_id)")
    .eq("id", payload.r)
    .single();
  if (!req) return <Message {...RESULT_TEXT.not_found} />;

  const profile = req.profile as unknown as { name: string; company_id: string } | null;
  const type = (req.leave_type as unknown as { label: string } | null)?.label ?? "absenci";
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

  const failure = searchParams.vysledek && searchParams.vysledek !== "ok" ? RESULT_TEXT[searchParams.vysledek] : null;
  const reject = searchParams.akce === "zamitnout" || searchParams.vysledek === "reason_required";

  return (
    <Shell>
      <h1 className="font-display text-h2">Žádost o absenci ke schválení</h1>
      <div className="mt-4 rounded border border-line p-4">
        <div className="font-medium">{profile?.name ?? "Zaměstnanec"}</div>
        <div className="mt-1 text-sm">
          {type} · {range}
        </div>
        <div className="text-sm text-muted">
          {req.half_day ? "půlden" : `${days} ${dayWord}`}
        </div>
        {req.note && <div className="mt-2 text-sm text-muted">Poznámka: {req.note}</div>}
      </div>

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
