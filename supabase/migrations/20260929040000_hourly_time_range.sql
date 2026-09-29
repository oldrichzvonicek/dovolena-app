-- Hodinová absence dřív měla jen počet hodin ("4 hodiny ze standardního úvazku 8 h/den") bez informace,
-- KDY přesně během dne bude člověk pryč — pro zastupování a plánování to je to hlavní. Přidává volitelné
-- časové rozmezí; zůstává nepovinné (staré řádky i formuláře bez zadaného rozmezí dál fungují beze změny).
alter table leave_requests add column if not exists start_time time;
alter table leave_requests add column if not exists end_time time;
