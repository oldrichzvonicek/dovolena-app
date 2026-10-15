// Fakturační matematika je obecná (neplatformní) infrastruktura — žije v src/server/billing.ts, ať ji smí
// importovat i zákaznická appka (např. samoobslužné zvýšení tarifu), kam se kód z server/platform/* kvůli
// no-restricted-imports (viz .eslintrc.json) jinak nedostane. Tenhle soubor jen zachovává stávající
// relativní importy (./billing) uvnitř server/platform.
export * from "@/server/billing";
