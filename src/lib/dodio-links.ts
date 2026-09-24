// External links the landing page points to. The app lives on its own
// subdomain (app.dodio.cz), separate from this marketing site (dodio.cz).
// The exact registration route is still unconfirmed — the app prototype's
// /login page toggles between sign-in and sign-up, so both point there for
// now; swap SIGNUP_URL to a dedicated route if one gets built later.
export const SIGNUP_URL = "https://app.dodio.cz/login";
export const APP_LOGIN_URL = "https://app.dodio.cz/login";
// Still open per the spec's "Otevřené body k doplnění":
export const DEMO_URL = "[KAM VEDE DEMO]";
export const CONTACT_EMAIL = "[e-mail]@dodio.cz";

export const NAV_LINKS = [
  { href: "#funkce", label: "Funkce" },
  { href: "#kalendar", label: "Kalendář" },
  { href: "#integrace", label: "Integrace" },
  { href: "#cenik", label: "Ceník" },
  { href: "#faq", label: "Časté otázky" },
] as const;
