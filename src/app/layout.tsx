import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";

// Dodio brand fonts (dodio.cz marketing site). Loaded via next/font so they're
// self-hosted and don't shift layout; exposed as CSS variables so only the
// marketing components (via the dodio-display/dodio-sans Tailwind tokens)
// pull them in — the app prototype's own Fraunces/IBM Plex Sans is untouched.
const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-dodio-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-dodio-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dodio.cz"),
  title: "Dodio – evidence absencí na pár kliků",
  description:
    "Dodio je správa dovolených a absencí pro malé a střední české firmy. Žádost za tři kliknutí, schválení ve Slacku nebo Teams a export pro mzdy.",
  openGraph: {
    title: "Dodio – evidence absencí na pár kliků",
    description:
      "Správa dovolených a absencí pro malé a střední české firmy. Žádost za tři kliknutí, schválení ve Slacku nebo Teams a export pro mzdy.",
    url: "https://dodio.cz",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // AuthProvider (Supabase) is scoped to the (app) and /login routes that
  // actually need it — see their own layouts/pages — so the marketing site
  // can prerender without Supabase credentials configured.
  return (
    <html lang="cs" className={`${manrope.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
