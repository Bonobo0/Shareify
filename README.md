# Shareify
### **설명**
**익명으로 파일을 자유롭게 공유할 수 있는 서비스입니다.**
<br/>
**Next.js, TailwindCSS, PostgreSQL/MongoDB, Cloudflare R2 등의 기술 스택들을 사용했습니다.**
<br/>
해당 프로젝트의 기능 구현 및 디버깅에 있어, 
**생성형 AI(GitHub Copilot Agent - Claude Sonnet 4)**
의 도움을 받았습니다.
<br/>
기획과 설계를 제외한 부분에서는 프로젝트가 대부분 **AI driven development** 형식으로 진행되어, 코드의 퀄리티가 많이 떨어질 수 있습니다.
<br/>
추후 여러 차례에 거처 리팩토링을 진행하여, 코드 퀄리티 향상을 이루어 낼 예정입니다.
<br/>
**Full Stack Web App 개발 연습을 위한 개인 프로젝트입니다.**

### **기능**
- **2FA**
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


### **Self-Hosting**
**환경 변수 설정은 `.env` 파일을 사용합니다.**
<br/>
**`.env.example` 파일을 참고하여 `.env` 파일을 작성해주세요.**
<br/>
**데이터베이스, 오브젝트 스토리지, 이메일 서비스 등의 설정이 필요합니다.**
<br/>

#### **데이터베이스 지원**
**PostgreSQL 17 (권장) 또는 MongoDB를 사용할 수 있습니다.**
- **PostgreSQL** (권장): Neon 호환, `DATABASE_URL` 설정
  - **자동 스키마 초기화**: PostgreSQL 설정 시 최초 연결 시 자동으로 테이블 생성
- **MongoDB** (레거시): `MONGODB_URI` 설정
- **관리자 페이지에서 데이터베이스 선택 가능**: `/admin/db-settings`
- MongoDB에서 PostgreSQL로 마이그레이션: `MIGRATION.md` 참고
- 데이터베이스 설정 가이드: `DB_SETTINGS.md` 참고
<br/>

**Cloudflare R2, SMTP 서버 등을 설정해야 합니다.**
<br/>
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

### **데이터베이스 마이그레이션**
**MongoDB에서 PostgreSQL로 마이그레이션하려면:**
1. `MIGRATION.md` 파일을 참고하세요
2. 관리자로 로그인 후 `/admin/migration` 페이지에서 마이그레이션 가능
3. 수동 단계별 마이그레이션 또는 자동 전체 마이그레이션 선택

### **Disclaimer**
**이 프로젝트는 개인적인 연습용 프로젝트로, 실제 서비스를 위한 것이 아닙니다.**
<br/>
**이 프로젝트를 사용하여 발생하는 모든 문제에 대해 책임지지 않습니다.**
<br/>
**프로젝트 이름 등 세부적인 사항들은 추후 변경될 수 있습니다.**
