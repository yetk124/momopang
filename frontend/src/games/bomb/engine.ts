import { mulberry32, shuffle } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const BOMB_ROUNDS = 3
export const BOOM_SHOW_MS = 2600
export const WRONG_LOCK_MS = 900

export interface BombTask { text: string; opts: number[]; ans: number }
export interface BombPlayer { score: number; passes: number; booms: number; lockUntil: number }
export interface BombState {
  players: string[]
  seed: number
  round: number
  holder: string
  roundStart: number
  /** 터지는 시각 — 화면에 표시하지 않음 */
  fuseAt: number
  taskSeq: number
  task: BombTask
  phase: 'play' | 'boom' | 'done'
  boomUntil: number
  loser: string | null
  lastPass: { from: string; t: number } | null
  p: Record<string, BombPlayer>
}
export type BombAction = { choice: number }

export function makeTask(seed: number, k: number): BombTask {
  const r = mulberry32(seed * 7 + k * 92821)
  const kind = Math.floor(r() * 3)
  let a = 2 + Math.floor(r() * 11), b = 2 + Math.floor(r() * 9), ans: number, text: string
  if (kind === 0) { ans = a + b; text = `${a} + ${b}` }
  else if (kind === 1) { if (b > a) [a, b] = [b, a]; ans = a - b; text = `${a} − ${b}` }
  else { a = 2 + Math.floor(r() * 8); b = 2 + Math.floor(r() * 8); ans = a * b; text = `${a} × ${b}` }
  const set = new Set([ans])
  while (set.size < 3) set.add(Math.max(0, ans + (Math.floor(r() * 7) - 3) || ans + 4))
  return { text, opts: shuffle([...set], r), ans }
}
const fuse = (seed: number, round: number) => 12_000 + Math.floor(mulberry32(seed + round * 4049)() * 14_000)

export const bombEngine: Engine<BombState, BombAction> = {
  id: 'bomb',
  statLabels: { passes: '넘긴 횟수', booms: '터진 횟수' },
  init(seed, players) {
    const p: Record<string, BombPlayer> = {}
    for (const id of players) p[id] = { score: 0, passes: 0, booms: 0, lockUntil: 0 }
    const holder = players[Math.floor(mulberry32(seed)() * 2)] ?? players[0]
    return { players, seed, round: 0, holder, roundStart: 500, fuseAt: 500 + fuse(seed, 0), taskSeq: 0, task: makeTask(seed, 0), phase: 'play', boomUntil: 0, loser: null, lastPass: null, p }
  },
  apply(s, pid, a, t) {
    if (s.phase !== 'play' || pid !== s.holder || t < s.roundStart || t < s.p[pid].lockUntil) return null
    const n = clone(s)
    if (a.choice === s.task.ans) {
      n.holder = s.players.find((x) => x !== pid)!
      n.p[pid].passes++
      n.taskSeq++; n.task = makeTask(s.seed, n.taskSeq)
      n.lastPass = { from: pid, t }
    } else n.p[pid].lockUntil = t + WRONG_LOCK_MS
    return n
  },
  tick(s, t) {
    if (s.phase === 'play' && t >= s.fuseAt) {
      const n = clone(s); const other = s.players.find((x) => x !== s.holder)!
      n.phase = 'boom'; n.loser = s.holder; n.boomUntil = t + BOOM_SHOW_MS
      n.p[s.holder].booms++; n.p[other].score += 1
      return n
    }
    if (s.phase === 'boom' && t >= s.boomUntil) {
      const n = clone(s)
      if (s.round + 1 >= BOMB_ROUNDS) { n.phase = 'done'; return n }
      n.round++; n.phase = 'play'; n.roundStart = t + 600; n.fuseAt = n.roundStart + fuse(s.seed, n.round)
      n.holder = s.loser ?? s.holder; n.loser = null
      n.taskSeq++; n.task = makeTask(s.seed, n.taskSeq); n.lastPass = null
      for (const id of s.players) n.p[id].lockUntil = 0
      return n
    }
    return null
  },
  timer: () => null,
  isOver: (s) => s.phase === 'done',
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { passes: p.passes, booms: p.booms } }
    return { scores, stats }
  },
}
