# Dovolená APP — scaffold

Working prototype of the leave-management portal described in the spec:
Dashboard, Team Calendar (Gantt-style), Manager Approvals, and Admin/Exports,
plus stub pages for My Requests, My Team, and Company Settings.

`/` is the **dodio.cz marketing landing page** (see below) — the app itself
lives at `/dashboard`, `/calendar`, etc.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000 for the landing page, or http://localhost:3000/dashboard
for the app prototype (requires `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` — without them the app pages
still run in dev, but `npm run build` fails to prerender them; the landing
page and legal pages don't need Supabase at all).

## Landing page (dodio.cz)

The marketing site is `src/app/page.tsx` plus the section components in
`src/components/marketing/`. It's built to the landing page spec: 10
sections, Manrope/Inter via `next/font`, Dodio's own brand tokens, and a
static build (`output` is the Next.js default — no server features used).

- **Pricing is config-driven**: `src/lib/dodio-pricing.ts` is the only place
  prices, user limits and the yearly discount live. Change a number there;
  no component needs touching.
- **Placeholder links**: `src/lib/dodio-links.ts` holds the registration/app
  URLs, the demo destination and the contact email — all still bracketed
  placeholders (`[URL REGISTRACE]` etc.) pending the answers in the spec's
  "Otevřené body k doplnění". Same for the VAT note and the Slack/Teams
  add-on price inside the pricing section, and the placeholder text on
  `/obchodni-podminky` and `/ochrana-osobnich-udaju`.
- **Brand tokens**: added to `tailwind.config.ts` under the `dodio-*`
  namespace (`bg-dodio-teal`, `text-dodio-ink`, `rounded-dodio-lg`, …) so
  they don't collide with the app prototype's own placeholder palette
  (`ink`, `surface`, `teal`, etc. — an earlier, different color scheme).
  Fonts work the same way: `font-dodio-display`/`font-dodio-sans` pull from
  CSS variables set by `next/font` in the root layout, separate from the
  app's own Fraunces/IBM Plex Sans.
- **Deploying**: Vercel, per the spec. Set the Supabase env vars above so the
  full `npm run build` succeeds (the app pages need them even though the
  landing page doesn't), point `dodio.cz` (and `www` → apex redirect) at the
  project, and fill in the placeholders above before launch.

Then open http://localhost:3000 — it redirects to `/dashboard`.

## What's real vs. mocked

- **UI and logic are functional**: the working-day calculator in
  `src/lib/working-days.ts` actually excludes weekends and computes Czech
  state holidays (including Easter/Good Friday via the Gregorian algorithm),
  the collision warning in the request modal checks real overlaps, and the
  manager approve/reject flow updates state live.
- **Data is mocked** in `src/lib/mock-data.ts` (5 employees, 3 departments,
  6 sample leave requests) — there's no database yet. Swapping in Supabase
  means replacing the mock-data reads with queries against the
  `leave_requests` / `users` / `departments` tables from the spec's data
  model, and wiring `RequestLeaveModal`'s `handleSubmit` and
  `PendingApprovals`' `approve`/`reject` to real mutations.
- **Auth is stubbed**: `currentUser` in mock-data.ts is hardcoded to a
  manager so both employee and manager views are reachable. Real auth
  (Supabase email/Google/Microsoft SSO) isn't wired in.
- **Teams/Slack integration, iCal sync, and daily digest** are not built —
  those live outside this web portal (Slack Bolt app, Teams Adaptive Cards).

## Design decisions worth knowing about

- Deliberately avoided the generic "SaaS card" look (uniform rounded
  corners + drop shadow on everything) — cards use a single hairline
  border and no shadow instead.
- Type pairing: Fraunces (display) + IBM Plex Sans (body/UI) — chosen partly
  for Plex Sans's clean Czech diacritic rendering.
- Absence-type colors are semantic, not decorative: teal/rust/moss/violet/
  amber map 1:1 to vacation/sick/home-office/medical/pending across the
  calendar, badges, and legend.

## Known gaps to resolve before this is production-ready

- No carry-over / expiry rules for unused vacation days.
- No audit trail entity (who approved/rejected what, when).
- "Zastupování" (covering colleague) is stored as a flat field on the
  request — fine for display, but if you'll ever query "who is covering for
  X" it should be a proper relation.
