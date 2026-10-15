import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRequest, tooManyRequests } from "@/lib/rate-limit";
import { PLAN_ORDER, planByKey } from "@/lib/plans";
import { addDaysIso, changeKind, overLimitBy, quoteUpgrade } from "@/lib/plan-change";
import { templateText } from "@/lib/email-templates";
import { extendPaidUntil, formatCzDate, periodAmount, todayIso } from "@/server/billing";
import { BANK_ACCOUNT, SIGNATURE, invoicePdfLink, pdfTrailer, queueCompanyEmail, variableSymbol } from "@/server/email";
import { createInvoice, downloadPdf, ensureSubject, fakturoidConfig, isVatPayer } from "@/server/fakturoid";

export const dynamic = "force-dynamic";

/** Stejný tvar řádku jako writeAudit() v server/platform/auth.ts — ten se sem kvůli no-restricted-imports
 * importovat nesmí (zákaznická appka), takže se zapisuje přímo stejnou service-role instancí. */
async function logAudit(db: ReturnType<typeof createAdminClient>, entry: { action: string; result?: "ok" | "error"; companyId: string; companyLabel: string; actorUserId: string; actorLabel: string; details: Record<string, unknown> }) {
  const { error } = await db.from("platform_audit_log").insert({
    actor_type: "admin",
    via_impersonation: false,
    actor_id: entry.actorUserId,
    actor_label: entry.actorLabel,
    action: entry.action,
    result: entry.result ?? "ok",
    company_id: entry.companyId,
    company_label: entry.companyLabel,
    details: entry.details,
  });
  if (error) console.error("platform audit:", error.message);
}

