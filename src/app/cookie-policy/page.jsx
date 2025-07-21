"use client";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-base-100 p-2 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-3xl mb-6">쿠키 정책</h1>

            <div className="space-y-6 text-base-content/90">
              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  쿠키란 무엇인가요?
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    쿠키는 웹사이트를 방문할 때 브라우저에 저장되는 작은 텍스트
                    파일입니다. 쿠키는 웹사이트가 사용자의 방문을 기억하여 다음
                    방문 시 더 나은 서비스를 제공할 수 있도록 도와줍니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  Shareify에서 사용하는 쿠키 및 저장소
                </h2>
                <div className="space-y-4">
                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2 text-secondary">
                      필수 쿠키
                    </h3>
                    <p className="text-sm mb-2">
                      이 쿠키들은 웹사이트의 기본적인 기능을 위해 반드시
                      필요합니다.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="table table-sm w-full">
                        <thead>
                          <tr>
                            <th>쿠키명</th>
                            <th>목적</th>
                            <th>유효기간</th>
                            <th>도메인</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="font-mono text-xs">token</td>
                            <td>사용자 인증 JWT 토큰 저장</td>
                            <td>7일</td>
                            <td>shareify.bonobo.kr</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 text-xs text-base-content/60">
                      <strong>참고:</strong> &apos;token&apos; 쿠키는 httpOnly,
                      secure (프로덕션에서), sameSite=lax 속성으로 설정됩니다.
                    </div>
                  </div>

                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2 text-secondary">
                      로컬 스토리지 (LocalStorage)
                    </h3>
                    <p className="text-sm mb-2">
                      브라우저의 로컬 스토리지를 사용하여 사용자 설정을
                      저장합니다.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="table table-sm w-full">
                        <thead>
                          <tr>
                            <th>키명</th>
                            <th>목적</th>
                            <th>유효기간</th>
                            <th>값 예시</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="font-mono text-xs">theme</td>
                            <td>사용자가 선택한 테마 설정 (라이트/다크)</td>
                            <td>브라우저 삭제 시까지</td>
                            <td>&quot;light&quot; 또는 &quot;dark&quot;</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 text-xs text-base-content/60">
                      <strong>참고:</strong> 로컬 스토리지는 쿠키가 아니며
                      서버로 전송되지 않습니다. 브라우저에만 저장됩니다.
                    </div>
                  </div>

                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2 text-secondary">
                      제3자 서비스 쿠키
                    </h3>
                    <p className="text-sm mb-2">
                      배포 및 성능 최적화를 위한 제3자 서비스에서 설정되는
                      쿠키입니다.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="table table-sm w-full">
                        <thead>
                          <tr>
                            <th>서비스</th>
                            <th>목적</th>
                            <th>쿠키 예시</th>
                            <th>도메인</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="font-medium">Vercel</td>
                            <td>배포 플랫폼 성능 모니터링 및 최적화</td>
                            <td>__vercel_*</td>
                            <td>.vercel.app</td>
                          </tr>
                          <tr>
                            <td className="font-medium">Cloudflare</td>
                            <td>CDN 및 보안, DDoS 방어</td>
                            <td>__cf_bm, cf_clearance</td>
                            <td>.shareify.bonobo.kr</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 text-xs text-base-content/60">
                      <strong>참고:</strong> 이러한 제3자 쿠키는 각각의 서비스
                      제공업체 개인정보 정책을 따릅니다.
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  쿠키 관리
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">브라우저 설정</h3>
                    <p className="text-sm leading-relaxed">
                      대부분의 웹 브라우저는 쿠키를 자동으로 수락하지만,
                      브라우저 설정에서 쿠키를 거부하거나 삭제할 수 있습니다.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">
                      브라우저별 쿠키 설정 방법
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <span className="font-medium min-w-20">Chrome:</span>
                        <span>
                          설정 → 개인정보 및 보안 → 쿠키 및 기타 사이트 데이터
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <span className="font-medium min-w-20">Firefox:</span>
                        <span>
                          설정 → 개인정보 및 보안 → 쿠키 및 사이트 데이터
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <span className="font-medium min-w-20">Safari:</span>
                        <span>
                          환경설정 → 개인정보 → 쿠키 및 웹사이트 데이터
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <span className="font-medium min-w-20">Edge:</span>
                        <span>
                          설정 → 쿠키 및 사이트 권한 → 쿠키 및 저장된 데이터
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-warning">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="stroke-current shrink-0 h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <div>
                      <h3 className="font-bold">중요한 주의사항</h3>
                      <div className="text-xs space-y-1">
                        <p>
                          • 인증 토큰 쿠키(&apos;token&apos;)를 비활성화하면
                          로그인이 불가능합니다.
                        </p>
                        <p>
                          • 테마 설정은 로컬 스토리지에 저장되므로 쿠키 설정의
                          영향을 받지 않습니다.
                        </p>
                        <p>
                          • 제3자 서비스(Vercel, Cloudflare) 쿠키는 사이트
                          성능과 보안에 필요합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제3자 서비스 및 배포 환경
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Vercel (배포 플랫폼)</h3>
                    <p className="text-sm leading-relaxed mb-2">
                      Shareify는 Vercel 플랫폼에서 호스팅됩니다. Vercel은 성능
                      최적화와 모니터링을 위해 자체 쿠키를 설정할 수 있습니다.
                    </p>
                    <ul className="text-xs space-y-1 text-base-content/70">
                      <li>• 성능 분석 및 로드 밸런싱</li>
                      <li>• 에지 캐싱 및 CDN 최적화</li>
                      <li>• 서버리스 함수 실행 통계</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">
                      Cloudflare (DNS 및 보안)
                    </h3>
                    <p className="text-sm leading-relaxed mb-2">
                      DNS 관리 및 보안 서비스를 위해 Cloudflare를 사용합니다.
                      Cloudflare는 보안 및 성능을 위한 쿠키를 설정할 수
                      있습니다.
                    </p>
                    <ul className="text-xs space-y-1 text-base-content/70">
                      <li>• DDoS 공격 방어</li>
                      <li>• 봇 관리 및 보안 필터링</li>
                      <li>• 캐시 최적화</li>
                      <li>• SSL/TLS 인증서 관리</li>
                    </ul>
                  </div>

                  <div className="alert alert-info">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="stroke-current shrink-0 w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    <div>
                      <h3 className="font-bold">제3자 개인정보 정책</h3>
                      <div className="text-xs">
                        이러한 제3자 서비스들의 쿠키 사용에 대한 자세한 내용은
                        각각의 개인정보 정책을 참조하세요:
                        <br />•{" "}
                        <a
                          href="https://vercel.com/legal/privacy-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Vercel 개인정보 정책
                        </a>
                        <br />•{" "}
                        <a
                          href="https://www.cloudflare.com/privacy/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Cloudflare 개인정보 정책
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  쿠키 정책 변경
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    이 쿠키 정책은 필요에 따라 업데이트될 수 있습니다. 중요한
                    변경사항이 있을 경우 웹사이트를 통해 공지하겠습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  문의하기
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm mb-2">
                    쿠키 정책에 대한 질문이나 우려사항이 있으시면 언제든지
                    연락해 주세요:
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>이메일:</strong>
                      <a
                        href="mailto:admin@shareify.bonobo.kr"
                        className="text-primary hover:underline ml-1"
                      >
                        admin@shareify.bonobo.kr
                      </a>
                    </p>
                    <p>
                      <strong>운영시간:</strong> 평일 09:00 - 18:00 (KST)
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-base-content/50">
                최종 업데이트: 2025년 07월
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
