"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();

  // 사용자별 고유한 아바타 색상 생성
  const getAvatarColor = (text) => {
    if (!text) return "bg-primary";

    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
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
    <header className="fixed top-0 left-0 w-full bg-base-100 shadow-md z-50">
      <div className="container mx-auto navbar px-4">
        <div className="navbar-start">
          <Link href="/" className="text-xl font-bold">
            Shareify
          </Link>
        </div>
        <div className="navbar-center hidden lg:flex">
          {isAuthenticated && (
            <Link href="/dashboard" className="btn btn-ghost">
              대시보드
            </Link>
          )}
        </div>
        <div className="navbar-end">
          {isAuthenticated ? (
            <>
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                  <div
                    className={`w-10 h-10 rounded-full ${getAvatarBgColor()} text-white flex items-center justify-center font-semibold text-sm shadow-md select-none`}
                    style={{
                      lineHeight: "1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {getUserInitial()}
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
