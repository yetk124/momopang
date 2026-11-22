# backend — Supabase

이 앱의 백엔드는 **Supabase** 하나로 구성돼요. 별도 서버(Node 등)는 없어요.

| 구성 | 쓰임 | 위치 |
|---|---|---|
| Realtime Broadcast | 게임 메시지 중계 (입력·방 상태·그림 획) | 설정 불필요 (프론트에서 채널 `duo:방코드` 사용) |
| Realtime Presence | 접속 여부 → 끊김 감지·일시정지 | 설정 불필요 |
| PostgreSQL | 방·결과 기록, 명예의 전당 | `supabase/migrations/` |
| RPC `record_game` | 랭킹 기록 (로그인 시 계정 기준, 검증 + 20초 1회 제한) | 마이그레이션 |
| RPC `merge_guest` | 카카오 로그인 시 게스트 랭킹을 계정으로 합치기 | 마이그레이션 |
| RPC `delete_my_account` | 회원 탈퇴 (계정·프로필·기록·랭킹 삭제) | 마이그레이션 |
| Edge Function `dict-check` | 비밀 API 키를 서버에 두는 프록시 예시 (끝말잇기 사전) | `supabase/functions/dict-check/` |
| Auth (선택) | 익명 로그인 + 비공개 채널 | `config.toml`, 마이그레이션 주석 |

## 처음 세팅
```bash
cd backend
npm install
npx supabase login
SUPABASE_PROJECT_REF=프로젝트ID npm run link
npm run db:push            # migrations/*.sql 적용
```
CLI 없이 하려면: 대시보드 › SQL Editor 에 `supabase/migrations/20261122000000_init.sql` 내용을 붙여넣고 실행.

## 로컬에서 Supabase 띄우기 (Docker 필요)
```bash
npm run start:local        # 로컬 API http://localhost:54321
npm run db:reset:local     # 마이그레이션 다시 적용
```
→ `frontend/.env` 의 URL·키를 로컬 값으로 바꿔서 테스트

## Edge Function (비밀 키)
```bash
cp supabase/.env.example supabase/.env.local   # DICT_API_KEY, ALLOWED_ORIGIN 입력
npm run secrets:set
npm run functions:deploy
```
- 비밀 키는 **여기(backend)에만** 둬요. `frontend/.env` 의 `VITE_` 값은 브라우저에 그대로 공개돼요.
- 프론트 빌드에는 비밀 키가 섞이면 빌드를 멈추는 secret-guard 가 있어요.

## 데이터베이스
| 테이블 | 내용 | 클라이언트 권한 |
|---|---|---|
| `players` | 닉네임(1~10자), 아바타 | 추가만 |
| `rooms` | 방 코드(6자), 방장, 상태, 만료 | 추가, 최근 1일 조회 |
| `game_sessions` | 게임 결과(JSON 8KB 미만) | 추가만 |
| `player_stats` | 누적 승수·판수 (랭킹) — 게스트는 기기 ID, 카카오는 계정 ID 기준 | 조회만, 기록은 `record_game` RPC로만 |
| `profiles` | 카카오 계정 프로필 (닉네임·아바타) | 본인만 읽기·쓰기 |
| `game_history` | 카카오 계정 최근 기록 | 본인만 읽기·추가·삭제 |
| `room_players`, `game_state`, `game_events` | PRD 구조 (서버 판정으로 옮길 때 사용) | 접근 불가 |

모든 테이블 RLS 기본 차단 · CHECK 제약 적용.

## 다음 단계: 서버 판정으로 옮기기
지금은 방장 폰(`frontend/src/net/host.ts`)이 판정해요. 랭킹 보상·유료 기능이 생기면:
1. `frontend/src/games/*/engine.ts` + `host.ts` 리듀서를 Edge Function(또는 전용 서버)으로 이동
2. `game_state` 테이블에 상태 저장, 클라이언트는 입력만 전송
3. 그림 맞히기 제시어를 서버만 알게 처리

## 카카오 로그인
1. [Kakao Developers](https://developers.kakao.com) › 앱 만들기 → **REST API 키** 확인
2. 제품 설정 › 카카오 로그인: 활성화 ON, **Redirect URI** = `https://<프로젝트ID>.supabase.co/auth/v1/callback`
3. 카카오 로그인 › 보안: **Client Secret** 생성·활성화
4. 동의항목: 닉네임(profile_nickname), 프로필 사진(profile_image) — 이메일은 비즈앱만 가능하므로 사용 안 함
5. Supabase 대시보드 › Authentication › Providers › **Kakao**: REST API 키 / Client Secret 입력, **Allow users without an email** 켜기
6. Authentication › URL Configuration › Redirect URLs 에 배포 주소 추가
7. `npm run db:push` (profiles · game_history 테이블, 합치기·탈퇴 함수), `frontend/.env` 에 `VITE_KAKAO_LOGIN=true`

### 카카오 로그인 후 흐름
1. 처음 로그인 → `merge_guest`로 게스트 랭킹을 계정에 합치고, 기기에 있던 최근 기록을 `game_history`에 올림
2. 계정 프로필이 있으면 그대로 사용, 없으면 닉네임·아바타 정하기 → `profiles` 저장
3. 이후 게임 결과는 `game_history`, 랭킹은 계정 기준으로 기록 → 다른 폰에서 로그인해도 유지
4. 탈퇴 → `delete_my_account` (auth 계정 삭제 시 profiles·game_history 자동 삭제)
