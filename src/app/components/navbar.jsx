"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="navbar bg-base-100 fixed top-0 z-10 shadow-md">
      <div className="navbar-start">
        <Link href="/" className="btn btn-ghost text-xl">
          Shareify
        </Link>
      </div>

      <div className="navbar-end">
        {user ? (
          <>
            <Link href="/dashboard" className="btn btn-ghost">
              대시보드
            </Link>
            <Link href="/shared" className="btn btn-ghost">
              공유된 파일
            </Link>
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                <div className="w-10 rounded-full">
                  <img
                    src={user.profileImage || "/profile-placeholder.png"}
                    alt={user.name || user.email}
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
            <Link href="/user/signin" className="btn btn-ghost">
              로그인
            </Link>
            <Link href="/user/signup" className="btn btn-primary">
              회원가입
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
