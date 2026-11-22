import { mulberry32, shuffle } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const HALLI_TIME = 90_000
export const FRUITS = ['딸기', '바나나', '포도', '레몬'] as const
export const AUTO_FLIP_MS = 3500
export interface Card { f: number; n: number }
export interface HalliPlayer { score: number; streak: number; correct: number; wrong: number; lockUntil: number }
export interface HalliState {
  players: string[]
  decks: Record<string, Card[]>
  top: Record<string, Card | null>
  turn: string
  lastFlip: number
  pauseUntil: number
  clearPending: boolean
  locked: boolean
  flips: number
  p: Record<string, HalliPlayer>
  bell: { pid: string; ok: boolean; t: number; fruit: number } | null
}
export type HalliAction = { type: 'flip' } | { type: 'bell' }

/** 같은 과일 합이 정확히 5인 과일 index (없으면 -1) */
export function fiveFruit(top: Record<string, Card | null>) {
  const sum = [0, 0, 0, 0]
  for (const c of Object.values(top)) if (c) sum[c.f] += c.n
  return sum.findIndex((x) => x === 5)
}

function flip(n: HalliState, pid: string, t: number) {
  const other = n.players.find((x) => x !== pid)!
  const card = n.decks[pid].shift()
  if (!card) return
  n.top[pid] = card
  n.flips++
  n.lastFlip = t
  n.locked = false
  n.bell = n.bell && t - n.bell.t < 600 ? n.bell : null
  n.turn = n.decks[other].length ? other : pid
}

export const halliEngine: Engine<HalliState, HalliAction> = {
  id: 'halli',
  statLabels: { correct: '정확한 종', wrong: '잘못 누른 종' },
  init(seed, players) {
    const deck: Card[] = []
    const dist = [[1, 5], [2, 3], [3, 3], [4, 2], [5, 1]]
    for (let f = 0; f < 4; f++) for (const [n, k] of dist) for (let i = 0; i < k; i++) deck.push({ f, n })
    const sh = shuffle(deck, mulberry32(seed))
    const decks: Record<string, Card[]> = {}; const top: Record<string, Card | null> = {}; const p: Record<string, HalliPlayer> = {}
    players.forEach((id, i) => { decks[id] = sh.filter((_, j) => j % 2 === i); top[id] = null; p[id] = { score: 0, streak: 0, correct: 0, wrong: 0, lockUntil: 0 } })
    return { players, decks, top, turn: players[0], lastFlip: 0, pauseUntil: 1000, clearPending: false, locked: false, flips: 0, p, bell: null }
  },
  apply(s, pid, a, t) {
    if (t >= HALLI_TIME || !s.p[pid]) return null
    if (a.type === 'flip') {
      if (s.turn !== pid || t < s.pauseUntil || !s.decks[pid].length) return null
      const n = clone(s); flip(n, pid, t); return n
    }
    // 종
    if (t < s.p[pid].lockUntil) return null
    const n = clone(s); const me = n.p[pid]
    const f = fiveFruit(n.top)
    if (f >= 0 && !n.locked) {
      me.score += 1; me.streak++; me.correct++
      if (me.streak % 3 === 0) me.score += 1
      n.locked = true; n.clearPending = true; n.pauseUntil = t + 1300
      n.bell = { pid, ok: true, t, fruit: f }
    } else {
      if (n.locked) return null // 이미 상대가 먼저 성공한 판 → 무시
      me.score -= 1; me.streak = 0; me.wrong++; me.lockUntil = t + 800
      n.bell = { pid, ok: false, t, fruit: -1 }
    }
    return n
  },
  tick(s, t) {
    if (t < s.pauseUntil) return null
    if (s.clearPending) {
      const n = clone(s); n.clearPending = false
      for (const k of n.players) n.top[k] = null
      n.lastFlip = t
      return n
    }
    if (t - s.lastFlip > AUTO_FLIP_MS && s.decks[s.turn]?.length) { const n = clone(s); flip(n, s.turn, t); return n }
    return null
  },
  isOver: (s, t) => t >= HALLI_TIME || (s.players.every((id) => !s.decks[id].length) && !s.clearPending && t - s.lastFlip > 3000),
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { correct: p.correct, wrong: p.wrong } }
    return { scores, stats }
  },
}
