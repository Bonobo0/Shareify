# 데이터베이스 설정 가이드

## 개요

Shareify는 PostgreSQL과 MongoDB 두 가지 데이터베이스를 지원하며, 관리자 페이지에서 사용할 데이터베이스를 선택할 수 있습니다.

## 데이터베이스 설정 방법

### 1. 환경 변수 설정

`.env` 파일에 사용할 데이터베이스의 연결 정보를 설정합니다:

```bash
# PostgreSQL (권장)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# MongoDB (레거시)
MONGODB_URI=mongodb://localhost:27017/shareify
```

**둘 다 설정할 수 있습니다.** 관리자 페이지에서 사용할 데이터베이스를 선택할 수 있습니다.

### 2. 관리자 페이지에서 데이터베이스 선택

1. 관리자 계정으로 로그인
2. `/admin/db-settings` 페이지 접속 (또는 관리자 페이지에서 "DB 설정" 버튼 클릭)
3. 원하는 데이터베이스 선택:
   - **자동**: PostgreSQL이 설정되어 있으면 PostgreSQL, 아니면 MongoDB 사용
   - **PostgreSQL**: PostgreSQL 사용 (권장)
   - **MongoDB**: MongoDB 사용 (레거시)
4. "저장" 버튼 클릭

### 3. 연결 테스트

설정 페이지에서 각 데이터베이스의 "연결 테스트" 버튼을 클릭하여 연결을 확인할 수 있습니다.

## 설정 파일

데이터베이스 선택 설정은 `.db-settings.json` 파일에 저장됩니다. 이 파일은:

- 자동으로 생성됩니다
- 애플리케이션 루트 디렉토리에 위치합니다
- `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다

## 우선순위

데이터베이스 선택 우선순위:

1. **관리자 설정** (`.db-settings.json`의 `preferredDatabase` 값)
2. **환경 변수** (`DATABASE_URL` 또는 `MONGODB_URI`)
3. **기본값** (MongoDB)

## 문제 해결

### "getaddrinfo ENOTFOUND" 오류

이 오류는 DATABASE_URL이 잘못 설정되었을 때 발생합니다:

1. `.env` 파일의 DATABASE_URL 확인
2. 호스트명이 올바른지 확인
3. 네트워크 연결 확인
4. 관리자 페이지에서 "연결 테스트" 실행

**이제 이 오류가 발생해도 앱이 크래시되지 않습니다.** 대신 오류 메시지가 표시되고 다른 데이터베이스를 사용할 수 있습니다.

### 설정이 적용되지 않는 경우

1. 애플리케이션 재시작
2. `.db-settings.json` 파일 확인
3. 브라우저 캐시 삭제

### 데이터베이스 마이그레이션

MongoDB에서 PostgreSQL로 데이터를 마이그레이션하려면:

1. `/admin/migration` 페이지 접속
2. "전체 마이그레이션" 또는 단계별 마이그레이션 실행
3. 마이그레이션 상태 확인

자세한 내용은 `MIGRATION.md` 파일을 참조하세요.

## API

### Server Actions

#### `getDBConfig()`
현재 데이터베이스 설정을 가져옵니다.

```javascript
const { settings, effectiveType, available } = await getDBConfig();
```

#### `updateDBConfig({ preferredDatabase })`
데이터베이스 설정을 변경합니다.

```javascript
await updateDBConfig({ preferredDatabase: 'postgresql' });
// 'auto' | 'postgresql' | 'mongodb'
```

#### `testDBConnection({ dbType })`
데이터베이스 연결을 테스트합니다.

```javascript
await testDBConnection({ dbType: 'postgresql' });
// 'postgresql' | 'mongodb'
```

### Database Router

#### `getDBType()`
현재 사용 중인 데이터베이스 타입을 반환합니다.

```javascript
import { getDBType } from '@/lib/db/router';
const dbType = await getDBType(); // 'postgresql' | 'mongodb' | 'none'
```

#### `clearDBTypeCache()`
데이터베이스 타입 캐시를 지웁니다 (설정 변경 후 호출).

```javascript
import { clearDBTypeCache } from '@/lib/db/router';
clearDBTypeCache();
```

## 보안 고려사항

- 데이터베이스 연결 정보는 환경 변수로만 관리됩니다
- `.db-settings.json`에는 민감한 정보가 저장되지 않습니다
- 데이터베이스 설정 변경은 관리자만 가능합니다
- 연결 테스트 기능도 관리자 권한이 필요합니다

## 권장사항

1. **프로덕션 환경**: PostgreSQL 사용 권장
2. **개발 환경**: 편의에 따라 선택 가능
3. **마이그레이션**: 점진적 마이그레이션을 위해 둘 다 설정하고 자동 모드 사용
4. **백업**: 데이터베이스 변경 전 반드시 백업 수행
