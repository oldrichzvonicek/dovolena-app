import type { Config } from "tailwindcss";

// Colors, type, spacing and radius below come from the "Dodio" design system
// (brand tokens: brand-teal/brand-coral + warm ink/surface neutrals; warning/
// danger reserved for request status, never used decoratively for a leave
// type). Token names here stay the same as before the rebrand — components
// reference them by these names — but every value now matches Dodio.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Barvy jsou CSS proměnné (viz globals.css) — světlý i tmavý motiv sdílí názvy tokenů.
      colors: {
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        teal: { DEFAULT: "rgb(var(--c-teal) / <alpha-value>)", dark: "rgb(var(--c-teal-dark) / <alpha-value>)", light: "rgb(var(--c-teal-light) / <alpha-value>)" },
        moss: { DEFAULT: "rgb(var(--c-moss) / <alpha-value>)", dark: "rgb(var(--c-moss-dark) / <alpha-value>)", light: "rgb(var(--c-moss-light) / <alpha-value>)" },
        rust: { DEFAULT: "rgb(var(--c-rust) / <alpha-value>)", dark: "rgb(var(--c-rust-dark) / <alpha-value>)", light: "rgb(var(--c-rust-light) / <alpha-value>)" },
        violet: { DEFAULT: "rgb(var(--c-violet) / <alpha-value>)", dark: "rgb(var(--c-violet-dark) / <alpha-value>)", light: "rgb(var(--c-violet-light) / <alpha-value>)" },
        amber: { DEFAULT: "rgb(var(--c-amber) / <alpha-value>)", dark: "rgb(var(--c-amber-dark) / <alpha-value>)", light: "rgb(var(--c-amber-light) / <alpha-value>)" },
        sky: { DEFAULT: "rgb(var(--c-sky) / <alpha-value>)", dark: "rgb(var(--c-sky-dark) / <alpha-value>)", light: "rgb(var(--c-sky-light) / <alpha-value>)" },
        plum: { DEFAULT: "rgb(var(--c-plum) / <alpha-value>)", dark: "rgb(var(--c-plum-dark) / <alpha-value>)", light: "rgb(var(--c-plum-light) / <alpha-value>)" },
        sage: { DEFAULT: "rgb(var(--c-sage) / <alpha-value>)", dark: "rgb(var(--c-sage-dark) / <alpha-value>)", light: "rgb(var(--c-sage-light) / <alpha-value>)" },
        gold: { DEFAULT: "rgb(var(--c-gold) / <alpha-value>)", dark: "rgb(var(--c-gold-dark) / <alpha-value>)", light: "rgb(var(--c-gold-light) / <alpha-value>)" },
        wine: { DEFAULT: "rgb(var(--c-wine) / <alpha-value>)", dark: "rgb(var(--c-wine-dark) / <alpha-value>)", light: "rgb(var(--c-wine-light) / <alpha-value>)" },
        slate: { DEFAULT: "rgb(var(--c-slate) / <alpha-value>)", dark: "rgb(var(--c-slate-dark) / <alpha-value>)", light: "rgb(var(--c-slate-light) / <alpha-value>)" },
        forest: { DEFAULT: "rgb(var(--c-forest) / <alpha-value>)", dark: "rgb(var(--c-forest-dark) / <alpha-value>)", light: "rgb(var(--c-forest-light) / <alpha-value>)" },
        warning: { DEFAULT: "rgb(var(--c-warning) / <alpha-value>)", dark: "rgb(var(--c-warning-dark) / <alpha-value>)", light: "rgb(var(--c-warning-light) / <alpha-value>)" },
        danger: { DEFAULT: "rgb(var(--c-danger) / <alpha-value>)", dark: "rgb(var(--c-danger-dark) / <alpha-value>)", light: "rgb(var(--c-danger-light) / <alpha-value>)" },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      // Dodio's named type scale (size/line-height/weight only — which
      // family each level uses is handled by the existing h1/h2/h3/
      // .font-display rule in globals.css, not duplicated here).
      fontSize: {
        display: ["40px", { lineHeight: "44px", fontWeight: "600" }],
        h1: ["28px", { lineHeight: "34px", fontWeight: "600" }],
        h2: ["20px", { lineHeight: "26px", fontWeight: "500" }],
        body: ["15px", { lineHeight: "22px", fontWeight: "400" }],
        "body-strong": ["15px", { lineHeight: "22px", fontWeight: "500" }],
        caption: ["13px", { lineHeight: "18px", fontWeight: "400" }],
        label: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "16px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
