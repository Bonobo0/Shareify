"use client";

import { useState, useEffect, useRef } from "react";
import { themeChange } from "theme-change";

export default function ThemeSelector() {
  const [theme, setTheme] = useState();
  const themeRef = useRef(theme);

  useEffect(() => {
    themeChange(false);
  }, []);
  useEffect(() => {
    if (themeRef.current == null) {
      themeRef.current = localStorage.getItem("theme") || "light";
    }
    const theme = themeRef.current;
    setTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <>
      <label className="fixed top-0 right-0 p-4 ">
        <button
          data-act-class="bg-gray-200"
          data-set-theme="cupcake"
          className="rounded-lg p-1 mr-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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
        </button>
        <button
          data-act-class="bg-slate-200"
          data-set-theme="dark"
          className="rounded-lg p-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
      </label>
    </>
  );
}
