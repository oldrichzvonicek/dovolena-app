// Server-only webhook delivery. Kept apart from webhooks.ts (which the browser also imports) because it uses Node's DNS.
import { lookup } from "dns/promises";
import { isIP } from "net";
import { buildPayload, validateWebhookUrl, type WebhookProvider } from "@/lib/webhooks";

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses (IPv4 and IPv6). */
export function isNonPublicIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast, reserved
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("fc") || x.startsWith("fd")) return true; // unique local
    if (/^fe[89ab]/.test(x)) return true; // link-local
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (mapped) return isNonPublicIp(mapped[1]);
    return false;
  }
  return true; // not an IP at all — never trust
}

/** Resolves the host and refuses the request when ANY of its addresses is non-public (blocks DNS names pointing inside the network). */
export async function assertPublicHost(hostname: string): Promise<string | null> {
  if (isIP(hostname)) return isNonPublicIp(hostname) ? "Adresa míří do privátní sítě." : null;
  try {
    const addrs = await lookup(hostname, { all: true });
    if (addrs.length === 0) return "Adresa se nepodařilo přeložit.";
    if (addrs.some((a) => isNonPublicIp(a.address))) return "Adresa míří do privátní sítě.";
    return null;
  } catch {
    return "Adresu se nepodařilo přeložit (zkontrolujte název serveru).";
  }
}

export async function postWebhook(provider: WebhookProvider, url: string, text: string): Promise<{ ok: boolean; status: string }> {
  const invalid = validateWebhookUrl(url, provider);
  if (invalid) return { ok: false, status: invalid };
  const blocked = await assertPublicHost(new URL(url).hostname);
  if (blocked) return { ok: false, status: blocked };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(provider, text)),
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return res.ok ? { ok: true, status: `OK ${res.status}` } : { ok: false, status: `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const redirected = /redirect/i.test(msg) || /redirect/i.test(String((e as { cause?: unknown })?.cause ?? ""));
    if (redirected) return { ok: false, status: "adresa přesměrovává jinam — není to platný webhook, zkontrolujte URL" };
    return { ok: false, status: msg ? msg.slice(0, 120) : "chyba odeslání" };
  }
}
