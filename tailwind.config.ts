import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16233B",
        paper: "#EEF1F4",
        surface: "#FFFFFF",
        line: "#D7DCE1",
        muted: "#5B6B7C",
        teal: { DEFAULT: "#2C5F6F", light: "#DCE8EA" },
        rust: { DEFAULT: "#B0512D", light: "#F3E2D9" },
        moss: { DEFAULT: "#4B7B4E", light: "#E1EBDE" },
        violet: { DEFAULT: "#6B5B95", light: "#E8E4F0" },
        amber: { DEFAULT: "#C98A2C", light: "#F5E7D0" },
        // Dodio brand tokens (dodio.cz marketing site) — namespaced so they
        // never collide with the app prototype's own placeholder palette
        // above. Values come straight from the Dodio design system.
        dodio: {
          teal: "#0F9D7C",
          "teal-dark": "#085041",
          coral: "#F0997B",
          "coral-dark": "#712B13",
          surface: "#F7F5F0",
          "surface-card": "#FFFFFF",
          ink: "#2C2C2A",
          "ink-muted": "#5F5E5A",
          border: "#D3D1C7",
          warning: "#EF9F27",
          "warning-dark": "#7A4E11",
          danger: "#E24B4A",
          "danger-dark": "#8C2523",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        "dodio-display": ["var(--font-dodio-display)", "system-ui", "sans-serif"],
        "dodio-sans": ["var(--font-dodio-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        lg: "8px",
        "dodio-sm": "4px",
        "dodio-md": "8px",
        "dodio-lg": "16px",
        "dodio-xl": "24px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
