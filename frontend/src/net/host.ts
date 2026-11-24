import { ENGINES } from '../games/registry'
import { clone } from '../games/types'
import { uid } from '../lib/rng'
import { saveHostState } from '../lib/storage'
import { gameMs, type EndReason, type Intent, type Msg, type PlayerInfo, type RoomState, type Transport } from './protocol'
import { persistResult } from './persist'
import { RateLimiter, cleanIntent } from './validate'

const COUNTDOWN_MS = 3000
const PAUSE_LIMIT_MS = 30_000
const REMATCH_TIMEOUT_MS = 20_000
const LOBBY_DROP_MS = 25_000

export function newRoom(code: string, host: PlayerInfo): RoomState {
  return {
    code, hostId: host.id, players: [{ ...host, ready: false, connected: true }], game: null, phase: 'lobby',
    countdownEnd: null, session: null, result: null, rematch: null, pause: null, closed: false, version: 0,
  }
}

/**
 * 방장 클라이언트에서 돌아가는 '권한 서버'.
 * 모든 입력(intent)을 순서대로 처리하고, 점수/승패를 결정해 전체 방 상태를 브로드캐스트한다.
 * (PRD의 Edge Function 역할을 MVP에서는 방장 기기가 대신함)
 */
export class HostController {
  state: RoomState
  private timer: ReturnType<typeof setInterval>
  private lastBroadcast = 0
  private goneSince = new Map<string, number>()
  private persistKind: 'supabase' | 'local' | 'bot'
  private limiter = new RateLimiter()

  constructor(private transport: Transport, private me: PlayerInfo, private onState: (s: RoomState) => void, initial: RoomState) {
    this.state = initial
    this.persistKind = transport.kind
    // 복구된 상태가 진행 중이었다면 일시정지 상태로 재개
    if (initial.phase === 'playing' && initial.session && !initial.session.clock.pausedAt) {
      const s = clone(initial); s.session!.clock.pausedAt = Date.now(); s.pause = { since: Date.now(), who: this.me.id }; this.state = s
    }
    this.timer = setInterval(() => this.tick(Date.now()), 100)
    this.commit(this.state)
  }

  dispose() { clearInterval(this.timer) }

  handle(m: Msg) {
    if (m.t === 'intent') {
      if (typeof m.from !== 'string' || m.from.length > 64 || m.from === this.me.id || !Number.isFinite(m.seq)) return
      if (!this.limiter.allow(m.from)) return
      const i = cleanIntent(m.i, this.state.session?.game)
      if (i) this.reduce(m.from, m.seq, i)
    }
    else if (m.t === 'ping') this.transport.send({ t: 'pong', to: m.from, t0: m.t0, h: Date.now() })
    else if (m.t === 'hello') this.broadcast()
  }
  local(i: Intent, seq: number) { this.reduce(this.me.id, seq, i) }

  presence(ids: string[]) {
    const now = Date.now()
    const s = clone(this.state); let changed = false
    for (const p of s.players) {
      if (p.id === this.me.id) continue
      const on = ids.includes(p.id)
      if (p.connected !== on) { p.connected = on; changed = true }
      if (on) this.goneSince.delete(p.id); else if (!this.goneSince.has(p.id)) this.goneSince.set(p.id, now)
    }
    if (!changed) return
    const away = s.players.find((p) => !p.connected)
    if (s.phase === 'playing' && s.session) {
      if (away && !s.pause) { s.pause = { since: now, who: away.id }; s.session.clock.pausedAt = now }
      if (!away && s.pause) this.unpause(s, now)
    }
    if (s.phase === 'countdown' && away) { s.phase = 'lobby'; s.countdownEnd = null; s.players.forEach((p) => (p.ready = false)) }
    this.commit(s)
  }

  private unpause(s: RoomState, now: number) {
    const c = s.session!.clock
    if (c.pausedAt) { c.pausedTotal += now - c.pausedAt; c.pausedAt = null }
    s.pause = null
  }

  private reduce(from: string, seq: number, i: Intent) {
    const now = Date.now()
    const s = clone(this.state)
    const slot = s.players.find((p) => p.id === from)
    switch (i.type) {
      case 'join': {
        if (slot) { Object.assign(slot, i.player, { connected: true }) }
        else if (s.players.length < 2) s.players.push({ ...i.player, ready: false, connected: true })
        // 가득 찬 경우에도 상태를 다시 보내 참가자가 '가득 참'을 알 수 있게 함
        if (s.pause && s.players.every((p) => p.connected)) this.unpause(s, now)
        break
      }
      case 'ready': {
        if (!slot || !s.game || (s.phase !== 'lobby' && s.phase !== 'countdown')) return
        slot.ready = i.v
        if (s.phase === 'countdown' && !i.v) { s.phase = 'lobby'; s.countdownEnd = null }
        if (s.phase === 'lobby' && s.players.length === 2 && s.players.every((p) => p.ready && p.connected)) { s.phase = 'countdown'; s.countdownEnd = now + COUNTDOWN_MS }
        break
      }
      case 'select': {
        if (!slot || (s.phase !== 'lobby' && s.phase !== 'countdown') || s.game === i.game) return
        s.game = i.game; s.phase = 'lobby'; s.countdownEnd = null
        s.players.forEach((p) => (p.ready = false)) // 게임이 바뀌면 준비 상태 초기화
        break
      }
      case 'act': {
        const sess = s.session
        if (!slot || s.phase !== 'playing' || !sess) return
        sess.ack[from] = Math.max(sess.ack[from] ?? 0, seq)
        if (!s.pause) {
          const next = ENGINES[sess.game].apply(sess.state, from, i.a, gameMs(sess.clock, now))
          if (next) sess.state = next
        }
        break
      }
      case 'rematch': {
        if (!slot || s.phase !== 'result') return
        if (s.rematch && s.rematch.from !== from) { this.startCountdown(s, now); break }
        s.rematch = { from, at: now }
        break
      }
      case 'rematchAccept': {
        if (!slot || s.phase !== 'result' || !s.rematch || s.rematch.from === from) return
        this.startCountdown(s, now)
        break
      }
      case 'rematchDecline':
      case 'toLobby': {
        if (!slot) return
        this.toLobby(s)
        break
      }
      case 'leave': {
        if (from === s.hostId) { s.closed = true; break }
        if (!slot) return
        if (s.phase === 'playing') this.finish(s, now, 'left', s.hostId)
        s.players = s.players.filter((p) => p.id !== from)
        if (s.phase !== 'result') this.toLobby(s)
        else s.rematch = null
        break
      }
    }
    this.commit(s)
  }

