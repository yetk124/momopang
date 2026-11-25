// 랜덤 매칭: 대기실 채널(presence)에서 같은 게임을 원하는 사람끼리 짝을 지어 방을 만들어요.
// - 온라인: Supabase Realtime 채널 'momopang:match'
// - 데모: 같은 브라우저 탭끼리 BroadcastChannel
// 흐름: 대기열 동기화 → 먼저 온 사람(방장)이 상대에게 제안 → 상대 수락 → 방장이 방 생성, 상대가 입장
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameId } from '../games/types'
import { GAMES } from '../games/registry'
import { getSupabase, supabaseConfigured } from '../net/transports'
import { makeRoomCode } from './rng'
import { getMatchId, isBlocked, isMid } from './safety'

export type MatchGame = GameId | 'any'
/** 랜덤 매칭에서 뺄 게임 (지금은 없음) */
export const MATCH_EXCLUDE: GameId[] = []
export const MATCH_GAMES = GAMES.filter((g) => !MATCH_EXCLUDE.includes(g.id))

interface Waiter { id: string; game: MatchGame; at: number; mid?: string }
type Wire =
  | { t: 'propose'; from: string; to: string; code: string; game: GameId; at: number; mid?: string }
  | { t: 'accept'; from: string; to: string; code: string; mid?: string }
  | { t: 'reject'; from: string; to: string }
  | { t: 'hb'; w: Waiter } // 데모(탭) 모드 전용 하트비트
  | { t: 'bye'; id: string }

/** oppMid: 상대의 매칭 ID (신고·차단용) */
export interface MatchResult { code: string; game: GameId; isHost: boolean; oppMid?: string }

interface Lobby {
  join(me: Waiter): Promise<void>
  onSync(cb: (list: Waiter[]) => void): void
  onMsg(cb: (m: Wire) => void): void
  send(m: Wire): void
  close(): void
}

class SupabaseLobby implements Lobby {
  private ch: RealtimeChannel | null = null
  private syncCb: (l: Waiter[]) => void = () => {}
  private msgCb: (m: Wire) => void = () => {}
  onSync(cb: (l: Waiter[]) => void) { this.syncCb = cb }
  onMsg(cb: (m: Wire) => void) { this.msgCb = cb }
  join(me: Waiter) {
    const sb = getSupabase(); if (!sb) return Promise.reject(new Error('온라인 연결이 필요해요'))
    return new Promise<void>((resolve, reject) => {
      const ch = sb.channel('momopang:match', { config: { broadcast: { self: false }, presence: { key: me.id } } })
      this.ch = ch
      ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && typeof payload.t === 'string') this.msgCb(payload as Wire) })
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState<Waiter>()
        const list: Waiter[] = []
        for (const metas of Object.values(st)) { const w = metas[metas.length - 1]; if (w && typeof w.id === 'string') list.push({ id: w.id, game: w.game, at: Number(w.at) || 0, mid: isMid(w.mid) ? w.mid : undefined }) }
        this.syncCb(list)
      })
      const timer = setTimeout(() => reject(new Error('매칭 서버에 연결하지 못했어요')), 10_000)
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { await ch.track(me); clearTimeout(timer); resolve() }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error('매칭 서버에 연결하지 못했어요')) }
      })
    })
  }
  send(m: Wire) { void this.ch?.send({ type: 'broadcast', event: 'm', payload: m }) }
  close() { if (this.ch) { void this.ch.untrack(); void getSupabase()?.removeChannel(this.ch) } this.ch = null }
}

class LocalLobby implements Lobby {
  private bc: BroadcastChannel | null = null
  private peers = new Map<string, { w: Waiter; seen: number }>()
  private me: Waiter | null = null
  private hb: ReturnType<typeof setInterval> | null = null
  private syncCb: (l: Waiter[]) => void = () => {}
  private msgCb: (m: Wire) => void = () => {}
  onSync(cb: (l: Waiter[]) => void) { this.syncCb = cb }
  onMsg(cb: (m: Wire) => void) { this.msgCb = cb }
  async join(me: Waiter) {
    this.me = me
    this.bc = new BroadcastChannel('momopang-match')
    this.bc.onmessage = (e) => {
      const m = e.data as Wire
      if (m.t === 'hb') { const first = !this.peers.has(m.w.id); this.peers.set(m.w.id, { w: m.w, seen: Date.now() }); if (first) this.emit() }
      else if (m.t === 'bye') { this.peers.delete(m.id); this.emit() }
      else this.msgCb(m)
    }
    const beat = () => {
      this.bc?.postMessage({ t: 'hb', w: me } satisfies Wire)
      const now = Date.now(); let changed = false
      for (const [id, p] of this.peers) if (now - p.seen > 3500) { this.peers.delete(id); changed = true }
      if (changed) this.emit()
    }
    beat(); this.hb = setInterval(beat, 1000)
    this.emit()
  }
  private emit() { if (this.me) this.syncCb([this.me, ...[...this.peers.values()].map((p) => p.w)]) }
  send(m: Wire) { this.bc?.postMessage(m) }
  close() {
    if (this.hb) clearInterval(this.hb)
    if (this.me) this.bc?.postMessage({ t: 'bye', id: this.me.id } satisfies Wire)
    this.bc?.close(); this.bc = null; this.peers.clear()
  }
}

