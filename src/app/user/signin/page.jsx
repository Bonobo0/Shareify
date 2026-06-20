"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function SigninContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

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
      if (showTwoFactor) {
        const formData = new FormData();
        formData.append("email", email);
        formData.append("password", password);
        formData.append("twoFactorCode", twoFactorCode);
        formData.append("isBackupCode", useBackupCode.toString());

        const result = await login(formData);

        if (!result.success) {
          if (result.requiresTwoFactor) {
            throw new Error(result.error || "잘못된 인증 코드입니다.");
          } else {
            throw new Error(result.error || "로그인 중 오류가 발생했습니다.");
          }
        }

        setTimeout(() => {
          router.push(callbackUrl);
        }, 100);
      } else {
        const result = await login(email, password);

        if (!result.success) {
          if (result.requiresTwoFactor) {
            setShowTwoFactor(true);
            setError("");
            return;
          } else {
            throw new Error(result.error || "로그인 중 오류가 발생했습니다.");
          }
        }

        setTimeout(() => {
          router.push(callbackUrl);
        }, 100);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg text-brand-500"></div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
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
          <h1 className="mb-1 text-center text-2xl font-bold">로그인</h1>
          <p className="mb-6 text-center text-sm text-base-content/50">
            계정에 로그인하세요
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={signin} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-base-content/70">
                이메일
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || showTwoFactor}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-base-content/70">
                비밀번호
              </label>
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || showTwoFactor}
                required
              />
            </div>

            {showTwoFactor && (
              <div className="space-y-4 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
                <p className="text-sm text-base-content/70">
                  2단계 인증이 필요합니다. 인증 앱에서 생성된 6자리 코드를
                  입력해주세요.
                </p>

                <input
                  type="text"
                  placeholder={
                    useBackupCode ? "백업 코드 (XXXX-XXXX)" : "인증 코드 (6자리)"
                  }
                  className="input-field"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  disabled={loading}
                  maxLength={useBackupCode ? 9 : 6}
                  required
                />

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={useBackupCode}
                    onChange={(e) => {
                      setUseBackupCode(e.target.checked);
                      setTwoFactorCode("");
                    }}
                    disabled={loading}
                  />
                  <span className="text-sm text-base-content/60">
                    백업 코드 사용
                  </span>
                </label>

                <button
                  type="button"
                  className="btn-ghost-sm w-full"
                  onClick={() => {
                    setShowTwoFactor(false);
                    setTwoFactorCode("");
                    setUseBackupCode(false);
                  }}
                  disabled={loading}
                >
                  다시 로그인하기
                </button>
              </div>
            )}

            <button
              type="submit"
              className="btn-brand w-full py-3"
              disabled={loading}
            >
              {loading
                ? "처리 중..."
                : showTwoFactor
                  ? "로그인 완료"
                  : "로그인"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm">
            <p className="text-base-content/50">
              계정이 없으신가요?{" "}
              <Link
                href="/user/signup"
                className="font-medium text-brand-400 hover:text-brand-300"
              >
                회원가입
              </Link>
            </p>
            <p className="text-base-content/50">
              비밀번호를 잊으셨나요?{" "}
              <Link
                href="/user/forgot-password"
                className="font-medium text-brand-400 hover:text-brand-300"
              >
                비밀번호 재설정
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Signin() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="loading loading-spinner loading-lg text-brand-500"></div>
        </div>
      }
    >
      <SigninContent />
    </Suspense>
  );
}
