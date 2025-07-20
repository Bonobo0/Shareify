"use client";

import Link from "next/link";
import Terms from "@/app/components/terms";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Signup() {
  const router = useRouter();
  const {
    signup: authSignup,
    isAuthenticated,
    loading: authLoading,
    refreshUser,
  } = useAuth();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 이미 로그인된 경우 대시보드로 이동
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  const signup = async (e) => {
    e.preventDefault();

    if (!terms || !privacy) {
      setError("약관에 동의해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await authSignup(email, password, name);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success) {
        // 회원가입 성공 시 바로 대시보드로 이동
        router.push("/dashboard");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 인증 로딩 중일 때
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4 text-lg">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center">
      <h1 className="text-4xl font-bold mt-8 mb-8">회원가입</h1>
      <div className="flex flex-col w-full max-w-md px-4">
        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={signup} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="이름 (선택사항)"
            className="input input-lg border-gray-500"
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
          <input
            type="email"
            placeholder="이메일"
            className="input input-lg border-gray-500"
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            className="input input-lg border-gray-500"
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          <input
            type="password"
            placeholder="비밀번호 확인"
            className="input input-lg border-gray-500"
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={loading}
            required
          />

          <button
            type="submit"
            className={`btn btn-lg btn-primary ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? "처리 중..." : "회원가입"}
          </button>
        </form>
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
    </div>
  );
}
