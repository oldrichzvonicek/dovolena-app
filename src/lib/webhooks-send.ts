// Server-only webhook delivery. Kept apart from webhooks.ts (which the browser also imports) because it uses Node's DNS.
import { lookup } from "dns/promises";
import { isIP } from "net";
import https from "node:https";
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

/** Přeloží název serveru a vrátí PRVNÍ veřejnou adresu, nebo důvod odmítnutí. Odmítne, pokud jakákoli adresa míří dovnitř sítě. */
export async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 } | { error: string }> {
  if (isIP(hostname)) return isNonPublicIp(hostname) ? { error: "Adresa míří do privátní sítě." } : { address: hostname, family: isIP(hostname) as 4 | 6 };
  try {
    const addrs = await lookup(hostname, { all: true });
    if (addrs.length === 0) return { error: "Adresa se nepodařilo přeložit." };
    if (addrs.some((x) => isNonPublicIp(x.address))) return { error: "Adresa míří do privátní sítě." };
    return { address: addrs[0].address, family: addrs[0].family as 4 | 6 };
  } catch {
    return { error: "Adresu se nepodařilo přeložit (zkontrolujte název serveru)." };
  }
}

/**
 * HTTPS POST na PŘEDEM OVĚŘENOU adresu: spojení jde na IP, kterou jsme zkontrolovali (název serveru se podruhé nepřekládá),
 * takže útočník nemůže mezi kontrolou a odesláním přepsat DNS na interní adresu (DNS rebinding). Certifikát i SNI
 * se ověřují podle původního názvu. Přesměrování se nesledují.
 */
function postPinned(url: URL, ip: { address: string; family: 4 | 6 }, body: string): Promise<{ status: number; redirected: boolean }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        servername: url.hostname,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: 8000,
        lookup: (_host, options, cb) => {
          if ((options as { all?: boolean } | undefined)?.all) (cb as unknown as (e: null, r: { address: string; family: number }[]) => void)(null, [{ address: ip.address, family: ip.family }]);
          else cb(null, ip.address, ip.family);
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode ?? 0, redirected: (res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400 }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("časový limit")));
    req.on("error", reject);
    req.end(body);
  });
}

export async function postWebhook(provider: WebhookProvider, url: string, text: string): Promise<{ ok: boolean; status: string }> {
  const invalid = validateWebhookUrl(url, provider);
  if (invalid) return { ok: false, status: invalid };
  const parsed = new URL(url);
  const target = await resolvePublicAddress(parsed.hostname);
  if ("error" in target) return { ok: false, status: target.error };
  try {
    const res = await postPinned(parsed, target, JSON.stringify(buildPayload(provider, text)));
    if (res.redirected) return { ok: false, status: "adresa přesměrovává jinam — není to platný webhook, zkontrolujte URL" };
    return res.status >= 200 && res.status < 300 ? { ok: true, status: `OK ${res.status}` } : { ok: false, status: `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, status: msg ? msg.slice(0, 120) : "chyba odeslání" };
  }
}
