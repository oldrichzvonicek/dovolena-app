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

// Two-column "Řešení" dropdown in the main nav and its mobile accordion
// counterpart. Anchor text here is intentionally shorter/different from the
// same URLs' links elsewhere on the homepage (hero, calendar legend, FAQ,
// footer) — each place uses its own wording, per the no-repeated-anchor rule.
export const SOLUTIONS_MENU = {
  label: "Řešení",
  columns: [
    {
      heading: "Podle typu absence",
      links: [
        { href: "/evidence-absenci", label: "Evidence absencí" },
        { href: "/evidence-dovolene", label: "Dovolená" },
        { href: "/home-office", label: "Home office" },
        { href: "/sick-days", label: "Sick days" },
      ],
    },
    {
      heading: "Podle situace",
      links: [
        { href: "/bez-excelu", label: "Bez Excelu a tabulek" },
        { href: "/pro-male-firmy", label: "Pro malé firmy" },
      ],
    },
  ],
} as const;
