"use client";

export default function License() {
  return (
    <div className="min-h-screen bg-base-100 p-2 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-3xl mb-6">라이선스</h1>

            <div className="space-y-6 text-base-content/90">
              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  소프트웨어 라이선스
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">MIT License</h3>
                  <p className="text-sm text-base-content/70 mb-4">
                    Copyright © 2024 Shareify
                  </p>
                  <div className="text-sm leading-relaxed space-y-2">
                    <p>
                      Permission is hereby granted, free of charge, to any
                      person obtaining a copy of this software and associated
                      documentation files (the "Software"), to deal in the
                      Software without restriction, including without limitation
                      the rights to use, copy, modify, merge, publish,
                      distribute, sublicense, and/or sell copies of the
                      Software, and to permit persons to whom the Software is
                      furnished to do so, subject to the following conditions:
                    </p>
                    <p>
                      The above copyright notice and this permission notice
                      shall be included in all copies or substantial portions of
                      the Software.
                    </p>
                    <p className="font-medium">
                      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
                      KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
                      WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                      PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
                      OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
                      OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
                      OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
                      SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  오픈소스 라이브러리
                </h2>
                <div className="space-y-4">
                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Next.js</h3>
                    <p className="text-sm text-base-content/70">MIT License</p>
                    <p className="text-sm">React 기반의 풀스택 웹 프레임워크</p>
                  </div>

                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">React</h3>
                    <p className="text-sm text-base-content/70">MIT License</p>
                    <p className="text-sm">
                      사용자 인터페이스를 구축하기 위한 JavaScript 라이브러리
                    </p>
                  </div>

                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Tailwind CSS</h3>
                    <p className="text-sm text-base-content/70">MIT License</p>
                    <p className="text-sm">유틸리티 우선 CSS 프레임워크</p>
                  </div>

                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">DaisyUI</h3>
                    <p className="text-sm text-base-content/70">MIT License</p>
                    <p className="text-sm">
                      Tailwind CSS용 컴포넌트 라이브러리
                    </p>
                  </div>

                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">MongoDB</h3>
                    <p className="text-sm text-base-content/70">
                      Server Side Public License (SSPL)
                    </p>
                    <p className="text-sm">NoSQL 데이터베이스</p>
                  </div>

                  <div className="bg-base-100 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">AWS SDK</h3>
                    <p className="text-sm text-base-content/70">
                      Apache License 2.0
                    </p>
                    <p className="text-sm">
                      Amazon Web Services 클라우드 서비스 SDK
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  아이콘 및 이미지
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    이 서비스에서 사용되는 아이콘들은 다음과 같은 오픈소스
                    라이선스를 따릅니다:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                    <li>
                      <strong>Lucide React Icons</strong> - MIT License
                    </li>
                    <li>
                      <strong>Heroicons</strong> - MIT License
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  저작권 고지
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    Shareify는 오픈소스 소프트웨어의 혜택을 받아 개발되었습니다.
                    우리는 오픈소스 커뮤니티에 감사하며, 해당 라이선스를
                    준수합니다.
                  </p>
                  <p className="text-sm mt-2">
                    본 서비스의 소스코드는 개별 라이브러리들의 라이선스를
                    따르며, 상업적 이용 시에는 각각의 라이선스 조건을 확인해야
                    합니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  문의
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm">
                    라이선스에 관한 문의사항이 있으시면 다음으로 연락해 주세요:
                  </p>
                  <div className="mt-2">
                    <p className="text-sm">
                      <strong>이메일:</strong>
                      <a
                        href="mailto:admin@shareify.bonobo.kr"
                        className="text-primary hover:underline ml-1"
                      >
                        admin@shareify.bonobo.kr
                      </a>
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
