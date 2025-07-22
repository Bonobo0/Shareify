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
                  <h3 className="font-medium mb-2">Shareify 독점 라이선스</h3>
                  <p className="text-sm text-base-content/70 mb-4">
                    Copyright © 2025 Bonobo0@Shareify. All rights reserved.
                  </p>
                  <div className="text-sm leading-relaxed space-y-3">
                    <div>
                      <h4 className="font-medium mb-2">1. 라이선스 범위</h4>
                      <p>
                        본 소프트웨어(Shareify)는 독점적 라이선스 하에
                        제공됩니다. 소스코드는 비공개로 유지되며, 저작권자의
                        명시적 허가 없이는 어떠한 형태의 배포, 복사, 수정,
                        재배포도 금지됩니다.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">2. 사용 허가</h4>
                      <p>
                        본 서비스는 제공된 웹 인터페이스를 통한 개인적, 상업적,
                        비상업적 사용에 한해 허가됩니다. 서비스의 리버스
                        엔지니어링, 디컴파일, 디스어셈블은 금지됩니다.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">
                        3. 오픈소스 라이브러리
                      </h4>
                      <p>
                        본 소프트웨어는 다양한 오픈소스 라이브러리를 사용하며,
                        해당 라이브러리들은 각각의 라이선스를 따릅니다. 자세한
                        내용은 아래 오픈소스 라이브러리 섹션을 참조하십시오.
                      </p>
                    </div>
                    <div className="bg-warning/10 p-3 rounded border-l-4 border-warning">
                      <h4 className="font-medium mb-2 text-warning">
                        4. 제한사항
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>소스코드의 무단 복사, 배포, 수정 금지</li>
                        <li>상업적 목적의 재배포 금지</li>
                        <li>서비스의 무단 복제 또는 모방 금지</li>
                        <li>API의 무단 사용 또는 남용 금지</li>
                      </ul>
                    </div>
                    <p className="font-medium text-sm bg-base-200 p-3 rounded">
                      본 소프트웨어는 &ldquo;있는 그대로&rdquo; 제공되며,
                      명시적이거나 암묵적인 어떠한 보증도 제공하지 않습니다.
                      저작권자는 본 소프트웨어의 사용으로 인해 발생하는 어떠한
                      손해에 대해서도 책임지지 않습니다.
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
                    우리는 오픈소스 커뮤니티에 감사하며, 사용된 오픈소스
                    라이브러리들의 라이선스를 철저히 준수합니다.
                  </p>
                  <p className="text-sm mt-2">
                    Shareify 자체의 소스코드는 독점적 라이선스 하에 보호되며,
                    오픈소스 라이브러리들은 각각의 라이선스를 따릅니다. 상업적
                    이용이나 배포에 관한 문의는 별도로 연락 바랍니다.
                  </p>
                  <div className="mt-3 p-3 bg-info/10 rounded border-l-4 border-info">
                    <p className="text-sm">
                      <strong>중요:</strong> 본 서비스의 무단 복제, 배포, 수정은
                      저작권법에 의해 엄격히 금지되어 있습니다.
                    </p>
                  </div>
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
                최종 업데이트: 2025년 7월
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
