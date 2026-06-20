"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import ThemeSelector from "./themeSelector";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();

  const getAvatarColor = (text) => {
    if (!text) return "bg-brand-500";
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-violet-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-cyan-500",
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getUserInitial = () => {
    const name = user?.name || user?.email || "U";
    return name.charAt(0).toUpperCase();
  };

  const getAvatarBgColor = () => {
    const identifier = user?.name || user?.email || "default";
    return getAvatarColor(identifier);
  };

  return (
    <header className="glass-header fixed top-0 left-0 w-full z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-base-content"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white">
              S
            </span>
            <span className="hidden sm:inline">Shareify</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden items-center gap-1 lg:flex">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-surface-200 hover:text-base-content"
              >
                대시보드
              </Link>
              <Link
                href="/editor"
                className="rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-surface-200 hover:text-base-content"
              >
                에디터
              </Link>
              <Link
                href="/shared"
                className="rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-surface-200 hover:text-base-content"
              >
                공유된 파일
              </Link>
              <Link
                href="/my-uploads"
                className="rounded-lg px-3 py-2 text-sm font-medium text-base-content/70 transition-colors hover:bg-surface-200 hover:text-base-content"
              >
                내 업로드
              </Link>
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-warning/80 transition-colors hover:bg-surface-200 hover:text-warning"
                >
                  관리자
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeSelector compact />

          {isAuthenticated ? (
            <>
              {/* Mobile menu */}
              <div className="dropdown dropdown-end lg:hidden">
                <label
                  tabIndex={0}
                  className="btn-ghost-sm flex items-center gap-2"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarBgColor()}`}
                  >
                    {getUserInitial()}
                  </div>
                </label>
                <ul
                  tabIndex={0}
                  className="menu-surface mt-2 w-48"
                >
                  <li>
                    <Link href="/dashboard">대시보드</Link>
                  </li>
                  <li>
                    <Link href="/editor">에디터</Link>
                  </li>
                  <li>
                    <Link href="/shared">공유된 파일</Link>
                  </li>
                  <li>
                    <Link href="/my-uploads">내 업로드</Link>
                  </li>
                  <li>
                    <Link href="/profile">프로필</Link>
                  </li>
                  {user?.role === "admin" && (
                    <li>
                      <Link href="/admin">관리자 페이지</Link>
                    </li>
                  )}
                  <li className="divider-subtle my-1">
                    <button onClick={logout} className="text-error">
                      로그아웃
                    </button>
                  </li>
                </ul>
              </div>

              {/* Desktop avatar */}
              <div className="dropdown dropdown-end hidden lg:block">
                <label
                  tabIndex={0}
                  className="cursor-pointer"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-transparent transition-all hover:ring-brand-500/40 ${getAvatarBgColor()}`}
                  >
                    {getUserInitial()}
                  </div>
                </label>
                <ul
                  tabIndex={0}
                  className="menu-surface mt-2 w-48"
                >
                  <li className="px-3 py-2">
                    <p className="text-xs text-base-content/50">로그인됨</p>
                    <p className="truncate text-sm font-medium">
                      {user?.name || user?.email}
                    </p>
                  </li>
                  <li className="divider-subtle my-1"></li>
                  <li>
                    <Link href="/profile">프로필 및 설정</Link>
                  </li>
                  {user?.role === "admin" && (
                    <li>
                      <Link href="/admin">관리자 페이지</Link>
                    </li>
                  )}
                  <li className="divider-subtle my-1">
                    <button onClick={logout} className="text-error">
                      로그아웃
                    </button>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/user/signin"
                className="btn-ghost-sm hidden sm:flex"
              >
                로그인
              </Link>
              <Link href="/user/signup" className="btn-brand text-sm">
                시작하기
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
