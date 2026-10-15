-- Žádost o hodnocení po pozitivním momentu (30 dní používání NEBO 20 schválených žádostí, cokoli nastane dřív) —
-- jen jednou za firmu, primárnímu adminovi. Žádný selektivní filtr podle spokojenosti (Google review-gating to
-- zakazuje): nejdřív krátká NPS otázka (detractor/passive/promoter), odkazy na hodnocení se ukážou stejně všem,
-- bez ohledu na odpověď — viz src/app/hodnoceni/page.tsx a src/app/api/nps/route.ts.
alter table companies add column if not exists review_request_sent_at timestamptz;

create table if not exists nps_responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  bucket text not null check (bucket in ('detractor', 'passive', 'promoter')),
  created_at timestamptz not null default now(),
  unique (company_id)
);
alter table nps_responses enable row level security;
revoke all on nps_responses from public, anon, authenticated;
