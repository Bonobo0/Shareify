# Shareify
### **설명**
**익명으로 파일을 자유롭게 공유할 수 있는 서비스입니다.**
<br/>
**Next.js, TailwindCSS, MongoDB, Cloudflare R2 등의 기술 스택들을 사용했습니다.**
<br/>
해당 프로젝트의 기능 구현 및 디버깅에 있어, 
**생성형 AI(GitHub Copilot Agent - Claude Sonnet 4, OpenAI GPT-5 Codex)**
의 도움을 받았습니다.
<br/>
기획과 설계를 제외한 부분에서는 프로젝트가 대부분 **AI driven development** 형식으로 진행되어, 코드의 퀄리티가 많이 떨어질 수 있습니다.
<br/>
추후 여러 차례에 거처 리팩토링을 진행하여, 코드 퀄리티 향상을 이루어 낼 예정입니다.
<br/>
**Full Stack Web App 개발 연습을 위한 개인 프로젝트입니다.**

### **기능**
- **2FA** (Two-Factor Authentication)
- **E-mail verification**
- **Password reset**
- **Profile management**
- **Single/multiple file upload**
- **File management**
- **E2EE file encryption with custom encryption key**
- **Directory management**
- **Media file preview**
- **File/directory search with many options**
- **File/directory share with specific users or via shared links**
- **File/directory bulk download/delete**
- **Keycloak SSO 지원** (OAuth2/OIDC)

### **인증 시스템**
**이 프로젝트는 [Better Auth](https://better-auth.com)를 사용하여 인증을 처리합니다.**

#### **지원하는 인증 방식**
- 이메일/비밀번호 로그인
- Keycloak SSO (OAuth2/OIDC)
- 2단계 인증 (TOTP)

### **Keycloak SSO 설정**
**Keycloak을 사용하여 SSO(Single Sign-On)를 구성할 수 있습니다.**

#### **1. Keycloak 서버 설정**
1. Keycloak 서버를 설치하고 실행합니다.
2. 새로운 Realm을 생성하거나 기존 Realm을 사용합니다.
3. Clients 섹션에서 새 클라이언트를 생성합니다:
   - **Client ID**: `shareify` (원하는 이름으로 설정)
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `confidential`
   - **Valid Redirect URIs**: `http://your-domain.com/api/auth/callback/keycloak`
   - **Web Origins**: `http://your-domain.com`

4. Credentials 탭에서 **Client Secret**을 복사합니다.

#### **2. 환경 변수 설정**
`.env` 파일에 다음 환경 변수를 추가합니다:

```bash
# Keycloak OAuth Provider
KEYCLOAK_CLIENT_ID=shareify
KEYCLOAK_CLIENT_SECRET=your-client-secret-from-keycloak
KEYCLOAK_ISSUER=https://your-keycloak-domain/realms/your-realm
```

#### **3. Keycloak 설정 예시**
```
Keycloak 서버: https://keycloak.example.com
Realm: my-realm
Client ID: shareify
Client Secret: AbCdEfGhIjKlMnOpQrStUvWxYz123456

# 환경 변수 설정
KEYCLOAK_CLIENT_ID=shareify
KEYCLOAK_CLIENT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz123456
KEYCLOAK_ISSUER=https://keycloak.example.com/realms/my-realm
```

#### **4. 사용자 매핑**
Keycloak에서 로그인한 사용자는 자동으로 Shareify 계정과 연결됩니다.
- 이메일 주소가 동일한 기존 계정이 있으면 자동으로 연결됩니다.
- 새 사용자의 경우 자동으로 계정이 생성됩니다.

### **CLI Tool**
**파일 업로드를 위한 커맨드라인 도구를 제공합니다.**
<br/>
**`scripts/shareify_cli.py` 파일을 확인해주세요.**
<br/>
**상세한 사용법은 [scripts/shareify_cli.md](scripts/shareify_cli.md) 파일을 참고해주세요.**



### **Self-Hosting**
**환경 변수 설정은 `.env` 파일을 사용합니다.**
<br/>
**`.env.example` 파일을 참고하여 `.env` 파일을 작성해주세요.**
<br/>
**데이터베이스, 오브젝트 스토리지, 이메일 서비스 등의 설정이 필요합니다.**
<br/>
**MongoDB, Cloudflare R2, SMTP 서버 등을 설정해야 합니다.**

#### **필수 환경 변수**
```bash
# 데이터베이스
MONGODB_URI=mongodb://localhost:27017/shareify

# Better Auth (필수)
# openssl rand -base64 32 명령으로 생성 (약 44자의 base64 인코딩된 시크릿)
BETTER_AUTH_SECRET=your-secret-at-least-32-chars
BETTER_AUTH_URL=https://your-domain.com

# 애플리케이션 URL
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Cloudflare R2 스토리지
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-r2-bucket-name
R2_PUBLIC_URL=https://your-r2-public-url

# 이메일 서비스
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Keycloak SSO (선택사항)
KEYCLOAK_CLIENT_ID=your-keycloak-client-id
KEYCLOAK_CLIENT_SECRET=your-keycloak-client-secret
KEYCLOAK_ISSUER=https://your-keycloak-domain/realms/your-realm
```

#### **설치 및 실행**
**사용하는 패키지 매니저에 따라 의존성 패키지를 설치해주세요.**
<br/>
**예시:**
```bash
npm install
# 또는
yarn install
```
<br/>**프로젝트를 실행하려면 다음 명령어를 사용하세요:**
```bash
npm run build
npm run start
# 또는
yarn build
yarn start
```

### **기술 스택**
- **Frontend**: Next.js 14, React, TailwindCSS, DaisyUI
- **Backend**: Next.js API Routes, Server Actions
- **Authentication**: Better Auth (이메일/비밀번호, Keycloak SSO, 2FA)
- **Database**: MongoDB
- **Storage**: Cloudflare R2
- **Email**: Nodemailer

### **Disclaimer**
**이 프로젝트는 개인적인 연습용 프로젝트로, 실제 서비스를 위한 것이 아닙니다.**
<br/>
**이 프로젝트를 사용하여 발생하는 모든 문제에 대해 책임지지 않습니다.**
<br/>
**프로젝트 이름 등 세부적인 사항들은 추후 변경될 수 있습니다.**
