"use client";

import { useEffect, useState } from "react";
import { Plug, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { EVENT_LABELS, PROVIDER_LABELS, validateWebhookUrl, type WebhookProvider } from "@/lib/webhooks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { cn, errorMessage } from "@/lib/utils";
import { LoadingCard } from "@/components/ui/skeleton";
import { LockedFeature } from "@/components/shared/FeatureGate";
import { flushIntegrationsNow } from "@/lib/integrations-client";
import { useFeatures } from "@/lib/use-features";

interface Row {
  id: string;
  provider: WebhookProvider;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  last_status: string | null;
  last_sent_at: string | null;
}

interface Guide {
  intro: string;
  prerequisites: string[];
  steps: string[];
  verify: string;
  troubleshooting: { problem: string; fix: string }[];
  example: string;
  docs: { href: string; label: string };
}

// Postupy jsou ověřené proti oficiální dokumentaci jednotlivých služeb (stav 09/2026). Názvy tlačítek se v aplikacích
// občas mění a liší se podle jazyka rozhraní — uvádíme anglické názvy tak, jak je dokumentace používá.
const GUIDES: Record<WebhookProvider, Guide> = {
  slack: {
    intro: "Dodio posílá zprávy do jednoho kanálu přes „Incoming Webhook“ vlastní Slack aplikace. Vytvoření trvá asi 3 minuty.",
    prerequisites: ["Právo přidávat aplikace do workspace (u některých firem to schvaluje správce Slacku)."],
    steps: [
      "Otevřete api.slack.com/apps a klikněte na „Create New App“. Zvolte „From scratch“ / „Blank app“, pojmenujte aplikaci „Dodio“ a vyberte svůj workspace („Create App“).",
      "V menu aplikace vlevo vyberte „Incoming Webhooks“ a zapněte přepínač „Activate Incoming Webhooks“.",
      "Dole klikněte na „Add New Webhook to Workspace“, vyberte kanál (např. #absence) a potvrďte tlačítkem „Authorize“ / „Allow“.",
      "V tabulce „Webhook URLs for Your Workspace“ zkopírujte adresu (tlačítko „Copy“) a vložte ji do pole výše. Musí začínat https://hooks.slack.com/services/.",
    ],
    verify: "Klikněte na „Připojit kanál“ a potom u nové integrace na „Zkušební zpráva“. Do vybraného kanálu dorazí zpráva „Dodio: testovací zpráva“.",
    troubleshooting: [
      { problem: "Zkušební zpráva hlásí „Toto není webhook Slacku“ nebo „přesměrovává jinam“", fix: "Vložili jste adresu workspace (…slack.com) nebo jinou stránku. Potřebujete adresu z kroku 4, která začíná hooks.slack.com/services/." },
      { problem: "HTTP 404 nebo 410 při odeslání", fix: "Webhook byl smazán nebo aplikace odebrána z workspace. Vytvořte nový webhook (krok 3) a integraci v Dodiu nahraďte." },
      { problem: "Tlačítko „Add New Webhook to Workspace“ chybí nebo je neaktivní", fix: "Aplikace nemá zapnuté Incoming Webhooks (krok 2), nebo správce workspace schvaluje aplikace — požádejte ho o schválení." },
      { problem: "Chcete jiný kanál", fix: "V nastavení aplikace znovu klikněte na „Add New Webhook to Workspace“ a vyberte kanál. Každý kanál má vlastní adresu; v Dodiu přidejte druhou integraci." },
    ],
    example: "https://hooks.slack.com/services/T…/B…/…",
    docs: { href: "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks", label: "Oficiální dokumentace Slack" },
  },
  teams: {
    intro: "Microsoft ruší starý konektor „Incoming Webhook“. Nový způsob je aplikace Workflows (Power Automate), která vytvoří adresu webhooku pro kanál nebo chat.",
    prerequisites: [
      "Přístup k aplikaci Workflows v Teams (prémiová licence Power Automate se nevyžaduje).",
      "Workflow patří konkrétnímu uživateli — pokud tento člověk odejde z firmy nebo mu skončí účet, přestane fungovat. Přidejte proto ve Power Automate druhého vlastníka.",
    ],
    steps: [
      "V Teams otevřete tým a kanál, kam mají zprávy chodit. Klikněte na ••• (More options) vedle názvu kanálu a zvolte „Workflows“.",
      "Vyhledejte a vyberte šablonu „Send webhook alerts to a channel“ (pro chat „Send webhook alerts to a chat“).",
      "Potvrďte připojení k Teams, vyberte tým a kanál a klikněte na „Save“ / „Add workflow“.",
      "Po vytvoření se zobrazí adresa webhooku. Zkopírujte ji a vložte do pole výše. Později ji najdete v aplikaci Workflows → „Your workflows“ → váš postup.",
    ],
    verify: "Klikněte na „Připojit kanál“ a „Zkušební zpráva“. V kanálu se objeví zpráva od „Workflows“. Doručení může trvat několik sekund.",
    troubleshooting: [
      { problem: "Test hlásí úspěch, ale zpráva se v Teams neobjeví", fix: "Otevřete aplikaci Workflows → „Your workflows“ a zkontrolujte, že je postup zapnutý („Turn on“) a že v historii běhů („Run history“) není chyba, např. vypršené připojení účtu. Připojení obnovíte ve Power Automate." },
      { problem: "Adresa začíná webhook.office.com", fix: "Jde o starý konektor Office 365, který Microsoft ruší. Vytvořte nový Workflow podle kroků výše." },
      { problem: "Šablona „Send webhook alerts to a channel“ není v nabídce", fix: "Použijte jinou šablonu s „webhook“ v názvu, nebo vytvořte postup od začátku s triggerem „When a Teams webhook request is received“." },
      { problem: "Workflows nejsou ve vaší organizaci dostupné", fix: "Správce Microsoft 365 je může zakázat v Teams Admin Center nebo v zásadách Power Automate. Požádejte IT o povolení." },
    ],
    example: "https://prod-xx.westeurope.logic.azure.com:443/workflows/…",
    docs: { href: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook", label: "Oficiální dokumentace Microsoft" },
  },
  mattermost: {
    intro: "Dodio posílá zprávy do zvoleného kanálu přes příchozí webhook Mattermostu.",
    prerequisites: [
      "Správce systému musí mít zapnuté příchozí webhooky: System Console → Integrations → Integration Management → „Enable Incoming Webhooks“.",
      "Váš Mattermost server musí být dostupný z internetu přes https — Dodio odesílá zprávy ze svého serveru. Server jen ve vnitřní síti firmy nebude fungovat.",
    ],
    steps: [
      "V Mattermostu otevřete nabídku produktů (ikona ⋮⋮⋮ vlevo nahoře) → „Integrations“ → „Incoming Webhooks“.",
      "Klikněte na „Add Incoming Webhook“.",
      "Vyplňte název (např. Dodio) a popis a vyberte kanál pro zprávy. Potvrďte tlačítkem „Add“.",
      "Zkopírujte zobrazenou adresu (má tvar https://váš-server/hooks/…) a vložte ji do pole výše.",
    ],
    verify: "Klikněte na „Připojit kanál“ a „Zkušební zpráva“. Zpráva se objeví ve zvoleném kanálu.",
    troubleshooting: [
      { problem: "Nevidíte nabídku Integrations", fix: "Nemáte oprávnění vytvářet integrace, nebo je správce vypnul. Požádejte správce systému." },
      { problem: "HTTP 404 „Invalid webhook“", fix: "Klíč v adrese je chybný nebo byl webhook smazán. Zkopírujte adresu znovu z Integrations → Incoming Webhooks." },
      { problem: "Selhalo: fetch failed / timeout", fix: "Server není dostupný z internetu, má neplatný certifikát nebo blokuje odesílatele. Ověřte adresu v prohlížeči a firewall." },
      { problem: "Zprávy chodí do jiného kanálu", fix: "Kanál se nastavuje u webhooku v Mattermostu (Integrations → Incoming Webhooks → upravit)." },
    ],
    example: "https://chat.vasefirma.cz/hooks/abc123xyz…",
    docs: { href: "https://developers.mattermost.com/integrate/webhooks/incoming/", label: "Oficiální dokumentace Mattermost" },
  },
  discord: {
    intro: "Webhook v Discordu je vázaný na jeden kanál serveru.",
    prerequisites: ["Oprávnění „Manage Webhooks“ (Spravovat webhooky) na serveru nebo v kanálu."],
    steps: [
      "V Discordu otevřete Nastavení serveru → „Integrations“ → „Webhooks“ (případně u kanálu ozubené kolo → „Integrations“ → „Webhooks“).",
      "Klikněte na „New Webhook“ / „Create Webhook“, pojmenujte ho (např. Dodio) a vyberte kanál.",
      "Klikněte na „Copy Webhook URL“, zkopírovanou adresu vložte do pole výše a v Discordu uložte změny.",
    ],
    verify: "Klikněte na „Připojit kanál“ a „Zkušební zpráva“. Zpráva se objeví v kanálu pod jménem webhooku.",
    troubleshooting: [
      { problem: "HTTP 401 nebo 404", fix: "Webhook byl smazán nebo je adresa nekompletní. Zkopírujte ji znovu; tvar je https://discord.com/api/webhooks/číslo/token." },
      { problem: "Adresa unikla", fix: "Discord nedovoluje token změnit. Webhook smažte a vytvořte nový, potom aktualizujte integraci v Dodiu." },
      { problem: "Nevidíte položku Webhooks", fix: "Chybí vám oprávnění „Manage Webhooks“ — požádejte majitele nebo správce serveru." },
    ],
    example: "https://discord.com/api/webhooks/1234567890/abcDEF…",
    docs: { href: "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks", label: "Oficiální nápověda Discord" },
  },
  google_chat: {
    intro: "Příchozí webhook v prostoru Google Chat. Funguje jen s firemním účtem Google Workspace.",
    prerequisites: [
      "Google Workspace (Business nebo Enterprise) — osobní účty Gmail webhooky nemají.",
      "Správce Workspace musí uživatelům povolit „přidávat a používat příchozí webhooky“.",
      "Použijte Chat ve webovém prohlížeči (chat.google.com), v mobilní aplikaci se webhooky nevytvářejí.",
    ],
    steps: [
      "Otevřete chat.google.com a vyberte prostor, kam mají zprávy chodit.",
      "Klikněte na šipku vedle názvu prostoru → „Apps & integrations“ (Aplikace a integrace).",
      "Klikněte na „Add webhooks“, zadejte název (např. Dodio), volitelně adresu avataru, a uložte („Save“).",
      "U vytvořeného webhooku klikněte na „More“ (⋮) → „Copy link“. Vložte celou adresu (včetně částí ?key=…&token=…) do pole výše.",
    ],
    verify: "Klikněte na „Připojit kanál“ a „Zkušební zpráva“. Zpráva se objeví v prostoru pod názvem webhooku.",
    troubleshooting: [
      { problem: "Nevidíte „Add webhooks“", fix: "Nemáte Workspace účet, nebo správce webhooky zakázal. Požádejte administrátora Google Workspace o povolení." },
      { problem: "HTTP 400 nebo 403", fix: "Adresa je neúplná (chybí key nebo token) nebo webhook byl smazán. Zkopírujte odkaz znovu celý." },
      { problem: "Zprávy chodí jen do jedné konverzace", fix: "Webhook je vázaný na prostor, ve kterém byl vytvořen; pro další prostor vytvořte další webhook." },
    ],
    example: "https://chat.googleapis.com/v1/spaces/AAAA…/messages?key=…&token=…",
    docs: { href: "https://developers.google.com/workspace/chat/quickstart/webhooks", label: "Oficiální dokumentace Google Chat" },
  },
  webhook: {
    intro: "Pro Zapier, Make, n8n nebo vlastní službu. Dodio odešle HTTP POST s JSON tělem (Content-Type: application/json).",
    prerequisites: ["Služba musí mít veřejnou https adresu, která přijímá POST požadavky."],
    steps: [
      "Zapier: vytvořte Zap s triggerem „Webhooks by Zapier“ → událost „Catch Hook“. Adresu „Custom Webhook URL“ najdete na záložce „Test“. (Catch Hook vyžaduje placený tarif Zapieru.)",
      "Make: přidejte modul „Webhooks“ → „Custom webhook“, klikněte na „Add“ a zkopírujte vygenerovanou adresu. n8n: uzel „Webhook“ s metodou POST; použijte „Production URL“ a workflow publikujte (aktivujte).",
      "Vložte adresu do pole výše, připojte kanál a klikněte na „Zkušební zpráva“ — služba přijme ukázková data. V Make klikněte před testem na „Run once“ a poté „Redetermine data structure“; v Zapieru „Test trigger“.",
      "Pole „text“ použijte v dalších krocích (e-mail, SMS, tabulka…). Pole „source“ má vždy hodnotu „dodio“.",
    ],
    verify: "Tělo požadavku vypadá takto: {\"text\": \"Jana Nováková — Dovolená (12.–16. 10.)\", \"source\": \"dodio\"}. Po testu byste měli ve službě vidět přijatá data.",
    troubleshooting: [
      { problem: "n8n nevidí data z testu", fix: "Testovací adresa („Test URL“) funguje jen krátce po kliknutí na „Listen for test event“. Pro trvalý provoz použijte „Production URL“ a workflow publikujte." },
      { problem: "Zapier hlásí, že Catch Hook není dostupný", fix: "Trigger je součástí placených tarifů Zapieru (Professional a vyšší)." },
      { problem: "HTTP 4xx", fix: "Služba adresu nezná nebo vyžaduje jinou metodu či autentizaci. Dodio posílá POST bez hlavičky Authorization — použijte adresu s tokenem přímo v URL." },
      { problem: "Dodio hlásí „přesměrovává jinam“", fix: "Adresa přesměrovává (např. http→https nebo jiná doména). Použijte finální adresu, na kterou se dostanete bez přesměrování." },
    ],
    example: "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
    docs: { href: "https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks", label: "Nápověda Zapier (Catch Hook)" },
  },
};

const ALL_EVENTS = Object.keys(EVENT_LABELS);

/** Admin: connect chat channels through incoming webhooks and choose which events are posted there. */
function IntegrationsPanelInner({ canWebhooks }: { canWebhooks: boolean }) {
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<{ ok: boolean; text: string } | null>(null);
  async function sendPending() {
    setFlushing(true);
    setFlushResult(null);
    try {
      const r = await flushIntegrationsNow();
      const parts = [`odesláno ${r.delivered}`, r.failed ? `selhalo ${r.failed}` : "", r.expired ? `zahozeno starých ${r.expired}` : ""].filter(Boolean);
      setFlushResult({ ok: r.failed === 0, text: r.events === 0 ? "Nic k odeslání." : `${parts.join(", ")}${r.lastError ? ` — ${r.lastError}` : ""}` });
      await load();
    } catch (e) {
      setFlushResult({ ok: false, text: errorMessage(e) });
    } finally {
      setFlushing(false);
    }
  }

  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [provider, setProvider] = useState<WebhookProvider>("slack");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["request_created", "request_decided", "daily_digest"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  async function load() {
    const { data, error: err } = await createClient()
      .from("webhook_integrations")
      .select("id, provider, name, url, events, active, last_status, last_sent_at")
      .order("created_at", { ascending: true });
    if (err) {
      setFailed(true);
      return;
    }
    setRows((data as unknown as Row[]) ?? []);
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function add() {
    if (!profile) return;
    const invalid = validateWebhookUrl(url.trim(), provider);
    if (invalid) return setError(invalid);
    if (!name.trim()) return setError("Zadejte název (např. #hr-absence).");
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().from("webhook_integrations").insert({
      company_id: profile.company_id,
      provider,
      name: name.trim(),
      url: url.trim(),
      events,
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    setName("");
    setUrl("");
    load();
  }

  async function update(id: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? prev);
    await createClient().from("webhook_integrations").update(patch).eq("id", id);
  }

  async function remove(r: Row) {
    if (!(await confirmDialog(`Odpojit integraci „${r.name}“ (${PROVIDER_LABELS[r.provider]})?`, { confirmLabel: "Odpojit", danger: true }))) return;
    await createClient().from("webhook_integrations").delete().eq("id", r.id);
    load();
  }

  async function test(r: Row) {
    setTestResult((p) => ({ ...p, [r.id]: { ok: true, text: "Odesílám…" } }));
    try {
      const res = await fetch("/api/integrations/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id }) });
      const data = await res.json();
      setTestResult((p) => ({ ...p, [r.id]: { ok: res.ok, text: res.ok ? "Zkušební zpráva odeslána." : `Selhalo: ${data.error ?? data.status}` } }));
      load();
    } catch (e) {
      setTestResult((p) => ({ ...p, [r.id]: { ok: false, text: errorMessage(e) } }));
    }
  }

  const toggleEvent = (list: string[], ev: string) => (list.includes(ev) ? list.filter((x) => x !== ev) : [...list, ev]);

  if (failed) return <div className="card p-6 text-sm text-muted">Integrace nejsou k dispozici — spusťte aktuální schema.sql.</div>;
  if (!rows) return <LoadingCard rows={4} />;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-light text-sky-dark">
            <Plug size={15} />
          </div>
          <h2 className="font-display text-h2">Napojené kanály</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Dodio pošle vybrané události do chatu přes příchozí webhook. Adresa webhooku je tajná — vidí ji jen admin.</p>

        {rows.length === 0 && <p className="mt-4 text-sm text-muted">Zatím není napojeno nic.</p>}
        {rows.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Button variant="secondary" className="px-3 py-1.5 text-sm" disabled={flushing} onClick={sendPending}>
              <Send size={14} /> {flushing ? "Odesílám…" : "Odeslat čekající zprávy teď"}
            </Button>
            <span className="text-xs text-muted">Zprávy se posílají hned po akci; tohle použijte, když nějaká nedorazila. Zprávy starší než 24 hodin se neposílají.</span>
            {flushResult && <span className={flushResult.ok ? "text-teal-dark" : "text-danger-dark"}>{flushResult.text}</span>}
          </div>
        )}
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className={cn("rounded border border-line p-4", !r.active && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-medium ring-1 ring-line">{PROVIDER_LABELS[r.provider]}</span>
                <span className="text-sm font-medium">{r.name}</span>
                <span className="min-w-0 max-w-[16rem] truncate text-xs text-muted" title="Adresa je skrytá">
                  {r.url.replace(/^(https:\/\/[^/]+\/).*/, "$1…")}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Switch checked={r.active} onCheckedChange={(v) => update(r.id, { active: v })} label={`Aktivní: ${r.name}`} />
                  <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => test(r)}>
                    <Send size={14} /> Zkušební zpráva
                  </Button>
                  <button onClick={() => remove(r)} aria-label={`Odpojit ${r.name}`} className="rounded p-2 text-muted hover:bg-danger-light hover:text-danger">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.events.includes(ev)} onChange={() => update(r.id, { events: toggleEvent(r.events, ev) })} className="h-3.5 w-3.5" />
                    {EVENT_LABELS[ev]}
                  </label>
                ))}
              </div>
              {validateWebhookUrl(r.url, r.provider) && (
                <p className="mt-3 rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">
                  <strong>Zprávy se do tohoto kanálu neposílají — adresa není platná.</strong> {validateWebhookUrl(r.url, r.provider)} Odpojte kanál a přidejte ho znovu se správnou adresou.
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
                {r.last_status && (
                  <span className={cn(!r.last_status.startsWith("OK") && "text-danger-dark")}>
                    Poslední odeslání: {r.last_status}
                    {r.last_sent_at ? ` (${new Date(r.last_sent_at).toLocaleString("cs-CZ")})` : ""}
                  </span>
                )}
                {testResult[r.id] && <span className={testResult[r.id].ok ? "text-teal-dark" : "text-danger-dark"}>{testResult[r.id].text}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-h2">Přidat kanál</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Služba</label>
            <Select value={provider} onValueChange={(v) => setProvider(v as WebhookProvider)}>
              <SelectTrigger aria-label="Služba">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as WebhookProvider[]).map((p) => (
                  <SelectItem key={p} value={p} disabled={p === "webhook" && !canWebhooks}>
                    {PROVIDER_LABELS[p]}
                    {p === "webhook" && !canWebhooks ? " (od tarifu Pro)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Název</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. #hr-absence" className="w-full rounded border border-line px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Adresa webhooku (URL)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" className="w-full rounded border border-line px-3 py-2 text-sm" />
            <p className="mt-1.5 text-xs text-muted">Adresa vypadá takto: {GUIDES[provider].example}</p>
          </div>
          <div className="rounded border border-line bg-paper p-4 sm:col-span-2">
            <div className="text-sm font-medium">Jak propojit {PROVIDER_LABELS[provider]}</div>
            <p className="mt-1 text-sm text-muted">{GUIDES[provider].intro}</p>
            {GUIDES[provider].prerequisites.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">Co potřebujete</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {GUIDES[provider].prerequisites.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Postup</div>
            <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm">
              {GUIDES[provider].steps.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ol>
            <div className="mt-3 rounded bg-white p-3 text-sm ring-1 ring-line">
              <span className="font-medium">Ověření: </span>
              {GUIDES[provider].verify}
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-teal-dark">Něco nefunguje? Nejčastější potíže</summary>
              <dl className="mt-2 space-y-2">
                {GUIDES[provider].troubleshooting.map((t, i) => (
                  <div key={i}>
                    <dt className="font-medium">{t.problem}</dt>
                    <dd className="text-muted">{t.fix}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <a href={GUIDES[provider].docs.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-teal-dark underline">
              {GUIDES[provider].docs.label}
            </a>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-sm font-medium">Co posílat</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {ALL_EVENTS.map((ev) => (
              <label key={ev} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={events.includes(ev)} onChange={() => setEvents((l) => toggleEvent(l, ev))} className="h-3.5 w-3.5" />
                {EVENT_LABELS[ev]}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-danger-dark">{error}</p>}
        <div className="mt-4">
          <Button onClick={add} disabled={busy || !url.trim() || !name.trim()}>
            {busy ? "Přidávám…" : "Připojit kanál"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Integrace do chatů jsou od tarifu Team, obecné webhooky od tarifu Pro. */
export function IntegrationsPanel() {
  const f = useFeatures();
  if (f.loading) return <LoadingCard />;
  if (!f.has("chat_integrations")) {
    return <LockedFeature feature="chat_integrations" description="Nové žádosti, schválení a denní přehled, kdo dnes chybí, se posílají přímo do firemního chatu (Teams, Slack, Discord, Mattermost, Google Chat)." />;
  }
  return <IntegrationsPanelInner canWebhooks={f.has("webhooks")} />;
}
