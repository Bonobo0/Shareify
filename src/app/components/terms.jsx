"use client";

import Link from "next/link";

export default function Terms({ terms, setTerms, privacy, setPrivacy }) {
  return (
    <div className="form-control mt-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          className="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
        />
        <span>
          <Link href="/terms" className="link link-primary link-hover">
            이용약관
          </Link>
          에 동의합니다
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          className="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
        />
        <span>
          <Link href="/privacy" className="link link-primary link-hover">
            개인정보 처리방침
          </Link>
          에 동의합니다
        </span>
      </div>
    </div>
  );
}
