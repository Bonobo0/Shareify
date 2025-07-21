"use client";

export default function Terms() {
  return (
    <div className="min-h-screen bg-base-100 p-2 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-3xl mb-6">이용약관</h1>

            <div className="space-y-6 text-base-content/90">
              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제1조 (목적)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    이 약관은 Shareify(이하 &quot;서비스&quot;)를 통해 제공되는
                    파일 공유 서비스의 이용과 관련하여 서비스 운영자(이하
                    &quot;회사&quot;)와 이용자 간의 권리, 의무 및 책임사항, 기타
                    필요한 사항을 규정함을 목적으로 합니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제2조 (정의)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-3">
                  <div className="text-sm leading-relaxed">
                    <p className="mb-2">
                      이 약관에서 사용하는 용어의 정의는 다음과 같습니다:
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-4">
                      <li>
                        <strong>&quot;서비스&quot;</strong>란 회사가 제공하는
                        파일 업로드, 저장, 공유 기능을 말합니다.
                      </li>
                      <li>
                        <strong>&quot;이용자&quot;</strong>란 이 약관에 따라
                        서비스를 이용하는 회원 및 비회원을 말합니다.
                      </li>
                      <li>
                        <strong>&quot;회원&quot;</strong>란 서비스에 개인정보를
                        제공하여 회원등록을 한 자를 말합니다.
                      </li>
                      <li>
                        <strong>&quot;콘텐츠&quot;</strong>란 이용자가 서비스를
                        통해 업로드하는 파일, 이미지, 문서 등을 말합니다.
                      </li>
                      <li>
                        <strong>&quot;공유 링크&quot;</strong>란 업로드된
                        콘텐츠에 접근할 수 있는 고유한 URL을 말합니다.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제3조 (약관의 효력 및 변경)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 이 약관은 서비스 화면에 게시하거나 기타의 방법으로
                    이용자에게 공지함으로써 효력을 발생합니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이
                    약관을 변경할 수 있습니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ③ 약관이 변경되는 경우 회사는 변경사항을 서비스 내
                    공지사항을 통해 최소 7일 전에 공지합니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제4조 (회원가입)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후
                    이 약관에 동의한다는 의사표시를 함으로써 회원가입을
                    신청합니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중
                    다음 각 호에 해당하지 않는 한 회원으로 등록합니다:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                    <li>
                      가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한
                      적이 있는 경우
                    </li>
                    <li>
                      허위 정보를 기재하거나, 회사가 제시하는 내용을 기재하지
                      않은 경우
                    </li>
                    <li>
                      만 14세 미만의 아동이 법정대리인 동의 없이 신청한 경우
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제5조 (서비스의 제공 및 변경)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 회사는 다음과 같은 서비스를 제공합니다:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                    <li>파일 업로드 및 저장 서비스</li>
                    <li>파일 공유 링크 생성 서비스</li>
                    <li>디렉토리 생성 및 관리 서비스</li>
                    <li>파일 다운로드 서비스</li>
                    <li>
                      기타 회사가 추가로 개발하거나 제휴계약 등을 통해
                      이용자에게 제공하는 서비스
                    </li>
                  </ul>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 운영상, 기술상의 필요에 따라 제공하고 있는 서비스를
                    변경할 수 있습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제6조 (서비스의 중단)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 회사는 다음 각 호에 해당하는 경우 서비스 제공을 일시적으로
                    중단할 수 있습니다:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                    <li>서비스용 설비의 보수나 공사로 인한 부득이한 경우</li>
                    <li>
                      전기통신사업법에 규정된 기간통신사업자가 전기통신 서비스를
                      중지했을 경우
                    </li>
                    <li>
                      국가비상사태, 정전, 서비스 설비의 장애 또는 서비스 이용의
                      폭주 등으로 정상적인 서비스 제공이 불가능할 경우
                    </li>
                  </ul>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 서비스의 제공에 필요한 경우 정기점검을 실시할 수
                    있으며, 정기점검시간은 서비스제공화면에 공지한 바에
                    따릅니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제7조 (이용자의 의무)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 이용자는 다음 행위를 하여서는 안 됩니다:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                    <li>신청 또는 변경 시 허위내용을 등록하는 행위</li>
                    <li>타인의 정보를 도용하는 행위</li>
                    <li>회사가 게시한 정보를 변경하는 행위</li>
                    <li>
                      회사와 기타 제3자의 저작권 등 지적재산권을 침해하는 행위
                    </li>
                    <li>
                      회사와 기타 제3자의 명예를 손상시키거나 업무를 방해하는
                      행위
                    </li>
                    <li>
                      외설 또는 폭력적인 메시지, 화상, 음성 등을 공개 또는
                      게시하는 행위
                    </li>
                    <li>
                      악성코드, 바이러스 등을 포함한 파일을 업로드하는 행위
                    </li>
                    <li>저작권이 있는 파일을 무단으로 공유하는 행위</li>
                  </ul>
                  <p className="text-sm leading-relaxed">
                    ② 이용자는 관계법령, 이 약관의 규정, 이용안내 및 서비스와
                    관련하여 공지한 주의사항, 회사가 통지하는 사항 등을
                    준수하여야 합니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제8조 (콘텐츠의 관리)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 이용자가 업로드한 콘텐츠의 저작권은 해당 이용자에게
                    있습니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 이용자가 업로드한 콘텐츠가 다음 각 호에 해당한다고
                    판단되는 경우 사전통지 없이 삭제하거나 이용을 제한할 수
                    있습니다:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-4 text-sm">
                    <li>
                      다른 이용자나 제3자를 비방하거나 중상모략으로 명예를
                      손상시키는 내용
                    </li>
                    <li>공공질서 및 미풍양속에 위반되는 내용</li>
                    <li>범죄적 행위에 결부된다고 인정되는 내용</li>
                    <li>
                      회사의 저작권, 제3자의 저작권 등 기타 권리를 침해하는 내용
                    </li>
                    <li>악성코드나 바이러스가 포함된 파일</li>
                  </ul>
                  <p className="text-sm leading-relaxed">
                    ③ 회사는 서비스 제공을 위해 이용자의 콘텐츠를 복제, 저장,
                    전송할 수 있습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제9조 (개인정보보호)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    회사는 이용자의 개인정보를 보호하기 위하여 관련 법령에 따라
                    개인정보처리방침을 정하여 이를 준수합니다.
                    개인정보처리방침은 서비스 내에서 확인할 수 있습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제10조 (회사의 의무)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 회사는 법령과 이 약관이 금지하거나 공서양속에 반하는
                    행위를 하지 않으며 이 약관이 정하는 바에 따라 지속적이고,
                    안정적으로 서비스를 제공하기 위해서 노력합니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 이용자가 안전하게 인터넷 서비스를 이용할 수 있도록
                    이용자의 개인정보(신용정보 포함)보호를 위한 보안 시스템을
                    구축합니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ③ 회사는 서비스 이용과 관련하여 이용자로부터 제기된 의견이나
                    불만이 정당하다고 객관적으로 인정될 경우에는 적절한 절차를
                    거쳐 즉시 처리하여야 합니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제11조 (책임의 한계)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여
                    서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이
                    면제됩니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에
                    대하여는 책임을 지지 않습니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ③ 회사는 이용자가 서비스를 이용하여 기대하는 수익을 상실한
                    것에 대하여 책임을 지지 않으며, 그 밖의 서비스를 통하여 얻은
                    자료로 인한 손해에 관하여 책임을 지지 않습니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ④ 회사는 이용자 간 또는 이용자와 제3자 상호간에 서비스를
                    매개로 하여 거래 등을 한 경우에는 책임을 지지 않습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제12조 (분쟁해결)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① 회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고
                    그 피해를 보상처리하기 위하여 피해보상처리기구를
                    설치·운영합니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 회사는 이용자로부터 제출되는 불만사항 및 의견을 우선적으로
                    그 사항을 처리합니다. 다만, 신속한 처리가 곤란한 경우에는
                    이용자에게 그 사유와 처리일정을 즉시 통보해 드립니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ③ 회사와 이용자 간에 발생한 분쟁은 전자거래기본법 제28조 및
                    동 시행령 제15조에 의하여 설치된 전자거래분쟁조정위원회의
                    조정에 따를 수 있습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  제13조 (재판권 및 준거법)
                </h2>
                <div className="bg-base-100 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    ① 회사와 이용자 간에 발생한 분쟁에 관한 소송은 대한민국 법을
                    적용하며, 회사의 본사 소재지를 관할하는 법원을 관할법원으로
                    합니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-primary">
                  부칙
                </h2>
                <div className="bg-base-100 p-4 rounded-lg space-y-2">
                  <p className="text-sm leading-relaxed">
                    ① (시행일) 이 약관은 2025년 7월 21일부터 적용됩니다.
                  </p>
                  <p className="text-sm leading-relaxed">
                    ② 문의사항이 있으시면 다음으로 연락해 주세요:
                  </p>
                  <div className="pl-4 text-sm space-y-1">
                    <p>
                      <strong>이메일:</strong> admin@shareify.bonobo.kr
                    </p>
                    <p>
                      <strong>서비스명:</strong> Shareify
                    </p>
                    <p>
                      <strong>운영시간:</strong> 평일 09:00 - 18:00 (KST)
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
