// External links the landing page points to. The app lives on its own
// subdomain (app.dodio.cz), separate from this marketing site (dodio.cz).
export const SIGNUP_URL = "https://dodio.cz/registrace";
export const APP_LOGIN_URL = "https://app.dodio.cz/prihlaseni";
export const CONTACT_EMAIL = "info@dodio.cz";

// Prefixed with "/" so these still work when the header renders on a page
// other than the homepage (e.g. /sablona-dochazky-2027) — the browser
// navigates to "/" first and then jumps to the anchor, instead of trying
// to scroll to a section that doesn't exist on the current page.
export const NAV_LINKS = [
  { href: "/#funkce", label: "Pro koho" },
  { href: "/#integrace", label: "Integrace" },
  { href: "/#kalendar", label: "Kalendář" },
  { href: "/#cenik", label: "Ceník" },
  { href: "/#faq", label: "Časté otázky" },
] as const;
