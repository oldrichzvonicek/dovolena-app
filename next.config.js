const isDev = process.env.NODE_ENV !== "production";

// Adresa Supabase projektu: jediný externí server, na který prohlížeč smí volat (API, přihlášení, úložiště loga).
let supabaseHost = "";
try {
  supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host;
} catch {
  // bez adresy (např. při sestavení bez .env) se povolí jen vlastní doména
}

/**
 * Content-Security-Policy. Next.js potřebuje inline skripty (hydratace) a React inline styly, proto 'unsafe-inline';
 * hlavní přínos je jinde: žádné cizí skripty, žádné vkládání stránky do cizích rámů, žádné cizí formuláře,
 * žádné <base>, žádné pluginy a spojení jen na vlastní doménu a Supabase.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Odkazy pro schválení z e-mailu nesmí prozradit token v hlavičce Referer ani se ukládat do mezipaměti.
      { source: "/approve/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
  webpack: (config, { dev }) => {
    // Windows + antivirus real-time scanning frequently locks the webpack
    // persistent cache's .pack.gz files mid-rename (ENOENT), corrupting the
    // dev build and causing pages/navigation to silently stop working until
    // .next is deleted. Disabling the on-disk cache in dev trades a little
    // rebuild speed for not hitting this.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
