// E-mailové pomůcky (fronta, podpis, VS, odkaz na PDF) jsou obecná (neplatformní) infrastruktura — žijí v
// src/server/email.ts, ať je smí importovat i zákaznická appka (např. samoobslužné zvýšení tarifu), kam se
// kód z server/platform/* kvůli no-restricted-imports (viz .eslintrc.json) jinak nedostane. Tenhle soubor
// jen zachovává stávající relativní importy (./email) uvnitř server/platform.
export * from "@/server/email";
