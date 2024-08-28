"use client";

import Link from "next/link";
import { useState } from "react";

export default function Signin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signin = async () => {};

  return (
    <main className="flex min-h-screen flex-col items-center">
      <h1 className="text-4xl font-bold p-16">로그인</h1>
      <div className="flex flex-col max-w-128">
        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="이메일"
            className="input input-lg border-gray-500"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="비밀번호"
            className="input input-lg border-gray-500"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn-lg btn-primary">로그인</button>
        </div>
        <p className="text-gray-500 mt-4">
          계정이 없으신가요?{" "}
          <Link href="/user/signup" className="link-hover link-primary">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  );
}
