"use client";

import Link from "next/link";

export default function Terms({ terms, setTerms, privacy, setPrivacy }) {
  return (
    <div className="mt-2">
      {/* terms and privacy checkbox */}
      <h3 className="text-gray-500 mb-2">
        계정 생성을 위해 약관 동의가 필요합니다.
      </h3>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="terms"
          className="checkbox checkbox-primary"
          onChange={() => {
            setTerms(!terms);
          }}
        />
        <label htmlFor="terms" className="text-gray-500">
          <Link
            href="/terms"
            className="link-hover link-success"
            target="_blank"
          >
            이용약관
          </Link>
        </label>
        <input
          type="checkbox"
          id="privacy"
          className="checkbox checkbox-primary"
          onChange={() => {
            setPrivacy(!privacy);
          }}
        />
        <label htmlFor="privacy" className="text-gray-500">
          <Link
            href="/privacy"
            className="link-hover link-success"
            target="_blank"
          >
            개인정보 처리방침
          </Link>
        </label>
      </div>
    </div>
  );
}
