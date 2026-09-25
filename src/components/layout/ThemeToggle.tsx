"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "dodio:theme";

/** Světlý / tmavý vzhled. Volba se pamatuje v prohlížeči; bez volby se používá světlý. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* private mode — volba platí jen do zavření karty */
    }
  }

  return (
    <button onClick={toggle} className="rounded p-2 text-muted hover:bg-white hover:text-ink" aria-label={dark ? "Přepnout na světlý vzhled" : "Přepnout na tmavý vzhled"} title={dark ? "Světlý vzhled" : "Tmavý vzhled"}>
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
