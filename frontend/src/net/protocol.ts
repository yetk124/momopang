import type { AvatarId } from '../components/Avatar'
import type { GameId } from '../games/types'

export interface PlayerInfo { id: string; nickname: string; avatar: AvatarId; bot?: boolean; /** 어린이 모드 사용자 (밸런스 게임 연애 질문 제외용) */ kid?: boolean }
export interface PlayerSlot extends PlayerInfo { ready: boolean; connected: boolean }

export interface Clock { startAt: number; pausedTotal: number; pausedAt: number | null }
export interface Session {
  id: string
  game: GameId
  seed: number
  clock: Clock
  state: any
  /** 플레이어별 마지막으로 처리된 입력 seq (낙관적 업데이트 보정용) */
  ack: Record<string, number>
}
export type EndReason = 'time' | 'complete' | 'left' | 'disconnect'
export interface ResultData {
  sessionId: string
  game: GameId
  scores: Record<string, number>
  stats: Record<string, Record<string, number>>
  winnerId: string | null
  endReason: EndReason
  durationMs: number
}
export type Phase = 'lobby' | 'countdown' | 'playing' | 'result'

export interface RoomState {
  code: string
  hostId: string
  players: PlayerSlot[]
  game: GameId | null
  phase: Phase
  countdownEnd: number | null
  session: Session | null
  result: ResultData | null
  rematch: { from: string; at: number } | null
  pause: { since: number; who: string } | null
  closed: boolean
  version: number
}

export type Intent =
  | { type: 'join'; player: PlayerInfo }
  | { type: 'ready'; v: boolean }
  | { type: 'select'; game: GameId }
  | { type: 'act'; a: unknown }
  | { type: 'rematch' }
  | { type: 'rematchAccept' }
  | { type: 'rematchDecline' }
  | { type: 'toLobby' }
  | { type: 'leave' }

export type Msg =
  | { t: 'room'; s: RoomState }
  | { t: 'intent'; from: string; seq: number; i: Intent }
  | { t: 'eph'; from: string; k: string; d: any }
  | { t: 'ping'; from: string; t0: number }
  | { t: 'pong'; to: string; t0: number; h: number }
  | { t: 'hello'; from: string } // 게스트 입장 신호 → 호스트가 room 재전송

export interface Transport {
  readonly kind: 'supabase' | 'local' | 'bot'
  connect(code: string, me: PlayerInfo): Promise<void>
  send(m: Msg): void
  onMessage(cb: (m: Msg) => void): void
  /** 현재 채널에 접속 중인 플레이어 ID 목록 */
  onPresence(cb: (ids: string[]) => void): void
  close(): void
}

export const gameMs = (clock: Clock, hostNow: number) => (clock.pausedAt ?? hostNow) - clock.startAt - clock.pausedTotal
