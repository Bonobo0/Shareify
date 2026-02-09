"use client";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

export default function ThemeSelector({ compact = false }) {
  const [currentTheme, setCurrentTheme] = useState("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 저장된 테마가 있으면 사용, 없으면 dark 사용
    const savedTheme = localStorage.getItem("theme") || "dark";
    setCurrentTheme(savedTheme);

    // HTML 태그와 body에 테마 적용
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.body.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = currentTheme === "light" ? "dark" : "light";
    setCurrentTheme(newTheme);

    // HTML 태그와 body에 테마 적용
    document.documentElement.setAttribute("data-theme", newTheme);
    document.body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  // 마운트 되기 전에는 기본 아이콘 표시
  if (!mounted) {
    return compact ? (
      <div className="btn btn-ghost btn-circle">
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
      </div>
    ) : (
      <div className="skeleton h-20 w-full"></div>
    );
  }

  // 간단한 버전 (헤더용)
  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        className="btn btn-ghost btn-circle"
        title={`${currentTheme === "light" ? "다크" : "라이트"} 모드로 전환`}
      >
        {currentTheme === "dark" ? (
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
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
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
        )}
      </button>
    );
  }

  // 프로파일 페이지용 전체 버전
  return (
    <div className="space-y-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">
            현재 테마: {currentTheme === "light" ? "라이트 모드" : "다크 모드"}
          </span>
        </label>
      </div>

      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-4">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={currentTheme === "dark"}
            onChange={toggleTheme}
          />
          <span className="label-text flex items-center gap-2">
            {currentTheme === "light" ? (
              <>
                <span><FontAwesomeIcon icon={faSun} /></span>
                <span>라이트 모드</span>
              </>
            ) : (
              <>
                <span><FontAwesomeIcon icon={faMoon} /></span>
                <span>다크 모드</span>
              </>
            )}
          </span>
        </label>
      </div>
    </div>
  );
}
