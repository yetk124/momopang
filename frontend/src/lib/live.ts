// 실시간 플레이 인원: 게임 중인 사람은 'momopang:live' 채널에 "나 ○○ 하는 중"을 표시하고,
// 홈에서는 그 채널을 보고 게임별 인원을 셉니다. (DB 저장 없음, 닉네임 등 개인정보 없음)
// - 온라인: Supabase Realtime presence
// - 데모: 같은 브라우저 탭끼리 BroadcastChannel 하트비트
import { useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameId } from '../games/types'
import { getSupabase, supabaseConfigured } from '../net/transports'
import { getPlayerId } from './storage'

export type LiveCounts = Partial<Record<GameId, number>>
interface Entry { id: string; game: GameId | null }

let counts: LiveCounts = {}
let total = 0
const subs = new Set<() => void>()
const emit = (list: Entry[]) => {
  const c: LiveCounts = {}
  for (const e of list) if (e.game) c[e.game] = (c[e.game] ?? 0) + 1
  counts = c
  total = Object.values(c).reduce((a, b) => a + (b ?? 0), 0)
  subs.forEach((f) => f())
}

let started = false
let current: GameId | null = null
let push: (game: GameId | null) => void = () => {}

function start() {
  if (started) return
  started = true
  const myId = getPlayerId()
  if (supabaseConfigured) {
    const sb = getSupabase(); if (!sb) return
    let ch: RealtimeChannel | null = null
    let ready = false
    const connect = () => {
      ch = sb.channel('momopang:live', { config: { presence: { key: myId } } })
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch!.presenceState<Entry>()
        const list: Entry[] = []
        for (const metas of Object.values(st)) { const m = metas[metas.length - 1]; if (m) list.push({ id: String(m.id), game: (m.game as GameId) || null }) }
        emit(list)
      })
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { ready = true; if (current) void ch!.track({ id: myId, game: current }) }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { ready = false }
      })
    }
    connect()
    push = (game) => {
      if (!ch || !ready) return
      if (game) void ch.track({ id: myId, game })
      else void ch.untrack()
    }
  } else {
    if (typeof BroadcastChannel === 'undefined') return
    const bc = new BroadcastChannel('momopang-live')
    const peers = new Map<string, { game: GameId | null; seen: number }>()
    const recount = () => emit([{ id: myId, game: current }, ...[...peers].map(([id, p]) => ({ id, game: p.game }))])
    bc.onmessage = (e) => {
      const m = e.data as { id: string; game: GameId | null; bye?: boolean }
      if (!m || m.id === myId) return
      if (m.bye) peers.delete(m.id); else peers.set(m.id, { game: m.game, seen: Date.now() })
      recount()
    }
    const beat = () => {
      bc.postMessage({ id: myId, game: current })
      const now = Date.now()
      for (const [id, p] of peers) if (now - p.seen > 3500) peers.delete(id)
      recount()
    }
    beat(); setInterval(beat, 1500)
    addEventListener('pagehide', () => bc.postMessage({ id: myId, game: null, bye: true }))
    push = () => beat()
  }
}

/** 지금 하고 있는 게임을 알림 (게임이 아니면 null) */
export function setPlaying(game: GameId | null) {
  start()
  if (current === game) return
  current = game
  push(game)
}

const subscribe = (f: () => void) => { start(); subs.add(f); return () => { subs.delete(f) } }

/** 게임별 실시간 인원 + 전체 인원 */
export function useLiveCounts() {
  const c = useSyncExternalStore(subscribe, () => counts)
  const t = useSyncExternalStore(subscribe, () => total)
  return { counts: c, total: t }
}
