import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Klient API Fakturoidu v3 (https://www.fakturoid.cz/api/v3). Přihlášení OAuth2 client_credentials, odběratelé, faktury,
 * PDF a webhook invoice_paid. Bez proměnných FAKTUROID_* se nic nevolá (fakturoidConfig() vrací null).
 */
const BASE = "https://app.fakturoid.cz/api/v3";
const userAgent = (cfg: FakturoidConfig) => `Dodio (${cfg.contactEmail ?? "podpora@dodio.cz"})`;

export interface FakturoidConfig {
  slug: string;
  clientId: string;
  clientSecret: string;
  /** E-mail do User-Agentu (Fakturoid ho vyžaduje); výchozí podpora@dodio.cz. */
  contactEmail?: string;
  /** Token z FAKTUROID_WEBHOOK_TOKEN; bez něj se odvodí z client secretu. */
  webhookToken?: string;
}

export function fakturoidConfig(env: Record<string, string | undefined> = process.env): FakturoidConfig | null {
  // Název proměnné se slugem: FAKTUROID_ACCOUNT, případně FAKTUROID_SLUG.
  const slug = (env.FAKTUROID_ACCOUNT ?? env.FAKTUROID_SLUG)?.trim();
  const clientId = env.FAKTUROID_CLIENT_ID?.trim();
  const clientSecret = env.FAKTUROID_CLIENT_SECRET?.trim();
  if (!slug || !clientId || !clientSecret) return null;
  return { slug, clientId, clientSecret, contactEmail: env.FAKTUROID_CONTACT_EMAIL?.trim() || undefined, webhookToken: env.FAKTUROID_WEBHOOK_TOKEN?.trim() || undefined };
}

/** Tajný token webhooku: FAKTUROID_WEBHOOK_TOKEN, jinak se odvodí z client secretu. */
export function webhookToken(cfg: FakturoidConfig): string {
  if (cfg.webhookToken) return cfg.webhookToken;
  return createHmac("sha256", cfg.clientSecret).update("dodio-fakturoid-webhook").digest("hex");
}

export function isValidWebhookAuth(header: string | null, cfg: FakturoidConfig): boolean {
  const expected = Buffer.from(`Bearer ${webhookToken(cfg)}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

let cached: { token: string; until: number; key: string } | null = null;

async function accessToken(cfg: FakturoidConfig): Promise<string> {
  const key = `${cfg.clientId}:${cfg.slug}`;
  if (cached && cached.key === key && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": userAgent(cfg),
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Fakturoid přihlášení selhalo (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cached = { token: json.access_token, until: Date.now() + (json.expires_in ?? 7200) * 1000, key };
  return json.access_token;
}

async function api(cfg: FakturoidConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(cfg);
  return fetch(`${BASE}/accounts/${cfg.slug}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", "User-Agent": userAgent(cfg), ...(init.headers ?? {}) },
  });
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`Fakturoid: ${what} selhalo (${res.status}) ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export interface Buyer {
  customId: string;
  name: string;
  ico: string | null;
  dic: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  email: string | null;
}

/** Odběratel ve Fakturoidu: hledá se podle custom_id (id firmy), jinak se založí. */
export async function ensureSubject(cfg: FakturoidConfig, b: Buyer): Promise<number> {
  const found = await json<{ id: number }[]>(await api(cfg, `/subjects.json?custom_id=${encodeURIComponent(b.customId)}`), "hledání odběratele");
  if (found[0]?.id) return found[0].id;
  const created = await json<{ id: number }>(
    await api(cfg, "/subjects.json", {
      method: "POST",
      body: JSON.stringify({ custom_id: b.customId, name: b.name, registration_no: b.ico, vat_no: b.dic, street: b.street, city: b.city, zip: b.zip, country: "CZ", email: b.email }),
    }),
    "založení odběratele"
  );
  return created.id;
}

/** Je účet plátce DPH? Podle toho se na řádky dává sazba. */
export async function isVatPayer(cfg: FakturoidConfig): Promise<boolean> {
  const account = await json<{ vat_mode?: string }>(await api(cfg, "/account.json"), "načtení účtu");
  return account.vat_mode === "vat_payer";
}

export interface InvoiceInput {
  subjectId: number;
  customId: string;
  name: string;
  amount: number;
  vatPayer: boolean;
  dueDays?: number;
  note?: string;
}

/** Tělo požadavku na vytvoření faktury. Ceník je konečná cena zákazníka, u plátce DPH se proto počítá „z celku s DPH“. */
export function buildInvoicePayload(i: InvoiceInput) {
  return {
    subject_id: i.subjectId,
    custom_id: i.customId,
    payment_method: "bank",
    due: i.dueDays ?? 14,
    language: "cz",
    currency: "CZK",
    ...(i.vatPayer ? { vat_price_mode: "from_total_with_vat" } : {}),
    ...(i.note ? { note: i.note } : {}),
    lines: [{ name: i.name, quantity: "1", unit_name: "", unit_price: String(i.amount), ...(i.vatPayer ? { vat_rate: 21 } : {}) }],
  };
}

export interface FakturoidInvoice {
  id: number;
  number: string;
  variableSymbol: string;
  issuedOn: string;
  dueOn: string;
  total: number;
  vat: number;
  status: string;
  customId: string | null;
  /** Datum zaplacení (YYYY-MM-DD), když je faktura zaplacená. */
  paidOn: string | null;
}

export function parseInvoice(j: Record<string, unknown>): FakturoidInvoice {
  const total = Number(j.total ?? j.native_total ?? 0);
  const subtotal = Number(j.subtotal ?? j.native_subtotal ?? total);
  return {
    id: Number(j.id),
    number: String(j.number ?? ""),
    variableSymbol: String(j.variable_symbol ?? ""),
    issuedOn: String(j.issued_on ?? ""),
    dueOn: String(j.due_on ?? ""),
    total,
    vat: Math.max(0, Math.round((total - subtotal) * 100) / 100),
    status: String(j.status ?? ""),
    customId: j.custom_id ? String(j.custom_id) : null,
    paidOn: j.paid_at ? String(j.paid_at).slice(0, 10) : j.paid_on ? String(j.paid_on).slice(0, 10) : null,
  };
}

/** Faktura podle custom_id (kvůli idempotenci: za jedno období nikdy dvě). */
export async function findInvoiceByCustomId(cfg: FakturoidConfig, customId: string): Promise<FakturoidInvoice | null> {
  const list = await json<Record<string, unknown>[]>(await api(cfg, `/invoices.json?custom_id=${encodeURIComponent(customId)}`), "hledání faktury");
  return list[0] ? parseInvoice(list[0]) : null;
}

export async function getInvoice(cfg: FakturoidConfig, id: number): Promise<FakturoidInvoice> {
  return parseInvoice(await json<Record<string, unknown>>(await api(cfg, `/invoices/${id}.json`), "načtení faktury"));
}

export async function createInvoice(cfg: FakturoidConfig, input: InvoiceInput): Promise<FakturoidInvoice> {
  const created = await json<Record<string, unknown>>(await api(cfg, "/invoices.json", { method: "POST", body: JSON.stringify(buildInvoicePayload(input)) }), "vytvoření faktury");
  return parseInvoice(created);
}

/** PDF faktury; Fakturoid ho může generovat chvíli (204), proto několik pokusů. */
export async function downloadPdf(cfg: FakturoidConfig, invoiceId: number, attempts = 5): Promise<Uint8Array> {
  for (let i = 0; i < attempts; i++) {
    const res = await api(cfg, `/invoices/${invoiceId}/download.pdf`, { headers: { Accept: "application/pdf" } });
    if (res.status === 200) return new Uint8Array(await res.arrayBuffer());
    if (res.status !== 204 && res.status !== 404) throw new Error(`Fakturoid: stažení PDF selhalo (${res.status})`);
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error("Fakturoid: PDF faktury se nepodařilo získat včas");
}

/** Zaregistruje webhook invoice_paid na naši adresu, pokud tam ještě není (automaticky, bez ručního nastavování). */
export async function ensureWebhook(cfg: FakturoidConfig, url: string): Promise<boolean> {
  const hooks = await json<{ webhook_url: string; events: string[]; active: boolean }[]>(await api(cfg, "/webhooks.json"), "načtení webhooků");
  if (hooks.some((h) => h.webhook_url === url && h.active && h.events.includes("invoice_paid"))) return false;
  await json(await api(cfg, "/webhooks.json", { method: "POST", body: JSON.stringify({ webhook_url: url, auth_header: `Bearer ${webhookToken(cfg)}`, events: ["invoice_paid"] }) }), "registrace webhooku");
  return true;
}
