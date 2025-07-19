"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="fixed top-0 left-0 w-full bg-base-100 shadow-md z-50">
      <div className="container mx-auto navbar px-4">
        <div className="navbar-start">
          <Link href="/" className="text-xl font-bold">
            Shareify
          </Link>
        </div>

        <div className="navbar-end">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="btn btn-ghost">
                대시보드
              </Link>
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                  <div className="w-10 rounded-full">
                    <img
                      alt={user?.name || user?.email || "사용자"}
                      onError={(e) => {
                        e.target.onerror = null;
                      }}
                    />
                  </div>
                </label>
                <ul
                  tabIndex={0}
                  className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
                >
                  <li>
                    <Link href="/profile">프로필</Link>
                  </li>
                  <li>
                    <Link href="/settings">설정</Link>
                  </li>
                  <li>
                    <button onClick={logout}>로그아웃</button>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <Link href="/user/signin" className="btn btn-ghost mr-2">
                로그인
              </Link>
              <Link href="/user/signup" className="btn btn-primary">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
