-- Jednorázový úklid testovacích firem "QA Test s.r.o." vzniklých při ručním testování.
-- Ochrana leave_types_guard_delete (nesmí se mazat typ Dovolená / Sick Day) by při kaskádovém
-- mazání firmy hlásila chybu, proto ji na dobu úklidu vypneme.
-- Spusťte v Supabase → SQL Editor. Maže jen firmy pojmenované přesně "QA Test s.r.o.".

alter table leave_types disable trigger leave_types_guard_delete;

delete from companies where name = 'QA Test s.r.o.';

alter table leave_types enable trigger leave_types_guard_delete;
