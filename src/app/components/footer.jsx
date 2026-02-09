"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-base-200 text-base-content w-full mt-5 p-3">
      <div className="py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* 브랜드 섹션 */}
            <div className="md:col-span-1">
              <h3 className="text-xl font-bold mb-4">Shareify</h3>
              <p className="text-sm text-base-content/70 mb-4">
                안전하고 빠른 파일 공유 플랫폼입니다. 언제 어디서나 쉽게 파일을
                공유하고 관리하세요.
              </p>
            </div>

            {/* 서비스 섹션 */}
            <div className="md:col-span-1">
              <h4 className="font-semibold mb-4">서비스</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/dashboard"
                    className="text-base-content/70 hover:text-primary"
                  >
                    대시보드
                  </Link>
                </li>
                <li>
                  <Link
                    href="/shared"
                    className="text-base-content/70 hover:text-primary"
                  >
                    공유된 파일
                  </Link>
                </li>
                <li>
                  <Link
                    href="/my-uploads"
                    className="text-base-content/70 hover:text-primary"
                  >
                    내 업로드
                  </Link>
                </li>
                <li>
                  <Link
                    href="/profile"
                    className="text-base-content/70 hover:text-primary"
                  >
                    프로필
                  </Link>
                </li>
              </ul>
            </div>

            {/* 지원 섹션 */}
            <div className="md:col-span-1">
              <h4 className="font-semibold mb-4">지원</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:admin@shareify.bonobo.kr"
                    className="text-base-content/70 hover:text-primary"
                  >
                    이메일 문의하기
                  </a>
                </li>
              </ul>
            </div>

            {/* 법적 정보 섹션 */}
            <div className="md:col-span-1">
              <h4 className="font-semibold mb-4">법적 정보</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/privacy"
                    className="text-base-content/70 hover:text-primary"
                  >
                    개인정보처리방침
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-base-content/70 hover:text-primary"
                  >
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cookie-policy"
                    className="text-base-content/70 hover:text-primary"
                  >
                    쿠키 정책
                  </Link>
                </li>
                <li>
                  <Link
                    href="/license"
                    className="text-base-content/70 hover:text-primary"
                  >
                    라이선스
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* 하단 영역 */}
          <div className="border-t border-base-300 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-sm text-base-content/70 mb-4 md:mb-0">
                © {currentYear}{" "}
                <Link href="https://github.com/Bonobo0">Bonobo0</Link>@Shareify.
                All rights reserved.
              </div>
              <div className="flex items-center space-x-4 text-sm text-base-content/70">
                <span>Made with <FontAwesomeIcon icon={faHeart} /> in South Korea</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
