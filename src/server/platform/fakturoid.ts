// Klient Fakturoidu je obecná (neplatformní) infrastruktura — žije v src/server/fakturoid.ts, ať ji smí
// importovat i zákaznická appka (např. samoobslužné zvýšení tarifu), kam se kód z server/platform/* kvůli
// no-restricted-imports (viz .eslintrc.json) jinak nedostane. Tenhle soubor jen zachovává stávající
// relativní importy (./fakturoid) uvnitř server/platform.
export * from "@/server/fakturoid";
