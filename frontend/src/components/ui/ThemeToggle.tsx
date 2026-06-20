"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("brandefai-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("brandefai-theme", "light");
    }
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 9999,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: isDark ? "#1e293b" : "#ffffff",
        border: `1px solid ${isDark ? "#475569" : "#e5e7eb"}`,
        boxShadow: isDark
          ? "0 4px 24px rgba(0,0,0,0.5)"
          : "0 4px 20px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {isDark
        ? <Sun size={18} style={{ color: "#f59e0b" }} />
        : <Moon size={18} style={{ color: "#64748b" }} />
      }
    </button>
  );
}
