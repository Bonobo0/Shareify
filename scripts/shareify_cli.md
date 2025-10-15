# Shareify CLI 도우미

이 문서는 개인용 CLI API를 통해 Shareify에 파일을 업로드할 수 있는 커맨드라인 도구 `shareify_cli.py`의 사용법을 설명합니다.

## 준비 사항
- Python 3.9 이상
- `requests` 패키지 (대부분의 Python 환경에 기본 포함)
- 선택 사항: `--encrypt` 옵션 사용 시 `cryptography` 패키지

필요한 패키지가 없다면 아래 명령으로 설치하세요.
```
pip install requests cryptography
```

## 시작하기
1. Shareify 서버가 동작하도록 `.env.example`을 `.env`로 복사한 뒤 필수 환경 변수를 채워 넣습니다.
2. `scripts/` 디렉터리로 이동합니다.
   ```
   cd scripts
   ```
3. 다음 명령으로 CLI를 실행합니다.
   ```
   python3 shareify_cli.py upload path/to/file
   ```

## 인증 방식
CLI는 기존 JWT(`--token`)를 재사용하거나 계정 자격 증명을 이용해 로그인할 수 있습니다. 로그인 시 아래 항목을 지원합니다.
- 이메일 + 비밀번호
- 2단계 인증 코드 (`--two-factor` 또는 `--prompt-two-factor`)
- 백업 코드 (`--use-backup-code`)

## 자격 증명 파일
간단한 키-값 형식의 파일에서 자격 증명을 읽어들일 수 있습니다. `--credential-file` 옵션이나 환경 변수 `SHAREIFY_CREDENTIAL_FILE`로 경로를 지정하세요.

```
EMAIL=you@example.com
PASSWORD=your-password
TWO_FACTOR_CODE=123456   # 선택 사항
USE_BACKUP_CODE=true     # 선택 사항
ENCRYPTION_PASSWORD=secretpass  # 선택 사항, --encrypt 사용 시 적용
```

디렉터리에 `.credential` 파일이 있다면 자동으로 사용합니다.

## 명령어 안내
현재 CLI는 `upload` 명령을 제공합니다.

```
python3 shareify_cli.py upload FILE [options]
```

### 일반 옵션
- `--base-url URL` – Shareify 배포 주소 (기본값 `http://localhost:3000`)
- `--token TOKEN` – 로그인 없이 기존 JWT 사용
- `--credential-file PATH` – 자격 증명 파일 경로
- `--email`, `--password`, `--two-factor` – 명령행에서 직접 자격 증명 입력
- `--prompt-two-factor` – 2FA 코드가 없을 경우 입력 요청
- `--use-backup-code` – 제공한 2FA 코드를 백업 코드로 처리
- `--directory-id ID` – 사용자가 작성 권한을 가진 디렉터리에 업로드
- `--share-hash HASH` – 공유 링크 해시로 공유 디렉터리에 업로드
- `--mime MIME` – 업로드 시 기록할 MIME 타입 덮어쓰기

### 클라이언트 측 암호화
- `--encrypt` – 업로드 전에 로컬에서 파일 암호화
- `--encryption-password PASSWORD` – 암호화에 사용할 비밀번호 (자격 증명 파일 값 또는 프롬프트 사용)

암호화는 PBKDF2로 파생한 키를 이용한 AES-CTR 방식을 사용하며, 복호화 시 잘못된 비밀번호를 차단하기 위해 인증 태그를 포함합니다. 암호화된 파일은 `.encrypted` 확장자로 저장되며, 원본 파일 정보가 자동으로 메타데이터에 포함됩니다.

### 이미 암호화된 파일 처리
다른 도구로 이미 암호화된 파일이라면 재암호화 없이 아래 옵션으로 표시할 수 있습니다.
- `--encrypted` – 입력 파일이 이미 암호화되었음을 표시
- `--original-name NAME` – 암호화 이전의 원본 파일명
- `--original-size BYTES` – 암호화 이전의 원본 파일 크기 (바이트)
- `--original-mime MIME` – 암호화 이전의 원본 MIME 타입

`--encrypted` 옵션을 사용하면 위 메타데이터를 모두 제공해야 합니다.

## 종료 코드
- `0` – 성공
- 기타 – 오류 발생 (stderr에서 상세 메시지 확인)

## 사용 예시
기본 업로드 (자격 증명은 프롬프트로 입력):
```
python3 shareify_cli.py upload ~/Documents/report.pdf
```

자격 증명 파일을 사용하고 클라이언트 측 암호화 적용:
```
python3 shareify_cli.py upload backup.zip --credential-file .credential --encrypt
```

기존 토큰을 이용해 공유 디렉터리에 업로드:
```
python3 shareify_cli.py upload image.png --token <JWT> --share-hash abcd1234
```

## 문제 해결
- **`cryptography` 패키지 없음** – `--encrypt` 사용 시 오류가 나면 패키지를 설치하세요.
- **인증 실패** – 이메일/비밀번호를 확인하고, 계정에 CLI 접근 권한이 활성화되어 있는지 검토하세요.
- **레이트 리미트 오류** – 응답 헤더에 `Retry-After`가 있을 수 있으니 해당 시간 이후 재시도하세요.
- **업로드 실패** – Shareify 서버에 접근 가능한지, R2 관련 환경 변수가 올바른지 확인하세요.
