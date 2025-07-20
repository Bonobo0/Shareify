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
      // 2FA 코드가 필요한 경우
      if (showTwoFactor) {
        const formData = new FormData();
        formData.append("email", email);
        formData.append("password", password);
        formData.append("twoFactorCode", twoFactorCode);
        formData.append("isBackupCode", useBackupCode.toString());

        const result = await login(formData);

        if (!result.success) {
          if (result.requiresTwoFactor) {
            // 여전히 2FA가 필요한 경우 (잘못된 코드)
            throw new Error(result.error || "잘못된 인증 코드입니다.");
          } else {
            throw new Error(result.error || "로그인 중 오류가 발생했습니다.");
          }
        }

        // 로그인 성공
        // AuthContext 업데이트를 위해 약간의 딜레이 후 리다이렉션
        setTimeout(() => {
          router.push(callbackUrl);
        }, 100);
      } else {
        // 일반 로그인 시도
        const result = await login(email, password);

        if (!result.success) {
          if (result.requiresTwoFactor) {
            // 2FA가 필요한 경우
            setShowTwoFactor(true);
            setError(""); // 에러 메시지 클리어
            return;
          } else {
            throw new Error(result.error || "로그인 중 오류가 발생했습니다.");
          }
        }

        // 로그인 성공 시 callbackUrl로 리다이렉션
        // AuthContext 업데이트를 위해 약간의 딜레이 후 리다이렉션
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || showTwoFactor}
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            className="input input-lg border-gray-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || showTwoFactor}
            required
          />

          {showTwoFactor && (
            <div className="space-y-4">
              <div className="alert alert-info">
                <span>
                  2단계 인증이 필요합니다. 인증 앱에서 생성된 6자리 코드를
                  입력해주세요.
                </span>
              </div>

              <input
                type="text"
                placeholder={
                  useBackupCode ? "백업 코드 (XXXX-XXXX)" : "인증 코드 (6자리)"
                }
                className="input input-lg border-gray-500"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                disabled={loading}
                maxLength={useBackupCode ? 9 : 6}
                required
              />

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">백업 코드 사용</span>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={useBackupCode}
                    onChange={(e) => {
                      setUseBackupCode(e.target.checked);
                      setTwoFactorCode("");
                    }}
                    disabled={loading}
                  />
                </label>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm w-full"
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
            className={`btn btn-lg btn-primary ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? "처리 중..." : showTwoFactor ? "로그인 완료" : "로그인"}
          </button>
        </form>

        <div className="space-y-3 mt-4">
          <p className="text-gray-500">
            계정이 없으신가요?{" "}
            <Link href="/user/signup" className="link-hover link-primary">
              회원가입
            </Link>
          </p>

          <p className="text-gray-500">
            비밀번호를 잊으셨나요?{" "}
            <Link
              href="/user/forgot-password"
              className="link-hover link-primary"
            >
              비밀번호 재설정
            </Link>
          </p>
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
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      }
    >
      <SigninContent />
    </Suspense>
  );
}
