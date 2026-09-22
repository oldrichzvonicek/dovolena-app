# Dovolená APP — scaffold

Working prototype of the leave-management portal described in the spec:
Dashboard, Team Calendar (Gantt-style), Manager Approvals, and Admin/Exports,
plus stub pages for My Requests, My Team, and Company Settings.

## Run it

```bash
npm install
npm run dev
```

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
