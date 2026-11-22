# 모모팡

통화하면서 둘이 같이 하는 실시간 미니게임 PWA (게임 12종)

```
duo-play/
├─ frontend/   화면 · 게임 · 실시간 통신 클라이언트  (React + TS + Vite + Tailwind + Zustand)
│   └─ src/
│       ├─ screens/   화면 (홈·대기방·게임·결과·기록·설정·404)
│       ├─ games/     게임 12종 (engine.ts 규칙 + *Game.tsx 화면)
│       ├─ net/       ★ 백엔드 연결부 (Supabase 실시간·방장 판정·검증·DB 기록)
│       ├─ lib/       설정·소리·GA4·저장소
│       └─ assets/    이미지·음악
│
└─ backend/    Supabase (PostgreSQL · Realtime · Edge Functions)
    └─ supabase/
        ├─ migrations/   DB 테이블 · RLS 보안 정책 · 랭킹 함수
        ├─ functions/    Edge Function (비밀 키를 서버에 두는 API 프록시)
        └─ config.toml   Supabase CLI 로컬 설정
```

## 빠르게 실행 (키 없이 데모)
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173  → 봇 연습 / 같은 브라우저 탭끼리 대전
```

## 실제 서비스 연결 순서
| 순서 | 어디서 | 할 일 |
|---|---|---|
| 1 | supabase.com | 프로젝트 생성 |
| 2 | `backend/` | `npm install` → `npx supabase login` → `SUPABASE_PROJECT_REF=xxxx npm run link` → `npm run db:push` (DB 테이블 생성) |
| 3 | `frontend/` | `.env.example` → `.env` 복사 후 Supabase URL · anon 키 · GA 측정 ID 입력 |
| 4 | `frontend/` | `npm run dev` → 기기 2대에서 방 코드로 접속 테스트 |
| 5 | Vercel/Netlify | **Root Directory = `frontend`**, Build = `npm run build`, Output = `dist` |
| 6 | (선택) `backend/` | 사전 API 등 비밀 키 → `supabase/.env.local` → `npm run secrets:set` → `npm run functions:deploy` |

자세한 내용: [`frontend/README.md`](frontend/README.md), [`backend/README.md`](backend/README.md)

## 프론트 ↔ 백엔드 연결 방식
```
frontend/src/store.ts ──intent──▶ frontend/src/net/transports.ts ──▶ Supabase Realtime 채널 "duo:방코드"
                                                                         │
            방장 폰: frontend/src/net/host.ts (입력 검증 → 게임 판정) ◀──┘
                     └─ room(방 전체 상태) 브로드캐스트 ──▶ 양쪽 화면
게임 종료 → frontend/src/net/persist.ts ──▶ backend 테이블 (rooms · game_sessions · player_stats via record_game)
```
> 게임 판정은 지금 **방장 폰(frontend/src/net/host.ts)** 이 해요. 공정성이 중요해지면 이 순수 함수를 `backend/supabase/functions/` 로 옮기면 됩니다.
