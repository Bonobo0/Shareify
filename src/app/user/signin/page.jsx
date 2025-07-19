"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Signin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 로그인 후 리다이렉션을 위한 콜백 URL 가져오기
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  // 이미 로그인된 경우 대시보드로 이동
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  const signin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // useAuth 훅의 login 함수 사용
      const result = await login(email, password);

      if (!result.success) {
        throw new Error(result.error || "로그인 중 오류가 발생했습니다.");
      }

      // 로그인 성공 시 callbackUrl로 리다이렉션
      router.push(callbackUrl);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center">
      <h1 className="text-4xl font-bold mt-8 mb-8">로그인</h1>
      <div className="flex flex-col w-full max-w-md px-4">
        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={signin} className="flex flex-col gap-4">
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
          <button
            type="submit"
            className={`btn btn-lg btn-primary ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? "처리 중..." : "로그인"}
          </button>
        </form>
        <p className="text-gray-500 mt-4">
          계정이 없으신가요?{" "}
          <Link href="/user/signup" className="link-hover link-primary">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