  private toLobby(s: RoomState) {
    s.phase = 'lobby'; s.countdownEnd = null; s.rematch = null; s.session = null; s.result = null; s.pause = null
    s.players.forEach((p) => (p.ready = false))
  }

  private startCountdown(s: RoomState, now: number) {
    s.players.forEach((p) => (p.ready = true))
    s.rematch = null; s.phase = 'countdown'; s.countdownEnd = now + COUNTDOWN_MS
  }

  private finish(s: RoomState, now: number, reason: EndReason, forcedWinner?: string) {
    const sess = s.session!
    const r = ENGINES[sess.game].result(sess.state)
    const ids = s.players.map((p) => p.id)
    let winnerId: string | null = forcedWinner ?? null
    if (!forcedWinner && ids.length === 2) {
      const [a, b] = ids
      winnerId = (r.scores[a] ?? 0) === (r.scores[b] ?? 0) ? null : (r.scores[a] ?? 0) > (r.scores[b] ?? 0) ? a : b
    }
    s.result = { sessionId: sess.id, game: sess.game, scores: r.scores, stats: r.stats, winnerId, endReason: reason, durationMs: Math.max(0, gameMs(sess.clock, now)) }
    s.phase = 'result'; s.pause = null; s.rematch = null
    s.players.forEach((p) => (p.ready = false))
    if (this.persistKind === 'supabase') void persistResult(s.code, s.result)
  }

  private tick(now: number) {
    const cur = this.state
    if (cur.closed) return
    const box: { s: RoomState | null } = { s: null }
    const w = (): RoomState => (box.s ??= clone(cur))

    if (cur.phase === 'countdown' && cur.countdownEnd && now >= cur.countdownEnd && cur.game) {
      const st = w()
      const seed = Math.floor(Math.random() * 2 ** 31)
      const ids = st.players.map((p) => p.id)
      st.session = { id: uid(), game: st.game!, seed, clock: { startAt: now, pausedTotal: 0, pausedAt: null }, state: ENGINES[st.game!].init(seed, ids), ack: {} }
      st.phase = 'playing'; st.countdownEnd = null; st.result = null
    } else if (cur.phase === 'playing' && cur.session) {
      if (cur.pause) {
        if (now - cur.pause.since > PAUSE_LIMIT_MS) {
          const st = w(); const stay = st.players.find((p) => p.connected)?.id ?? this.me.id
          this.finish(st, now, 'disconnect', stay)
        }
      } else {
        const eng = ENGINES[cur.session.game]
        const t = gameMs(cur.session.clock, now)
        const nx = eng.tick?.(cur.session.state, t)
        if (nx) w().session!.state = nx
        const st = box.s ?? cur
        if (eng.isOver(st.session!.state, t)) this.finish(w(), now, t >= ENGINES_DURATION(cur.session.game) ? 'time' : 'complete')
      }
    } else if (cur.phase === 'result' && cur.rematch && now - cur.rematch.at > REMATCH_TIMEOUT_MS) {
      this.toLobby(w())
    } else if (cur.phase === 'lobby') {
      for (const [id, since] of this.goneSince) {
        if (now - since > LOBBY_DROP_MS && cur.players.some((p) => p.id === id && !p.connected)) {
          const st = w(); st.players = st.players.filter((p) => p.id !== id); this.goneSince.delete(id)
        }
      }
    }
    if (box.s) this.commit(box.s)
    else if (now - this.lastBroadcast > 4000) this.broadcast() // 유실 대비 주기적 동기화
  }

  private commit(s: RoomState) {
    s.version = (this.state.version ?? 0) + 1
    this.state = s
    if (this.persistKind !== 'bot') saveHostState(s.code, s)
    this.broadcast()
    this.onState(s)
  }
  private broadcast() { this.lastBroadcast = Date.now(); this.transport.send({ t: 'room', s: this.state }) }
}

const DUR: Record<string, number> = { apple: 60_000, halli: 90_000, rush: 20_000, block: 180_000, spot: 90_000, word: 90_000, pairs: 150_000, merge: 120_000, suika: 120_000, draw: Infinity }
const ENGINES_DURATION = (g: string) => DUR[g] ?? Infinity
