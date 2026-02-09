# Shareify

### **설명**

**익명으로 파일을 자유롭게 공유할 수 있는 서비스입니다.**

해당 프로젝트의 기능 구현 및 디버깅에 있어,
**생성형 AI(GitHub Copilot Agent - Claude Sonnet 4, OpenAI GPT-5 Codex)**
의 도움을 받았습니다.

기획과 설계를 제외한 부분에서는 프로젝트가 대부분 **AI driven development** 형식으로 진행되어, 코드의 퀄리티가 많이 떨어질 수 있습니다.
추후 여러 차례에 거처 리팩토링을 진행하여, 코드 퀄리티 향상을 이루어 낼 예정입니다.

**Full Stack Web App 개발 연습을 위한 개인 프로젝트입니다.**

---

### **기술 스택**

| 분류 | 기술 |
|------|------|
| **프레임워크** | Next.js 15 (App Router) |
| **스타일링** | TailwindCSS, DaisyUI |
| **데이터베이스** | MongoDB (Mongoose) |
| **캐싱** | Redis (ioredis) |
| **파일 스토리지** | Cloudflare R2 (AWS SDK) |
| **인증** | JWT (jose), bcryptjs, speakeasy (2FA) |
| **이메일** | Nodemailer |
| **에디터** | Editor.js (react-editor-js) |
| **아이콘** | FontAwesome |
| **파일 처리** | JSZip, file-saver |
| **기타** | QRCode, theme-change |

---

### **기능**

#### 인증 및 사용자 관리
- **회원가입 / 로그인** (이메일 + 비밀번호)
- **이메일 인증** (E-mail verification)
- **2단계 인증** (2FA, TOTP 기반 + 백업 코드)
- **비밀번호 찾기 / 재설정**
- **프로필 관리**
- **사용자별 스토리지 용량 관리** (기본 5GB)

#### 파일 관리
- **단일 / 다중 파일 업로드**
- **E2EE 파일 암호화** (사용자 지정 암호화 키)
- **미디어 파일 미리보기**
- **파일/디렉토리 검색** (다양한 필터 옵션)
- **파일/디렉토리 공유** (특정 사용자 또는 공유 링크)
- **파일/디렉토리 일괄 다운로드 / 삭제**
- **디렉토리 관리** (생성, 수정, 삭제, 이동)
- **파일 이동** (디렉토리 트리 피커)

#### 에디터
- **라이브 에디터** (Editor.js 기반, 블록 에디터)
  - 헤더, 리스트, 체크리스트, 인용, 코드, 구분선, 인라인 코드, 마커, 테이블, 이미지 지원
  - 암호화된 에디터 문서 지원

#### WebGL 호스팅
- **Unity WebGL 빌드 업로드 및 브라우저 내 플레이**
- **WebGL 빌드 자동 검증** (ZIP 내 필수 파일 확인)
- **브라우저 내 캐싱** (IndexedDB)
- **암호화된 WebGL 빌드 지원**

#### 관리자 기능
- **관리자 대시보드** (사용자 관리)
- **사용자 용량/역할 변경, 계정 정지**
- **CLI 접근 권한 관리**
- **Rate Limit 관리**

#### 기타
- **다크/라이트 테마 전환**
- **Rate Limiting** (Redis 기반)
- **성능 최적화** (DB 인덱스, 커넥션 풀, 컴포넌트 메모이제이션)
- **이용약관 / 개인정보 처리방침 / 쿠키 정책 / 라이선스 페이지**

---

### **CLI Tool**

파일 업로드를 위한 커맨드라인 도구를 제공합니다.

- **`scripts/shareify_cli.py`** — 파일 업로드 CLI
- **`scripts/shareify_backup.sh`** — 주기적 폴더 백업 자동화 스크립트

주요 기능:
- JWT 토큰 또는 이메일/비밀번호 인증 (2FA, 백업 코드 지원)
- 자격 증명 파일(`.credential`) 지원
- 클라이언트 측 암호화 업로드 (`--encrypt`)
- 디스코드 웹훅 알림 (`--discord-webhook`)
- 공유 디렉토리 업로드 (`--share-hash`)

