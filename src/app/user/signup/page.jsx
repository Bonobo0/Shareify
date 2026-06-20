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
        router.push("/dashboard");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg text-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white">
            S
          </span>
          Shareify
        </Link>

        {/* Card */}
        <div className="card-surface p-8">
          <h1 className="mb-1 text-center text-2xl font-bold">회원가입</h1>
          <p className="mb-6 text-center text-sm text-base-content/50">
            새 계정을 만드세요
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={signup} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-base-content/70">
                이름{" "}
                <span className="text-base-content/30">(선택사항)</span>
              </label>
              <input
                type="text"
                placeholder="홍길동"
                className="input-field"
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-base-content/70">
                이메일
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                className="input-field"
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-base-content/70">
                비밀번호
              </label>
              <input
                type="password"
                placeholder="최소 6자 이상"
                className="input-field"
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-base-content/70">
                비밀번호 확인
              </label>
              <input
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                className="input-field"
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-brand w-full py-3"
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

          <p className="mt-6 text-center text-sm text-base-content/50">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/user/signin"
              className="font-medium text-brand-400 hover:text-brand-300"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
