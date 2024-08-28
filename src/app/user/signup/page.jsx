"use client";

import Link from "next/link";
import Terms from "@/app/components/terms";
import { useState } from "react";

export default function Signup() {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const signup = async () => {
    if (!terms || !privacy) {
      alert("약관에 동의해주세요.");
      return;
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center">
      <h1 className="text-4xl font-bold p-16">회원가입</h1>
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
          <input
            type="password"
            placeholder="비밀번호 확인"
            className="input input-lg border-gray-500"
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />

          <button className="btn btn-lg btn-primary" onClick={signup}>
            회원가입
          </button>
        </div>
        <Terms
          terms={terms}
          setTerms={setTerms}
          privacy={privacy}
          setPrivacy={setPrivacy}
        />
        <p className="text-gray-500 mt-4">
          이미 계정이 있으신가요?{" "}
          <Link href="/user/signin" className="link-hover link-primary">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
