import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const MEM_ROUNDS = 6
export const START_LEN = 3
export const STEP_MS = 650
export const LIT_MS = 430
export const REVEAL_MS = 1600
export const MEM_COLORS = ['#F2675B', '#FFD24D', '#6FA8F5', '#7CCB6B']

export interface MemPlayer { score: number; idx: number; done: boolean; failed: boolean; best: number; clears: number }
export interface MemState {
  seed: number
  round: number
  seq: number[]
  phase: 'show' | 'input' | 'reveal' | 'done'
  showStart: number
  inputEnd: number
  revealUntil: number
  firstDone: string | null
  p: Record<string, MemPlayer>
}
export type MemAction = { c: number }

const makeSeq = (seed: number, round: number) => { const r = mulberry32(seed + round * 6151); return Array.from({ length: START_LEN + round }, () => Math.floor(r() * 4)) }
export const showDuration = (len: number) => len * STEP_MS + 250
const inputDuration = (len: number) => len * 900 + 3500

export const memoryEngine: Engine<MemState, MemAction> = {
  id: 'memory',
  predict: true,
  statLabels: { clears: '성공한 라운드', best: '최대 길이' },
  init(seed, players) {
    const p: Record<string, MemPlayer> = {}
    for (const id of players) p[id] = { score: 0, idx: 0, done: false, failed: false, best: 0, clears: 0 }
    return { seed, round: 0, seq: makeSeq(seed, 0), phase: 'show', showStart: 900, inputEnd: 0, revealUntil: 0, firstDone: null, p }
  },
  apply(s, pid, a, t) {
    const me0 = s.p[pid]
    if (s.phase !== 'input' || !me0 || me0.done || me0.failed) return null
    const n = clone(s); const me = n.p[pid]
    if (a.c === s.seq[me.idx]) {
      me.idx++
      if (me.idx >= s.seq.length) {
        me.done = true; me.clears++; me.best = Math.max(me.best, s.seq.length)
        me.score += 1 + (n.firstDone ? 0 : 1)
        n.firstDone ??= pid
      }
    } else me.failed = true
    return n
  },
  tick(s, t) {
    if (s.phase === 'show' && t >= s.showStart + showDuration(s.seq.length)) { const n = clone(s); n.phase = 'input'; n.inputEnd = t + inputDuration(s.seq.length); return n }
    if (s.phase === 'input' && (t >= s.inputEnd || Object.values(s.p).every((p) => p.done || p.failed))) { const n = clone(s); n.phase = 'reveal'; n.revealUntil = t + REVEAL_MS; return n }
    if (s.phase === 'reveal' && t >= s.revealUntil) {
      const n = clone(s)
      if (s.round + 1 >= MEM_ROUNDS) { n.phase = 'done'; return n }
      n.round++; n.seq = makeSeq(s.seed, n.round); n.phase = 'show'; n.showStart = t + 400; n.firstDone = null
      for (const p of Object.values(n.p)) { p.idx = 0; p.done = false; p.failed = false }
      return n
    }
    return null
  },
  timer: (s, t) => (s.phase === 'input' ? s.inputEnd - t : null),
  isOver: (s) => s.phase === 'done',
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { clears: p.clears, best: p.best } }
    return { scores, stats }
  },
}
