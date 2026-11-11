"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/shared/theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === null ? "Loading theme" : theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return <Button type="button" variant="ghost" className="size-11 shrink-0 rounded-lg p-0 motion-reduce:transition-none"
    onClick={toggle} disabled={theme === null} aria-label={label} title={label}>
    {theme === null ? <span aria-hidden="true" className="size-5" /> : theme === "dark"
      ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />}
  </Button>;
}
