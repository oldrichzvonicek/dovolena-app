// External links the landing page points to. The app lives on its own
// subdomain (app.dodio.cz), separate from this marketing site (dodio.cz).
export const SIGNUP_URL = "https://dodio.cz/registrace";
export const APP_LOGIN_URL = "https://app.dodio.cz/prihlaseni";
export const CONTACT_EMAIL = "info@dodio.cz";

export const NAV_LINKS = [
  { href: "#funkce", label: "Pro koho" },
  { href: "#kalendar", label: "Kalendář" },
  { href: "#integrace", label: "Integrace" },
  { href: "#cenik", label: "Ceník" },
  { href: "#faq", label: "Časté otázky" },
] as const;
