# Plan Game (레트로 집중 타이머)

ADHD 성향의 사용자가 “할 일 시작”을 조금 더 게임처럼 느끼도록 만든 레트로 픽셀 아트 스타일의 인터벌 타이머 웹앱입니다. 실행 시간과 쉬는 시간, 세트 수를 설정하여 작은 퀘스트를 클리어하는 흐름을 목표로 합니다.

> 기존에 기획되었던 멀티플레이(방 만들기) 기능은 앱의 직관성과 가벼움을 위해 과감히 제거하고, 개인의 극한 집중을 돕는 **무한 루프형 인터벌 타이머(타바타/뽀모도로 스타일)**로 전면 개편되었습니다.

## 포트폴리오 프리뷰

자세한 기획 의도, 핵심 기능, 보안 체크리스트, 확장 계획은 [docs/PREVIEW.md](./docs/PREVIEW.md)에 정리했습니다.

## 배포 링크

[https://app-01-focus-together.pages.dev](https://app-01-focus-together.pages.dev)

## 주요 기능

- 직관적인 실행 시간 / 쉬는 시간 분리 설정
- `+1초`, `+10초`, `+1분`, `+1시간` 등 퀵 버튼을 통한 빠른 시간 입력
- 반복 세트 수 설정
- `집중(FOCUS) → 휴식(BREAK) → 집중(FOCUS)` 사이클 자동 전환 (State Machine)
- 모바일 오디오 컨텍스트 최적화 (iOS Safari 등에서도 카운트다운/완료 비프음 완벽 지원)
- 8-bit 레트로 아케이드 감성의 반응형 UI (네온 테두리, 픽셀 폰트)

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

- 별도의 백엔드나 DB 연동 없이 브라우저 단에서 순수하게 동작하는 가벼운 Client-Side 앱입니다.
- `.env`와 실제 API 키는 Git에 커밋하지 않습니다.
- `VITE_` 환경변수는 브라우저에서 노출될 수 있으므로 공개 가능한 키만 사용합니다.
- 자세한 보안 운영 메모는 [SECURITY.md](./SECURITY.md)를 참고하세요.

## 기술 스택

React · Vite · CSS · Cloudflare Pages
