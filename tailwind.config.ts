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
      colors: {
        ink: "#2C2C2A",
        paper: "#F7F5F0", // Dodio "surface" (page background)
        surface: "#FFFFFF", // Dodio "surface-card"
        line: "#D3D1C7", // Dodio "border"
        muted: "#5F5E5A", // Dodio "ink-muted"

        // Leave-type identity colors. Only two brand hues (teal, coral) plus
        // neutral ink carry type identity — kept as separate token names for
        // minimal disruption to existing components, but the hues below are
        // deliberately restrained: two families + one neutral, not five.
        teal: { DEFAULT: "#0F9D7C", dark: "#085041", light: "#DCEEE7" }, // dovolená (brand-teal)
        moss: { DEFAULT: "#4FAF95", dark: "#0B5C49", light: "#E3F3EE" }, // home office (teal family, lighter)
        rust: { DEFAULT: "#5F5E5A", dark: "#2C2C2A", light: "#EAE8E2" }, // sick day (neutral ink, not a bright color)
        violet: { DEFAULT: "#F0997B", dark: "#712B13", light: "#FBE4DA" }, // lékař/ošetřovačka (brand-coral)
        amber: { DEFAULT: "#E0A98A", dark: "#6B3319", light: "#F7E9E0" }, // náhradní volno (coral family, softer)

        // Extra hues for companies that outgrow the original five leave
        // types — kept muted/warm to stay in the same family, not primary/
        // saturated colors that would clash with the restrained palette.
        sky: { DEFAULT: "#5B8DB8", dark: "#1F3F57", light: "#DCE7F0" },
        plum: { DEFAULT: "#9B72AA", dark: "#3D1F47", light: "#EDE1F0" },
        sage: { DEFAULT: "#7A8B5E", dark: "#35401F", light: "#E7ECDD" },
        gold: { DEFAULT: "#C9A227", dark: "#6B5511", light: "#F5EDD1" },
        wine: { DEFAULT: "#A14E5A", dark: "#4A1F26", light: "#F1DEE1" },
        slate: { DEFAULT: "#6B7A8F", dark: "#2E3A47", light: "#E2E7EC" },
        forest: { DEFAULT: "#4C7A52", dark: "#1F3A23", light: "#DEEBE0" },

        // Request-status colors — reserved for status only (pending/rejected),
        // per Dodio's brand principle of not using state colors decoratively.
        warning: { DEFAULT: "#EF9F27", dark: "#7A4E0E", light: "#FCEBD3" }, // pending
        danger: { DEFAULT: "#E24B4A", dark: "#7A1E1D", light: "#FBE0DF" }, // rejected / destructive
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
