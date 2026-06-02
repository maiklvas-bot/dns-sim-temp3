import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type DnsTheme = "dark" | "light";

const STORAGE_KEY = "dns-simcenter-theme";

function readInitialTheme(): DnsTheme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function useDnsTheme() {
  const [theme, setTheme] = useState<DnsTheme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.dnsTheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    themeClass: theme === "light" ? "dns-theme-light" : "dns-theme-dark",
    toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light")),
  };
}

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: DnsTheme;
  onToggle: () => void;
}) {
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="dns-theme-toggle"
      onClick={onToggle}
      title={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
      aria-label={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span>{isLight ? "Тёмная" : "Светлая"}</span>
    </button>
  );
}
