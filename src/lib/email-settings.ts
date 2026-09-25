import { EMAIL_TEMPLATES } from "@/lib/email-templates";

/**
 * Firemní přepínače e-mailů (Nastavení → E-maily). Přepínají se KATEGORIE, ne jednotlivé šablony: dohromady to
 * dává sedm srozumitelných voleb. Upozornění v aplikaci (zvonek) zůstávají vždy; vypíná se jen e-mail.
 * Klíče musí odpovídat SQL (email_category_for_notification, set_email_setting) a cronu /api/cron/daily.
 */
export type EmailCategoryKey = "approver_requests" | "requester_decisions" | "weekly_digest" | "hr_digest" | "reminders" | "help_questions" | "join_pending";

export interface EmailCategory {
  key: EmailCategoryKey;
  label: string;
  description: string;
  /** Kdo přepínač smí měnit: admin vždy, HR jen tam, kde je to uvedeno. */
  hrCanChange: boolean;
  /** Klíče šablon z email-templates.ts, které do kategorie patří. */
  templates: string[];
}

export const EMAIL_CATEGORIES: EmailCategory[] = [
  {
    key: "approver_requests",
    label: "Žádosti ke schválení",
    description: "Schvalovatel dostane e-mail o nové žádosti (s tlačítky Schválit a Zamítnout), o žádosti v blokovaném termínu, o žádosti o zrušení absence a když se za něj žádost přeposílá zástupci.",
    hrCanChange: false,
    templates: ["request_created", "request_blackout", "cancellation_requested", "escalation"],
  },
  {
    key: "requester_decisions",
    label: "Vyřízení žádosti",
    description: "Zaměstnanec dostane e-mail, že jeho žádost byla schválena nebo zamítnuta (i že byla vyřízena žádost o zrušení absence).",
    hrCanChange: false,
    templates: ["request_approved", "request_rejected", "cancellation_resolved"],
  },
  {
    key: "weekly_digest",
    label: "Týdenní přehled pro manažery",
    description: "V pondělí ráno dostanou manažeři a admini přehled: kolik žádostí čeká a kdo tento týden chybí.",
    hrCanChange: false,
    templates: ["weekly_digest"],
  },
  {
    key: "hr_digest",
    label: "Týdenní přehled pro HR",
    description: "Admini a lidé s rolí HR dostanou upozornění na kapacitní rizika a pomalu vyřizované žádosti. Posílá se jen když je co řešit.",
    hrCanChange: true,
    templates: ["hr_digest"],
  },
  {
    key: "reminders",
    label: "Připomínky dovolené",
    description: "Připomínky zaměstnancům: nevyčerpaná dovolená a nabídka naplánovat si delší volno.",
    hrCanChange: true,
    templates: ["vacation_reminder", "wellbeing_reminder"],
  },
  {
    key: "help_questions",
    label: "Dotazy z Nápovědy",
    description: "Manažeři a admini dostanou e-mail, když jim zaměstnanec pošle dotaz z Nápovědy.",
    hrCanChange: false,
    templates: ["help_question"],
  },
  {
    key: "join_pending",
    label: "Noví uživatelé čekají na schválení",
    description: "Admini dostanou e-mail, když se někdo zaregistruje přes odkaz a čeká na schválení.",
    hrCanChange: false,
    templates: ["join_pending"],
  },
];

export const categoryByKey = (key: string | null | undefined) => EMAIL_CATEGORIES.find((c) => c.key === key);

/** Kategorie je zapnutá, pokud ji firma výslovně nevypnula. */
export function isCategoryEnabled(settings: Record<string, unknown> | null | undefined, key: EmailCategoryKey): boolean {
  return settings?.[key] !== false;
}

/** Šablona → její kategorie (nebo undefined u provozních e-mailů, které vypnout nejde). */
export function categoryOfTemplate(templateKey: string): EmailCategory | undefined {
  return EMAIL_CATEGORIES.find((c) => c.templates.includes(templateKey));
}

/** Popisek druhu e-mailu v přehledu odeslaných (kategorie z databáze nebo typ upozornění). */
export function categoryLabel(category: string | null | undefined): string {
  return categoryByKey(category)?.label ?? (category ? category.replace(/_/g, " ") : "—");
}

export type EmailStatus = "sent" | "pending" | "retrying" | "failed";

export const STATUS_LABEL: Record<EmailStatus, string> = {
  sent: "Odesláno",
  pending: "Čeká na odeslání",
  retrying: "Opakuje se",
  failed: "Nedoručeno",
};

/** Šablony, které existují, ale ještě se neposílají (fakturace, právní e-maily …). */
export const PLANNED_TEMPLATES = EMAIL_TEMPLATES.filter((t) => !t.live);
