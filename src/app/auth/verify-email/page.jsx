"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/actions/verification";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCircleXmark } from "@fortawesome/free-solid-svg-icons";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const hasVerified = useRef(false);
  const token = searchParams.get("token");

  useEffect(() => {
    // 이미 인증을 시도했다면 중복 실행 방지
    if (hasVerified.current) return;

    if (!token) {
      setResult({
        success: false,
        message: "유효하지 않은 인증 링크입니다.",
      });
      setLoading(false);
      return;
    }

    hasVerified.current = true; // 인증 시도 표시

    const verify = async () => {
      try {
        const response = await verifyEmail({ token });
        console.log("이메일 인증 응답:", response);
        setResult(response);
      } catch (error) {
        console.error("이메일 인증 에러:", error);
        setResult({
          success: false,
          message: "인증 처리 중 오류가 발생했습니다.",
        });
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4 text-lg">이메일 인증을 처리하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body text-center">
          {result?.success && !result?.error ? (
            <>
              <div className="text-6xl mb-4"><FontAwesomeIcon icon={faCircleCheck} /></div>
              <h2 className="card-title justify-center text-2xl mb-4">
                이메일 인증 완료!
              </h2>
              <p className="text-gray-600 mb-6">{result.message}</p>
              <div className="card-actions justify-center">
                <Link href="/dashboard" className="btn btn-primary">
                  대시보드로 이동
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4"><FontAwesomeIcon icon={faCircleXmark} /></div>
              <h2 className="card-title justify-center text-2xl mb-4">
                인증 실패
              </h2>
              <p className="text-gray-600 mb-6">
                {result?.error ||
                  result?.message ||
                  "알 수 없는 오류가 발생했습니다."}
              </p>
              <div className="card-actions justify-center flex-col gap-2">
                <Link href="/user/signin" className="btn btn-primary">
                  로그인 페이지로
                </Link>
                <Link href="/user/signup" className="btn btn-outline">
                  다시 회원가입
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4 text-lg">이메일 인증 확인 중...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
