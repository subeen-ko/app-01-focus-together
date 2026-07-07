# 같이집중

각자 할 일을 들고 모여 함께 시작하는 소셜 집중 타이머입니다. 모두 `레디고!`를 누르면 같은 타이머로 집중하고, 쉬는 시간에는 방 사람들과 채팅할 수 있습니다.

## 주요 기능

- 공개방 / 4자리 PIN 잠금방과 6자리 코드 입장
- 참가자별 할 일과 준비 상태
- 초·분·시간 단위의 집중 및 휴식 시간 설정
- 집중 → 휴식 → 다음 세션 흐름
- 휴식 시간 전용 채팅
- 탭 이탈을 스스로 확인하는 선택형 집중 수호 모드
- Supabase 미연결 시 로컬 데모 모드

## 로컬 실행

```bash
npm install
npm run dev
```

별도 설정 없이 데모 모드로 실행됩니다. 여러 기기에서 실시간으로 사용하려면 `.env.example`을 `.env`로 복사해 Supabase 프로젝트 정보를 입력하고, `supabase_schema.sql`을 Supabase SQL Editor에서 실행하세요.

Supabase Dashboard의 Authentication 설정에서 Anonymous Sign-Ins를 활성화해야 합니다. 공개 운영 전에는 CAPTCHA/Cloudflare Turnstile과 예산 알림도 설정하세요.

## 보안 원칙

- `.env`와 모든 로컬 환경변수 파일은 Git에서 제외합니다.
- `VITE_` 환경변수는 F12에서 볼 수 있으므로 Supabase publishable 키만 넣습니다.
- `service_role`, `sb_secret_`, AWS·결제·문자 API 키는 프론트엔드에서 사용하지 않습니다.
- 서버는 브라우저가 보낸 사용자 ID 대신 Supabase Auth의 `auth.uid()`를 사용합니다.
- 모든 쓰기 작업은 권한·입력값·호출 빈도를 검사하는 RPC를 통해서만 처리합니다.
- PIN은 `pgcrypto`의 bcrypt 해시로 별도 비공개 스키마에 저장합니다.
- 공개방을 제외한 참가자와 채팅 데이터는 같은 방 참가자만 읽을 수 있습니다.

자세한 운영 전 점검은 [SECURITY.md](./SECURITY.md)를 참고하세요.

## 기술 스택

React · Vite · Supabase Realtime · Lucide Icons
