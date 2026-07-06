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

`.env`는 Git에서 제외됩니다. Supabase의 `service_role` 키는 브라우저 환경변수에 절대 넣지 마세요.

## 기술 스택

React · Vite · Supabase Realtime · Lucide Icons
