"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyPasswordResetToken, resetPassword } from "@/actions/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
    twoFactorCode: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("재설정 토큰이 없습니다.");
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      setVerifying(true);
      try {
        const result = await verifyPasswordResetToken({ token });

        if (result.error) {
          setError(result.error);
          setTokenValid(false);
        } else {
          setTokenValid(true);
          setUserInfo(result);
          setShowTwoFactor(result.twoFactorEnabled);
        }
      } catch (err) {
        setError("토큰 확인 중 오류가 발생했습니다.");
        setTokenValid(false);
      } finally {
        setVerifying(false);
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = await resetPassword({
        token,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
        twoFactorCode: showTwoFactor ? formData.twoFactorCode : undefined,
        isBackupCode: useBackupCode,
      });

      if (result.error) {
        if (result.requires2FA) {
          setShowTwoFactor(true);
        }
        setError(result.error);
      } else {
        setMessage(result.message);
        // 3초 후 로그인 페이지로 리다이렉트
        setTimeout(() => {
          router.push("/user/signin?message=password-reset-success");
        }, 3000);
      }
    } catch (err) {
      setError("비밀번호 재설정 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-sm"></div>
          <p className="mt-4 text-lg">토큰을 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold">유효하지 않은 링크</h2>
            <div className="mt-4 alert alert-error">
              <span>{error}</span>
            </div>
            <div className="mt-6 space-y-4">
              <Link
                href="/user/forgot-password"
                className="btn btn-primary w-full"
              >
                비밀번호 재설정 다시 요청하기
              </Link>
              <Link href="/user/signin" className="btn btn-outline w-full">
                로그인으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold">
              비밀번호 재설정 완료
            </h2>
            <div className="mt-4 alert alert-success">
              <span>{message}</span>
            </div>
            <p className="mt-4 text-sm ">
              3초 후 로그인 페이지로 자동 이동됩니다...
            </p>
            <Link href="/user/signin" className="btn btn-primary mt-4">
              지금 로그인하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold ">
            새 비밀번호 설정
          </h2>
          <p className="mt-2 text-center text-sm">
            {userInfo?.name || userInfo?.email}님의 새로운 비밀번호를
            설정해주세요.
          </p>
          {showTwoFactor && (
            <p className="mt-2 text-center text-sm text-orange-600">
              이 계정은 2FA 인증이 활성화되어 있습니다. 추가 인증이 필요합니다.
            </p>
          )}
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium"
              >
                새 비밀번호
              </label>
              <div className="mt-1 relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="최소 8자 이상"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium  "
              >
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mt-1"
                placeholder="비밀번호를 다시 입력하세요"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={submitting}
              />
            </div>

            {showTwoFactor && (
              <div>
                <label
                  htmlFor="twoFactorCode"
                  className="block text-sm font-medium  "
                >
                  {useBackupCode ? "백업 코드" : "2FA 인증 코드"}
                </label>
                <input
                  id="twoFactorCode"
                  name="twoFactorCode"
                  type="text"
                  required={showTwoFactor}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mt-1"
                  placeholder={
                    useBackupCode ? "백업 코드 입력" : "6자리 인증 코드"
                  }
                  value={formData.twoFactorCode}
                  onChange={handleInputChange}
                  disabled={submitting}
                />
                <div className="mt-2">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm mr-2"
                      checked={useBackupCode}
                      onChange={(e) => {
                        setUseBackupCode(e.target.checked);
                        setFormData((prev) => ({ ...prev, twoFactorCode: "" }));
                      }}
                      disabled={submitting}
                    />
                    백업 코드 사용
                  </label>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={
                submitting ||
                !formData.newPassword ||
                !formData.confirmPassword ||
                (showTwoFactor && !formData.twoFactorCode)
              }
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                submitting ? "loading" : ""
              }`}
            >
              {submitting ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "비밀번호 재설정"
              )}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/user/signin"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="loading loading-spinner loading-lg"></div>
              <p className="mt-4 text-gray-600">페이지를 불러오는 중...</p>
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
