"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <main className="flex min-h-screen flex-col items-center ">
      <h1 className="text-4xl font-bold p-16">
        Shareify, 파일들을 편리하게 공유하세요
      </h1>
      <div className="flex flex-col max-w-96">
        <button
          className="btn btn-lg btn-primary"
          onClick={() => router.push("/user/signin")}
        >
          시작하기
        </button>
        <p className="text-gray-500 mt-4">
          계정 1개당 50GB의 용량을 무료로 사용할 수 있습니다.
        </p>
        <p className="text-gray-500 mt-4">
          해당 서비스를 이용함으로써{" "}
          <Link href="/terms" className="link-hover link-primary">
            이용약관
          </Link>
          과{" "}
          <Link href="/privacy" className="link-hover link-primary">
            개인정보 처리방침
          </Link>
          에 동의하는 것으로 간주합니다.
        </p>
      </div>
    </main>
  );
}