const compatible = (a: MatchGame, b: MatchGame) => a === 'any' || b === 'any' || a === b
const earlier = (a: Waiter, b: Waiter) => a.at - b.at || (a.id < b.id ? -1 : 1)
const randomGame = () => MATCH_GAMES[Math.floor(Math.random() * MATCH_GAMES.length)].id

/** 대기열을 먼저 온 순서로 정렬해서 짝 짓기 (모든 기기가 같은 결과를 얻도록 결정적으로) */
function pairUp(list: Waiter[]) {
  const sorted = [...list].sort(earlier)
  const used = new Set<string>(); const pairs: [Waiter, Waiter][] = []
  for (const a of sorted) {
    if (used.has(a.id)) continue
    const b = sorted.find((x) => x.id !== a.id && !used.has(x.id) && compatible(a.game, x.game))
    if (b) { used.add(a.id); used.add(b.id); pairs.push([a, b]) }
  }
  return pairs
}

/**
 * 매칭 시작. 짝이 지어지면 onMatched 호출 (방장/참가자 역할과 방 코드).
 * 반환값: 취소 함수
 */
export function startMatch(myId: string, game: MatchGame, onMatched: (r: MatchResult) => void, onError: (msg: string) => void) {
  const lobby: Lobby = supabaseConfigured ? new SupabaseLobby() : new LocalLobby()
  const myMid = getMatchId()
  const me: Waiter = { id: myId, game, at: Date.now(), mid: myMid }
  let done = false
  let proposal: { to: string; mid?: string; code: string; game: GameId; timer: ReturnType<typeof setTimeout> } | null = null
  const blocked = new Map<string, number>() // 응답 없던 상대는 잠깐 건너뛰기

  const finish = (r: MatchResult) => {
    if (done) return
    done = true
    if (proposal) clearTimeout(proposal.timer)
    lobby.close()
    onMatched(r)
  }

  const tryPropose = (list: Waiter[]) => {
    if (done || proposal) return
    const now = Date.now()
    // 내가 차단한 사람, 응답 없던/거절한 사람은 빼고 짝 짓기
    const live = list.filter((w) => w.id === myId || ((blocked.get(w.id) ?? 0) < now && !isBlocked(w.mid)))
    const pair = pairUp(live).find(([a, b]) => a.id === myId || b.id === myId)
    if (!pair) return
    const [host, guest] = pair
    if (host.id !== myId) return // 상대가 먼저 왔으면 제안을 기다림
    const g: GameId = host.game !== 'any' ? host.game : guest.game !== 'any' ? guest.game : randomGame()
    const code = makeRoomCode()
    proposal = {
      to: guest.id, mid: guest.mid, code, game: g,
      timer: setTimeout(() => { if (proposal) blocked.set(proposal.to, Date.now() + 8000); proposal = null; tryPropose(lastList) }, 2500),
    }
    lobby.send({ t: 'propose', from: myId, to: guest.id, code, game: g, at: me.at, mid: myMid })
  }

  let lastList: Waiter[] = [me]
  lobby.onSync((list) => { lastList = list; tryPropose(list) })
  lobby.onMsg((m) => {
    if (done || !('to' in m) || m.to !== myId) return
    if (m.t === 'propose') {
      // 내가 차단한 사람이면 거절 (상대는 이번 매칭 동안 나를 다시 고르지 않음)
      if (isBlocked(m.mid) || isBlocked(lastList.find((w) => w.id === m.from)?.mid)) { lobby.send({ t: 'reject', from: myId, to: m.from }); return }
      // 내가 다른 사람에게 제안 중인데, 나보다 먼저 온 사람이 제안하면 그쪽을 받아들임
      if (proposal) { if (m.at > me.at || (m.at === me.at && m.from > myId)) return; clearTimeout(proposal.timer); proposal = null }
      if (!compatible(game, m.game)) return
      lobby.send({ t: 'accept', from: myId, to: m.from, code: m.code, mid: myMid })
      finish({ code: m.code, game: m.game, isHost: false, oppMid: isMid(m.mid) ? m.mid : undefined })
    } else if (m.t === 'accept') {
      if (!proposal || proposal.to !== m.from || proposal.code !== m.code) return
      const oppMid = isMid(m.mid) ? m.mid : proposal.mid
      if (isBlocked(oppMid)) return
      finish({ code: proposal.code, game: proposal.game, isHost: true, oppMid })
    } else if (m.t === 'reject') {
      blocked.set(m.from, Infinity)
      if (proposal && proposal.to === m.from) { clearTimeout(proposal.timer); proposal = null; tryPropose(lastList) }
    }
  })

  lobby.join(me).catch((e: Error) => { if (!done) { done = true; lobby.close(); onError(e.message) } })

  return () => { if (done) return; done = true; if (proposal) clearTimeout(proposal.timer); lobby.close() }
}

export const randomMatchGame = randomGame