/**
 * Samoobslužné zvýšení tarifu: firemní admin žádá rovnou tady (dřív jen mailto na obchod a provozovatel to
 * vyřizoval ručně). Vystaví fakturu na doplatek (kredit za nevyužité období ze starého tarifu, viz
 * src/lib/plan-change.ts) a teprve PO úspěšném vystavení přepne tarif — nikdy ne naopak, ať nemůže nastat stav
 * "vyšší tarif, žádná faktura". Snížení tarifu zůstává přes schedule_plan_downgrade (RPC), beze změny.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { plan?: unknown; period?: unknown } | null;
  const targetKey = body?.plan;
  const period = body?.period === "yearly" ? "yearly" : "monthly";
  if (typeof targetKey !== "string" || !(PLAN_ORDER as string[]).includes(targetKey)) {
    return NextResponse.json({ error: "Neznámý tarif." }, { status: 400 });
  }

  const supabase = await createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role, company_id, email").eq("id", user.id).single();
  if (!caller || caller.role !== "admin") return NextResponse.json({ error: "Jen admin firmy může měnit tarif." }, { status: 403 });
  if (!(await allowRequest(`upgrade-plan:${user.id}`, 5, 60))) return tooManyRequests();

  const db = createAdminClient();
  const { data: companyRow } = await db.from("companies").select("id, name, plan, billing_period, plan_paid_until, discount_pct, addons, status, is_test").eq("id", caller.company_id).single();
  if (!companyRow) return NextResponse.json({ error: "Firma nebyla nalezena." }, { status: 404 });
  if (companyRow.status !== "active") return NextResponse.json({ error: "Firma není aktivní, napište nám." }, { status: 409 });
  const company = companyRow;
  const userId = user.id;
  const callerLabel = `firemní admin: ${caller.email ?? user.email}`;

  const fromPlan = planByKey(company.plan);
  const toPlan = planByKey(targetKey);
  if (changeKind(fromPlan.key, toPlan.key) !== "upgrade") return NextResponse.json({ error: "Tohle není zvýšení tarifu." }, { status: 400 });

  const { count: employees } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("active", true).eq("is_demo", false);
  const users = employees ?? 0;
  const over = overLimitBy(toPlan.key, users);
  if (over > 0) return NextResponse.json({ error: `Tarif ${toPlan.name} je pro max. ${toPlan.employeeLimit} uživatelů, ve firmě jich máte ${users}.` }, { status: 400 });

  const { data: billing } = await db.from("company_billing").select("billing_name, billing_ico, billing_dic, billing_street, billing_city, billing_zip, billing_email, payment_method").eq("company_id", company.id).maybeSingle();
  if (!billing?.billing_name) return NextResponse.json({ error: "Nejdřív doplňte fakturační údaje (Nastavení firmy → Fakturace)." }, { status: 400 });
  if ((billing.payment_method ?? "invoice") !== "invoice") return NextResponse.json({ error: "Platba kartou zatím není dostupná, napište nám." }, { status: 400 });

  const cfg = fakturoidConfig();
  if (!cfg) return NextResponse.json({ error: "Platby teď nejdou zpracovat automaticky, napište nám." }, { status: 503 });

  const today = todayIso();
  const quote = quoteUpgrade({ from: fromPlan, to: toPlan, users, period, paidUntil: company.plan_paid_until, today });
  // Bez zbývajícího zaplaceného období se nemá co kreditovat — účtuje se celé nové období jako nový odběr,
  // od dneška (stejně jako by to udělala běžná pravidelná fakturace v autobilling.ts).
  const amount = quote ? quote.toPay : periodAmount({ plan: toPlan.key, addons: company.addons, billingPeriod: period, users, discountPct: company.discount_pct });
  const newPaidUntil = quote ? company.plan_paid_until : extendPaidUntil(company.plan_paid_until, today, period);

  async function applyPlan(invoiceNumber: string | null) {
    await db.from("companies").update({ plan: toPlan.key, billing_period: period, plan_paid_until: newPaidUntil, pending_plan: null, pending_plan_from: null, pending_plan_notified: false }).eq("id", company.id);
    await logAudit(db, {
      action: "plan.change",
      companyId: company.id,
      companyLabel: company.name,
      actorUserId: userId,
      actorLabel: callerLabel,
      details: { from: fromPlan.key, to: toPlan.key, period, amount, invoice: invoiceNumber },
    });
  }

  // Testovací firmy se (stejně jako v autobilling.ts) nikdy nefakturují přes živé Fakturoid API.
  if (amount <= 0 || company.is_test) {
    await applyPlan(null);
    return NextResponse.json({ ok: true, plan: toPlan.key, amount: 0 });
  }

  try {
    const vatPayer = await isVatPayer(cfg);
    const subjectId = await ensureSubject(cfg, {
      customId: company.id,
      name: billing.billing_name,
      ico: billing.billing_ico,
      dic: billing.billing_dic,
      street: billing.billing_street,
      city: billing.billing_city,
      zip: billing.billing_zip,
      email: billing.billing_email,
    });
    const inv = await createInvoice(cfg, {
      subjectId,
      customId: `${company.id}:upgrade:${today}`,
      name: `Dodio — přechod na tarif ${toPlan.name}${quote ? ", doplatek za zbývající období" : ""}`,
      amount,
      vatPayer,
    });
    const pdf = await downloadPdf(cfg, inv.id);
    const path = `${company.id}/${inv.number.replace(/[^\w.-]/g, "_")}.pdf`;
    const { error: upErr } = await db.storage.from("company-invoices").upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`uložení PDF: ${upErr.message}`);

    const { error: insErr } = await db.from("company_invoices").insert({
      company_id: company.id,
      number: inv.number,
      issue_date: inv.issuedOn || today,
      due_at: inv.dueOn || addDaysIso(today, 14),
      amount: inv.total || amount,
      vat: inv.vat,
      currency: "CZK",
      status: "issued",
      buyer_snapshot: { name: billing.billing_name, ico: billing.billing_ico, dic: billing.billing_dic, street: billing.billing_street, city: billing.billing_city, zip: billing.billing_zip },
      file_url: path,
      fakturoid_id: inv.id,
      variable_symbol: inv.variableSymbol || variableSymbol(inv.number),
      source: "fakturoid",
    });
    if (insErr) throw new Error(`zápis faktury: ${insErr.message}`);

    // Teprve TEĎ, po úspěšném vystavení faktury, se smí tarif skutečně přepnout.
    await applyPlan(inv.number);

    const mail = templateText("invoice_issued", {
      cislo: inv.number,
      castka: `${Math.round(inv.total || amount).toLocaleString("cs-CZ")} Kč`,
      splatnost: formatCzDate(inv.dueOn),
      ucet: BANK_ACCOUNT,
      vs: inv.variableSymbol || variableSymbol(inv.number),
      pdf: "ano",
      qr: `${inv.total || amount}|${(inv.variableSymbol || variableSymbol(inv.number)).replace(/\D/g, "")}`,
    });
    await queueCompanyEmail(company.id, mail.subject, `${mail.body}${SIGNATURE}${pdfTrailer(await invoicePdfLink(path))}`);
    await logAudit(db, { action: "invoice.create", companyId: company.id, companyLabel: company.name, actorUserId: userId, actorLabel: callerLabel, details: { number: inv.number, amount: inv.total || amount, source: "fakturoid", kind: "upgrade" } });

    return NextResponse.json({ ok: true, plan: toPlan.key, amount: inv.total || amount, invoiceNumber: inv.number });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAudit(db, { action: "invoice.create", result: "error", companyId: company.id, companyLabel: company.name, actorUserId: userId, actorLabel: callerLabel, details: { source: "fakturoid", kind: "upgrade", error: message } });
    return NextResponse.json({ error: "Fakturu se nepodařilo vystavit, zkuste to prosím později nebo nám napište." }, { status: 502 });
  }
}
