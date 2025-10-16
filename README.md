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

### **Disclaimer**
**이 프로젝트는 개인적인 연습용 프로젝트로, 실제 서비스를 위한 것이 아닙니다.**
<br/>
**이 프로젝트를 사용하여 발생하는 모든 문제에 대해 책임지지 않습니다.**
<br/>
**프로젝트 이름 등 세부적인 사항들은 추후 변경될 수 있습니다.**
