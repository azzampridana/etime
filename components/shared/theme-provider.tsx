"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const storageKey = "etime.theme";
const ThemeContext = createContext<{ theme: Theme | null; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const preference = useRef<Theme | null>(null);
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const next = preference.current ?? (system.matches ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next === "dark");
      setTheme(next);
    }
    try {
      const saved = localStorage.getItem(storageKey);
      preference.current = saved === "light" || saved === "dark" ? saved : null;
    } catch { /* Storage may be unavailable; use system preference. */ }
    apply();
    function sync(event: StorageEvent) {
      if (event.key !== storageKey && event.key !== null) return;
      try { if (event.storageArea !== window.localStorage) return; } catch { return; }
      preference.current = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
      apply();
    }
    system.addEventListener("change", apply);
    window.addEventListener("storage", sync);
    return () => { system.removeEventListener("change", apply); window.removeEventListener("storage", sync); };
  }, []);

  function toggle() {
    if (theme === null) return;
    const next = theme === "dark" ? "light" : "dark";
    preference.current = next;
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the in-memory selection. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is required.");
  return context;
}
