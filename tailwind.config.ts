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
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        lg: "8px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
