"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShield,
  faBolt,
  faFolder,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  if (loading || isAuthenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg text-brand-500"></div>
      </main>
    );
  }

  return (
    <main className="bg-hero-gradient">
      {/* Hero */}
      <section className="mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center px-4 text-center">
        <div className="animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-400">
            <FontAwesomeIcon icon={faShield} className="text-xs" />
            종단간 암호화 지원
          </div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            파일을 안전하게
            <br />
            <span className="text-gradient">공유하세요</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-base-content/60 sm:text-xl">
            Shareify는 종단간 암호화로 보호되는 파일 공유 플랫폼입니다.
            <br className="hidden sm:block" />
            언제 어디서나 파일을 안전하게 관리하고 공유하세요.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => router.push("/user/signup")}
              className="btn-brand-lg flex items-center gap-2 text-base"
            >
              무료로 시작하기
              <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
            </button>
            <Link
              href="/user/signin"
              className="btn-ghost flex items-center gap-2 text-base"
            >
              로그인
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="animate-slide-up mt-16 grid w-full max-w-lg grid-cols-3 gap-4">
          <div className="stat-card text-center">
            <div className="stat-value text-brand-400">5GB</div>
            <div className="stat-label">무료 용량</div>
          </div>
          <div className="stat-card text-center">
            <div className="stat-value text-violet-400">E2EE</div>
            <div className="stat-label">암호화</div>
          </div>
          <div className="stat-card text-center">
            <div className="stat-value text-emerald-400">2FA</div>
            <div className="stat-label">2단계 인증</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="card-surface p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
              <FontAwesomeIcon icon={faShield} />
            </div>
            <h3 className="mb-2 text-lg font-semibold">종단간 암호화</h3>
            <p className="text-sm leading-relaxed text-base-content/50">
              파일을 업로드하기 전에 브라우저에서 암호화합니다.
              서버는 암호화된 데이터만 저장합니다.
            </p>
          </div>

          <div className="card-surface p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
              <FontAwesomeIcon icon={faBolt} />
            </div>
            <h3 className="mb-2 text-lg font-semibold">빠른 공유</h3>
            <p className="text-sm leading-relaxed text-base-content/50">
              링크 하나로 파일을 공유하세요.
              수신자는 별도 계정 없이 다운로드할 수 있습니다.
            </p>
          </div>

          <div className="card-surface p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <FontAwesomeIcon icon={faFolder} />
            </div>
            <h3 className="mb-2 text-lg font-semibold">스마트 관리</h3>
            <p className="text-sm leading-relaxed text-base-content/50">
              디렉토리 기반 파일 관리, AI 검색, 일괄 다운로드 등
              강력한 파일 관리 기능을 제공합니다.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 pb-20 text-center">
        <div className="card-surface bg-gradient-subtle p-10">
          <h2 className="text-2xl font-bold sm:text-3xl">
            지금 바로 시작하세요
          </h2>
          <p className="mt-3 text-base-content/50">
            가입은 30초면 충분합니다. 5GB 무료 스토리지를 즉시 사용할 수
            있습니다.
          </p>
          <button
            onClick={() => router.push("/user/signup")}
            className="btn-brand-lg mt-6"
          >
            무료 계정 만들기
          </button>
        </div>
      </section>

      {/* Legal */}
      <div className="border-t border-surface-300/20 py-6 text-center text-xs text-base-content/30">
        서비스 이용 시{" "}
        <Link href="/terms" className="underline hover:text-brand-400">
          이용약관
        </Link>{" "}
        과{" "}
        <Link href="/privacy" className="underline hover:text-brand-400">
          개인정보 처리방침
        </Link>
        에 동의하는 것으로 간주합니다.
      </div>
    </main>
  );
}
