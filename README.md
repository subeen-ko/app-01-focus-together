# 같이집중

ADHD 성향의 사용자가 “할 일 시작”을 조금 더 게임처럼 느끼도록 만든 레트로 집중 타이머 웹앱입니다. 집중 시간과 쉬는 시간을 초·분·시 단위로 빠르게 조합하고, 여러 세트를 반복하며 작은 퀘스트를 클리어하는 흐름을 목표로 합니다.

> 현재 버전은 Cloudflare Pages 배포에 맞춘 프론트엔드 타이머 MVP입니다. 방 만들기/실시간 파티 기능은 이후 Supabase 연동 버전으로 확장할 수 있도록 보안 설계 문서를 함께 정리했습니다.

## 포트폴리오 프리뷰

자세한 기획 의도, 핵심 기능, 보안 체크리스트, 확장 계획은 [docs/PREVIEW.md](./docs/PREVIEW.md)에 정리했습니다.

## 배포 링크

[https://app-01-focus-together.pages.dev](https://app-01-focus-together.pages.dev)

## 주요 기능

- 집중 시간 / 쉬는 시간 전환
- `+1초`, `+10초`, `+1분`, `+1시간` 등 빠른 시간 입력
- 반복 세트 수 설정
- 집중 → 휴식 → 다음 집중 자동 전환
- 마지막 5초 비프음과 완료 효과음
- 레트로 게임 콘솔 느낌의 반응형 UI

## 로컬 실행

```bash
npm install
npm run dev
```

## 프로덕션 빌드

```bash
npm run build
```

Cloudflare Pages 설정:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

## 보안 메모

- `.env`와 실제 API 키는 Git에 커밋하지 않습니다.
- `VITE_` 환경변수는 브라우저에서 노출될 수 있으므로 공개 가능한 키만 사용합니다.
- 비밀 키, AWS 키, 결제/SMS 키, Supabase `service_role` 키는 프론트엔드에 넣지 않습니다.
- 로그인, 방 권한, 채팅, PIN 검증 같은 서버성 기능은 DB RLS/RPC 또는 별도 백엔드에서 처리합니다.
- 자세한 보안 운영 메모는 [SECURITY.md](./SECURITY.md)를 참고하세요.

## 기술 스택

React · Vite · CSS · Cloudflare Pages
