"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-300/30 bg-surface-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-brand text-xs font-bold text-white">
                S
              </span>
              Shareify
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-base-content/50">
              안전하고 빠른 파일 공유 플랫폼.
              <br />
              종단간 암호화로 보호됩니다.
            </p>
          </div>

          {/* Service */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
              서비스
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/dashboard"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  대시보드
                </Link>
              </li>
              <li>
                <Link
                  href="/shared"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  공유된 파일
                </Link>
              </li>
              <li>
                <Link
                  href="/my-uploads"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  내 업로드
                </Link>
              </li>
              <li>
                <Link
                  href="/profile"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  프로필
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
              지원
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="mailto:admin@shareify.bonobo.kr"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  이메일 문의
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
              법적 정보
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/cookie-policy"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  쿠키 정책
                </Link>
              </li>
              <li>
                <Link
                  href="/license"
                  className="text-base-content/60 transition-colors hover:text-brand-400"
                >
                  라이선스
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="divider-subtle mt-10 flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row">
          <p className="text-xs text-base-content/40">
            &copy; {currentYear}{" "}
            <Link
              href="https://github.com/Bonobo0"
              className="hover:text-brand-400"
            >
              Bonobo0
            </Link>
            @Shareify. All rights reserved.
          </p>
          <p className="text-xs text-base-content/30">
            Made with care in South Korea
          </p>
        </div>
      </div>
    </footer>
  );
}
