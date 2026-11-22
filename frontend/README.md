# frontend — 모모팡

> 백엔드(Supabase) 설정은 [`../backend/README.md`](../backend/README.md) 를 보세요.

전화하면서 둘이 같이 하는 실시간 미니게임 PWA.
React · TypeScript · Vite · Tailwind · Zustand · Supabase Realtime · GA4

## 게임 (12종)
사과게임 · 할리갈리 · 그림 맞히기 · 숫자 찾기 · 블록 퍼즐(8×8) · 다른 그림 찾기(7개 그림) ·
끝말잇기 · 스피드 퀴즈 · 폭탄 돌리기 · 기억력 게임 · 짝 맞추기(턴제) · 숫자 합치기

## 실행
```bash
npm install
cp .env.example .env   # 값 채우기 (비워두면 데모 모드)
npm run dev            # http://localhost:5173
npm run build          # dist/ 생성 (타입 체크 포함)
npm run preview
```
- 키가 없으면 **봇이랑 연습** + **같은 브라우저 탭끼리 연결**로 전부 테스트할 수 있어요.
- `npm run build:single` → 이미지까지 한 파일로 묶은 `dist-single/index.html` (데모 공유용)

## 1. Supabase 연결 (다른 기기끼리 플레이)
1. supabase.com 프로젝트 생성 → Project Settings › API 의 **URL**, **anon public key**를 `.env`에
2. (권장) SQL Editor 에서 `backend/supabase/migrations/20261122000000_init.sql` 실행 — 방/결과 기록 + RLS 보안 정책
3. (선택, 보안 강화) Authentication › Providers › **Anonymous sign-ins** 켜기 →
   init.sql 마이그레이션 아래쪽 realtime 정책 주석 해제 후 실행 → `.env`에 `VITE_SUPABASE_PRIVATE_CHANNELS=true`

## 2. Google Analytics 4
1. analytics.google.com → 속성 만들기 → 데이터 스트림(웹)에 배포 도메인 등록
2. 측정 ID(`G-XXXXXXX`)를 `.env`의 `VITE_GA_MEASUREMENT_ID`에
3. 첫 화면에 수집 안내가 뜨고 기본으로 수집해요. '보내지 않기' 또는 설정 › 사용 통계 보내기로 거부할 수 있어요 (옵트아웃)

| 이벤트 | 내용 | 주요 파라미터 |
|---|---|---|
| `page_view`, `screen_view` | 화면 진입 | `screen_name` (home, lobby, game_apple, result_apple, settings …) |
| `screen_time` | 화면을 떠날 때 머문 시간 | `screen_name`, `seconds` |
| `ui_click` | 누른 버튼 | `label`(버튼 글자/이름), `screen_name` |
| `room_create` / `room_join` / `room_leave` | 방 만들기·입장·나가기 | `mode`, `game`, `phase` |
| `game_select` / `game_start` / `game_end` | 게임 선택·시작·종료 | `game`, `outcome`, `duration_sec`, `score`, `end_reason` |
| `rematch_request` | 다시하기 요청 | `game` |

GA에서 보기: **보고서 › 참여도 › 페이지 및 화면**(화면별 체류), **이벤트**(`ui_click`의 `label`).
`label`, `seconds`, `game`, `outcome` 같은 파라미터는 **관리 › 맞춤 정의 › 맞춤 측정기준/측정항목**에 등록해야 보고서에 보여요.
특정 버튼 이름을 고정하고 싶으면 요소에 `data-track="이름"`을 붙이면 돼요.

## 3. 배포 (Netlify / Vercel)
- `public/_headers`(Netlify), `vercel.json`(Vercel)에 **SPA 리라이트 + 보안 헤더(CSP 등)**가 들어 있어요.
- 다른 외부 서비스를 붙이면 CSP의 `connect-src`/`script-src`에 도메인을 추가하세요.
- HTTPS에서 서비스워커가 등록되어 **홈 화면에 설치(PWA)** 할 수 있어요.

