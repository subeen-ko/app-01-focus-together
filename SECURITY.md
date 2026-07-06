# Security Policy

## 현재 보안 모델

이 프로젝트는 Supabase Auth의 익명 사용자 JWT와 PostgreSQL RLS를 사용합니다. 클라이언트가 보내는 사용자 ID는 권한 판단에 사용하지 않으며, 모든 쓰기 작업은 `auth.uid()`를 확인하는 제한된 RPC를 거칩니다.

## 배포 전 필수 점검

- Supabase Anonymous Sign-Ins 활성화
- Auth CAPTCHA 또는 Cloudflare Turnstile 활성화
- Supabase Security Advisor의 모든 경고 검토
- 운영 도메인만 허용하도록 Auth URL 설정
- Vercel/Supabase의 사용량·예산 알림 설정
- Sentry 등 오류 모니터링 연결 시 개인정보와 채팅 내용 마스킹
- GitHub Dependabot 보안 업데이트 검토 및 병합
- 관리자 기능을 추가할 경우 URL이 아닌 서버 권한으로 보호
- 삭제·결제·계정 연결 기능에는 재확인 절차 추가

## 환경변수 규칙

브라우저에서는 아래 값만 허용합니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

`VITE_` 접두사는 비밀 저장소가 아닙니다. 해당 값은 빌드 결과물에 포함됩니다. `service_role`, `sb_secret_`, AWS, 문자, 결제 API 비밀키는 서버 또는 Supabase Edge Function의 비밀 환경변수로만 관리해야 합니다.

## 취약점 신고

실제 서비스의 취약점을 발견했다면 공개 Issue에 공격 방법이나 개인정보를 적지 말고, GitHub 저장소의 **Security → Report a vulnerability**를 사용하세요.
