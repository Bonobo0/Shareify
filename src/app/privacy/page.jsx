"use client";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-base-100 p-2 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-3xl mb-6">개인정보 처리방침</h1>

            <div className="space-y-6 text-base-content/90">
              <section>
                <div className="bg-base-100 p-4 rounded-lg border-l-4 border-primary">
                  <p className="text-sm leading-relaxed">
                    Shareify(이하 &quot;회사&quot;)는 개인정보보호법에 따라
                    이용자의 개인정보 보호 및 권익을 보호하고 개인정보와 관련한
                    이용자의 고충을 원활하게 처리할 수 있도록 다음과 같은
                    처리방침을 두고 있습니다.
                  </p>
                  <p className="text-xs text-base-content/70 mt-2">
                    시행일자: 2025년 7월 21일
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제1조 개인정보의 처리목적
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-3">
                  <p className="text-sm leading-relaxed">
                    회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고
                    있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
                    이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라
                    별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
                  </p>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      1. 회원가입 및 관리
                    </h3>
                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                      <li>회원 가입의사 확인, 회원자격 유지·관리</li>
                      <li>서비스 부정이용 방지, 각종 고지·통지</li>
                      <li>고충처리, 분쟁 조정을 위한 기록 보존</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      2. 파일 공유 서비스 제공
                    </h3>
                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                      <li>파일 업로드, 저장, 다운로드 서비스 제공</li>
                      <li>공유 링크 생성 및 관리</li>
                      <li>서비스 이용 기록 관리</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      3. 서비스 개선 및 통계
                    </h3>
                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                      <li>서비스 이용 현황 통계</li>
                      <li>서비스 개선 및 신규 서비스 개발</li>
                      <li>시스템 보안 및 안정성 확보</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제2조 개인정보의 처리 및 보유기간
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed mb-3">
                    회사는 법령에 따른 개인정보 보유·이용기간 또는
                    정보주체로부터 개인정보를 수집 시에 동의받은 개인정보
                    보유·이용기간 내에서 개인정보를 처리·보유합니다.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          <th>처리목적</th>
                          <th>개인정보 항목</th>
                          <th>보유기간</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>회원가입 및 관리</td>
                          <td>이메일, 비밀번호(암호화), 가입일시</td>
                          <td>회원탈퇴 시까지</td>
                        </tr>
                        <tr>
                          <td>파일 서비스 제공</td>
                          <td>업로드한 파일, 파일명, 업로드 일시</td>
                          <td>사용자 삭제 시까지</td>
                        </tr>
                        <tr>
                          <td>서비스 이용 기록</td>
                          <td>접속 로그, IP주소, 이용 시간</td>
                          <td>3개월</td>
                        </tr>
                        <tr>
                          <td>부정이용 방지</td>
                          <td>이메일, 접속 로그</td>
                          <td>1년</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제3조 개인정보의 제3자 제공
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed mb-3">
                    회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지
                    않습니다. 다만, 아래의 경우에는 예외로 합니다:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                    <li>이용자가 사전에 동의한 경우</li>
                    <li>
                      법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진
                      절차와 방법에 따라 수사기관의 요구가 있는 경우
                    </li>
                    <li>
                      통계작성, 학술연구 또는 시장조사를 위하여 필요한 경우로서
                      특정 개인을 알아볼 수 없는 형태로 제공하는 경우
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제4조 개인정보처리의 위탁
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed mb-3">
                    회사는 서비스 향상을 위해서 아래와 같이 개인정보 처리업무를
                    외부 전문업체에 위탁하고 있습니다:
                  </p>

                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          <th>수탁업체</th>
                          <th>위탁업무 내용</th>
                          <th>위탁개인정보 항목</th>
                          <th>보유 및 이용기간</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Cloudflare</td>
                          <td>클라우드 인프라 및 파일 저장</td>
                          <td>업로드된 파일, 이용자 데이터</td>
                          <td>서비스 종료 시까지</td>
                        </tr>
                        <tr>
                          <td>Vercel</td>
                          <td>웹사이트 호스팅 및 배포</td>
                          <td>접속 로그, 이용 기록</td>
                          <td> 서비스 종료 시까지</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-xs text-base-content/70">
                    <p>
                      위탁업체들은 각각의 개인정보처리방침에 따라 개인정보를
                      보호하며, 관련 법령을 준수합니다.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제5조 정보주체의 권리·의무 및 행사방법
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-3">
                  <p className="text-sm leading-relaxed">
                    이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수
                    있습니다:
                  </p>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      1. 개인정보 처리현황 통지요구
                    </h3>
                    <p className="text-sm pl-4">
                      개인정보의 처리현황에 대한 통지를 요구할 수 있습니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      2. 개인정보 열람요구
                    </h3>
                    <p className="text-sm pl-4">
                      처리되고 있는 본인의 개인정보에 대한 열람을 요구할 수
                      있습니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      3. 개인정보 정정·삭제요구
                    </h3>
                    <p className="text-sm pl-4">
                      오류가 있는 경우 정정 또는 삭제를 요구할 수 있습니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      4. 개인정보 처리정지요구
                    </h3>
                    <p className="text-sm pl-4">
                      개인정보의 처리를 정지하도록 요구할 수 있습니다.
                    </p>
                  </div>

                  <div className="alert alert-info mt-4">
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
                      <h3 className="font-bold">권리 행사 방법</h3>
                      <div className="text-xs">
                        위의 권리 행사는 이메일(admin@shareify.bonobo.kr)을 통해
                        신청하실 수 있습니다.
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제6조 개인정보의 파기
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-3">
                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">1. 파기절차</h3>
                    <p className="text-sm pl-4">
                      회원탈퇴, 서비스 종료, 이용자에게 동의받은 개인정보
                      보유기간의 만료, 처리목적의 달성 등 개인정보가 불필요하게
                      되었을 때에는 지체없이 해당 개인정보를 파기합니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">2. 파기방법</h3>
                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                      <li>
                        <strong>전자적 파일:</strong> 기록을 재생할 수 없도록
                        로우레벨 포맷 등의 방법을 이용하여 파기
                      </li>
                      <li>
                        <strong>종이 문서:</strong> 분쇄기로 분쇄하거나 소각하여
                        파기
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">3. 파기기한</h3>
                    <p className="text-sm pl-4">
                      개인정보 보유기간의 경과, 처리목적의 달성 등 개인정보가
                      불필요하게 된 날로부터 5일 이내에 파기합니다.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제7조 개인정보의 안전성 확보조치
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed mb-3">
                    회사는 개인정보보호법 제29조에 따라 다음과 같이 안전성
                    확보에 필요한 기술적/관리적 및 물리적 조치를 하고 있습니다:
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-medium text-secondary">
                        기술적 조치
                      </h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>개인정보처리시스템 등의 접근권한 관리</li>
                        <li>개인정보의 암호화</li>
                        <li>해킹 등에 대비한 기술적 대책</li>
                        <li>
                          개인정보처리시스템 접속기록의 보관 및 위변조 방지
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium text-secondary">
                        관리적 조치
                      </h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>개인정보 취급직원의 최소화 및 교육</li>
                        <li>개인정보 접근권한의 최소화</li>
                        <li>정기적인 자체 감사의 실시</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제8조 개인정보 자동 수집 장치의 설치·운영 및 거부
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-3">
                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      1. 쿠키의 사용 목적
                    </h3>
                    <p className="text-sm pl-4">
                      서비스는 이용자에게 최적화된 서비스를 제공하기 위해
                      이용자의 정보를 저장하고 수시로 불러오는
                      &apos;쿠키(cookie)&apos;를 사용합니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-secondary">
                      2. 쿠키의 설치·운영 및 거부
                    </h3>
                    <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                      <li>
                        이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다.
                      </li>
                      <li>
                        웹브라우저에서 옵션을 설정함으로써 모든 쿠키를
                        허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 아니면
                        모든 쿠키의 저장을 거부할 수도 있습니다.
                      </li>
                      <li>
                        다만, 쿠키의 저장을 거부할 경우에는 로그인이 필요한 일부
                        서비스의 이용에 어려움이 있을 수 있습니다.
                      </li>
                    </ul>
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
                      <h3 className="font-bold">쿠키 설정 방법</h3>
                      <div className="text-xs">
                        자세한 쿠키 설정 방법은{" "}
                        <a
                          href="/cookie-policy"
                          className="text-primary hover:underline"
                        >
                          쿠키 정책
                        </a>
                        을 참조하세요.
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제9조 개인정보 보호책임자
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed mb-3">
                    회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고,
                    개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을
                    위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다:
                  </p>

                  <div className="bg-base-200 p-3 rounded">
                    <h3 className="font-medium mb-2">개인정보 보호책임자</h3>
                    <ul className="space-y-1 text-sm">
                      <li>
                        <strong>성명:</strong> Shareify 관리자
                      </li>
                      <li>
                        <strong>연락처:</strong> admin@shareify.bonobo.kr
                      </li>
                      <li>
                        <strong>처리시간:</strong> 평일 09:00 - 18:00 (KST)
                      </li>
                    </ul>
                  </div>

                  <p className="text-xs text-base-content/70 mt-3">
                    정보주체께서는 서비스를 이용하시면서 발생한 모든 개인정보
                    보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보
                    보호책임자에게 문의하실 수 있습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제10조 권익침해 구제방법
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-3">
                  <p className="text-sm leading-relaxed">
                    정보주체는 아래의 기관에 대해 개인정보 침해신고를 할 수
                    있습니다:
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-base-200 p-3 rounded">
                      <h3 className="font-medium mb-2">개인정보보호위원회</h3>
                      <ul className="text-sm space-y-1">
                        <li>전화: 국번없이 182</li>
                        <li>홈페이지: privacy.go.kr</li>
                      </ul>
                    </div>

                    <div className="bg-base-200 p-3 rounded">
                      <h3 className="font-medium mb-2">
                        개인정보 침해신고센터
                      </h3>
                      <ul className="text-sm space-y-1">
                        <li>전화: (국번없이) 118</li>
                        <li>홈페이지: privacy.kisa.or.kr</li>
                      </ul>
                    </div>

                    <div className="bg-base-200 p-3 rounded">
                      <h3 className="font-medium mb-2">대검찰청</h3>
                      <ul className="text-sm space-y-1">
                        <li>전화: (국번없이) 1301</li>
                        <li>홈페이지: www.spo.go.kr</li>
                      </ul>
                    </div>

                    <div className="bg-base-200 p-3 rounded">
                      <h3 className="font-medium mb-2">경찰청</h3>
                      <ul className="text-sm space-y-1">
                        <li>전화: (국번없이) 182</li>
                        <li>홈페이지: ecrm.cyber.go.kr</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제11조 개인정보 처리방침 변경
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed mb-2">
                    ① 이 개인정보처리방침은 시행일로부터 적용되며, 법령 및
                    방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는
                    변경사항의 시행 7일 전부터 공지사항을 통하여 고지할
                    것입니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 본 방침은 2025년 7월 21일부터 시행됩니다.
                  </p>
                </div>
              </section>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-base-content/50">
                최종 업데이트: 2025년 7월 21일
                <br />
                문의:{" "}
                <a
                  href="mailto:admin@shareify.bonobo.kr"
                  className="text-primary hover:underline"
                >
                  admin@shareify.bonobo.kr
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