## 보안 정리
| 항목 | 적용 내용 |
|---|---|
| 입력 칸 화이트리스트 | 닉네임(한글·영문·숫자·공백·_.-), 끝말잇기(한글), 정답(한글·영문·숫자) 외 문자는 입력 즉시 제거 → `<script>`, 따옴표, 백틱 등 코드 문자 차단 |
| 네트워크 입력 검증 | 상대 기기에서 온 모든 값을 게임별 스키마로 검사, 알려진 필드만 복사(프로토타입 오염 차단) (`src/net/validate.ts`) |
| XSS | React 자동 이스케이프, `innerHTML`/`eval` 미사용, CSP로 외부 스크립트 차단 |
| 저장소 변조 | localStorage 프로필도 읽을 때 다시 검증 |
| 비속어 | 닉네임 기본 필터 (목록 확장 가능) |
| URL | 초대 코드 `^[A-Z0-9]{6}$` 만 허용 |
| 도배 방지 | 플레이어별 초당 입력 25회 제한, 랭킹 기록 20초 1회 |
| 가짜 상태 주입 | 참가자는 처음 확인한 방장 ID의 방 상태만 받음 |
| DB | RLS 기본 차단, 추가만 허용, CHECK 제약, 랭킹은 RPC로만 (SQL 인젝션은 Supabase 클라이언트가 파라미터화) |
| 헤더 | CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS |
| 소스맵 | 배포본에 포함하지 않음 |

### API 키 관리
| 키 | 어디에 | 비고 |
|---|---|---|
| Supabase URL · anon(publishable) 키 | `.env` (`VITE_`) | **공개돼도 되는 키**. 보호는 RLS 정책이 담당 |
| GA 측정 ID | `.env` (`VITE_`) | 공개 값 |
| Supabase service_role / secret 키 | **절대 프론트 금지** | 대시보드·서버에서만 |
| 외부 API 비밀 키 (예: 사전 API) | `supabase secrets set` → Edge Function | 예시: `backend/supabase/functions/dict-check` |

- `VITE_` 로 시작하는 값은 빌드 파일에 그대로 들어가요. 빌드 시 **secret-guard**가 비밀 키처럼 보이는 이름·값(service_role JWT, `sb_secret_`)을 발견하면 빌드를 멈춰요.
- `.env` 는 `.gitignore` 에 포함. GitHub 저장소의 **Secret scanning / Push protection** 을 켜두세요.
- 익명 로그인을 쓰면 Supabase Auth 의 **CAPTCHA(Turnstile/hCaptcha)** 를 켜서 봇 가입을 막을 수 있어요.

**남은 한계:** 지금은 방장 기기가 점수를 판정해요(친구끼리 MVP 기준). 방장이 앱을 조작하면 결과를 바꿀 수 있고, 그림 맞히기 제시어도 상대 기기 메모리에 있어요. 랭킹·보상처럼 공정성이 중요해지면 `src/net/host.ts`의 리듀서(순수 함수)를 Supabase Edge Function / 전용 서버로 옮기세요.

## 구조
```
src/
  games/<게임>/engine.ts     순수 게임 로직 (init / apply / tick / isOver / result)
  games/<게임>/*Game.tsx     게임 화면
  games/registry.ts          게임 목록·규칙·점수 안내
  net/host.ts                방장 권한 로직 (입장·준비·카운트다운·판정·재경기·끊김)
  net/validate.ts            입력 검증 · 레이트 리밋
  net/transports.ts          Supabase / 로컬 탭 / 봇 연결
  net/bot.ts                 연습용 봇
  lib/analytics.ts           GA4
  lib/settings.ts, bgm.ts    설정 · 배경음
  store.ts                   Zustand 스토어, 시계 동기화, 낙관적 업데이트
  screens/                   온보딩 · 홈 · 대기방/게임/결과 · 기록 · 설정
  assets/                    캐릭터 · 아이콘 · 카드 · 퍼즐 이미지 (webp)
supabase/init.sql 마이그레이션          테이블 + RLS
```

## 네이티브 앱으로 내고 싶다면
PWA로 바로 설치할 수 있고, 스토어 등록이 필요하면 Capacitor로 감싸면 돼요:
`npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios && npx cap init && npm run build && npx cap add android`
