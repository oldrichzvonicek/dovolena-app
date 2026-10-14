-- Fakturoid: faktury se vystavují automaticky (cron super-adminu) a platby se přijímají webhookem invoice_paid.
-- Sloupce o původu faktury, jejím období a identifikátoru ve Fakturoidu; unikátní index brání dvojí faktuře za totéž období.
alter table company_invoices add column if not exists fakturoid_id bigint;
alter table company_invoices add column if not exists variable_symbol text;
alter table company_invoices add column if not exists period_from date;   -- začátek období, které faktura pokrývá
alter table company_invoices add column if not exists period_to date;     -- poslední zaplacený den (nový plan_paid_until)
alter table company_invoices add column if not exists source text not null default 'manual';

create unique index if not exists company_invoices_fakturoid_id_idx on company_invoices (fakturoid_id) where fakturoid_id is not null;
create unique index if not exists company_invoices_company_period_idx on company_invoices (company_id, period_from) where period_from is not null and status <> 'void';
