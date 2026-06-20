"use client";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

export default function ThemeSelector({ compact = false }) {
  const [currentTheme, setCurrentTheme] = useState("shareify");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") || "shareify";
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme =
      currentTheme === "shareify" ? "shareify-light" : "shareify";
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  if (!mounted) {
    return compact ? (
      <div className="btn-ghost-sm">
        <div className="h-5 w-5 animate-pulse rounded-full bg-surface-300" />
      </div>
    ) : null;
  }

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        className="btn-ghost-sm"
        title={
          currentTheme === "shareify"
            ? "라이트 모드로 전환"
            : "다크 모드로 전환"
        }
      >
        {currentTheme === "shareify" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-base-content/50">테마</span>
      <button
        onClick={toggleTheme}
        className="relative flex h-7 w-12 items-center rounded-full bg-surface-300 p-0.5 transition-colors duration-200"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition-transform duration-200 ${
            currentTheme === "shareify"
              ? "translate-x-0"
              : "translate-x-5"
          }`}
        >
          <FontAwesomeIcon
            icon={currentTheme === "shareify" ? faMoon : faSun}
            className="text-xs"
          />
        </span>
      </button>
    </div>
  );
}