상세한 사용법은 **[scripts/shareify_cli.md](scripts/shareify_cli.md)** 파일을 참고해주세요.

---

### **프로젝트 구조**

```
src/
├── actions/            # Server Actions (인증, 파일, 디렉토리, 공유, 관리자 등)
├── app/
│   ├── admin/          # 관리자 대시보드
│   ├── api/cli/        # CLI용 API 엔드포인트
│   ├── auth/           # 이메일 인증
│   ├── components/     # 공통 UI 컴포넌트
│   ├── dashboard/      # 사용자 대시보드
│   ├── directory/      # 디렉토리 상세
│   ├── editor/         # 라이브 에디터
│   ├── file/           # 파일 상세
│   ├── my-uploads/     # 내 업로드 목록
│   ├── play/           # WebGL 플레이어
│   ├── profile/        # 프로필 관리
│   ├── share/          # 공유 페이지
│   ├── shared/         # 공유받은 항목
│   └── user/           # 로그인, 회원가입, 비밀번호 찾기/재설정
├── context/            # React Context (AuthContext)
├── lib/
│   ├── auth/           # JWT, 2FA, Edge Access Token
│   ├── crypto/         # 파일 암호화/복호화
│   ├── db/             # MongoDB 연결
│   ├── email/          # 이메일 서비스
│   ├── r2/             # Cloudflare R2 클라이언트
│   ├── redis/          # Redis 클라이언트
│   └── webgl/          # WebGL 빌드 검증 및 플레이어
├── models/             # Mongoose 모델 (User, File, Directory, RateLimit)
└── middleware.js        # 인증 미들웨어
scripts/
├── shareify_cli.py     # CLI 업로드 도구
├── shareify_cli.md     # CLI 사용 가이드
├── shareify_backup.sh  # 백업 자동화 스크립트
└── .credential.example # 자격 증명 파일 예시
docs/                   # 성능 최적화 및 WebGL 호스팅 문서
```

---

### **Self-Hosting**

#### 1. 환경 변수 설정
`.env.example` 파일을 참고하여 `.env` 파일을 작성합니다.

```bash
cp .env.example .env
```

필요한 환경 변수:

| 변수 | 설명 |
|------|------|
| `MONGODB_URI` | MongoDB 연결 URI |
| `REDIS_URL` | Redis 연결 URL |
| `R2_ACCOUNT_ID` | Cloudflare R2 계정 ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Key |
| `R2_BUCKET_NAME` | Cloudflare R2 버킷 이름 |
| `R2_PUBLIC_URL` | Cloudflare R2 퍼블릭 URL |
| `JWT_SECRET` | JWT 시크릿 (최소 32자) |
| `NEXT_PUBLIC_APP_URL` | 앱 공개 URL |
| `EMAIL_SERVICE` | 이메일 서비스 |
| `EMAIL_USERNAME` | 이메일 계정 |
| `EMAIL_PASSWORD` | 이메일 비밀번호 |

#### 2. 의존성 설치

```bash
npm install
# 또는
yarn install
```

#### 3. 빌드 및 실행

```bash
# 빌드
npm run build
# 실행
npm run start
```

```bash
# 또는 yarn 사용
yarn build
yarn start
```

#### 4. 개발 서버

```bash
npm run dev
# 또는
yarn dev
```

---

### **문서**

- **[scripts/shareify_cli.md](scripts/shareify_cli.md)** — CLI 도구 사용 가이드
- **[docs/WEBGL_HOSTING.md](docs/WEBGL_HOSTING.md)** — Unity WebGL 호스팅 기능 가이드
- **[docs/](docs/)** — 성능 최적화 관련 문서

---

### **Disclaimer**

**이 프로젝트는 개인적인 연습용 프로젝트로, 실제 서비스를 위한 것이 아닙니다.**

**이 프로젝트를 사용하여 발생하는 모든 문제에 대해 책임지지 않습니다.**

**프로젝트 이름 등 세부적인 사항들은 추후 변경될 수 있습니다.**
