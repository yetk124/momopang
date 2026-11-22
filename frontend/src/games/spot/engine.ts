import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'
import { SPOT_PUZZLES } from './puzzles'

export const SPOT_TIME = 90_000
export const MISS_LOCK_MS = 1200

export interface SpotPlayer { score: number; found: number; miss: number; lockUntil: number }
export interface SpotState {
  puzzle: number
  /** 좌우 반전으로 매판 조금씩 다르게 */
  mirror: boolean
  found: Record<number, string>
  p: Record<string, SpotPlayer>
  last: { pid: string; idx: number; x: number; y: number; t: number } | null
}
/** x, y: 반전 전 원본 그림 기준 0~1 좌표 */
export type SpotAction = { x: number; y: number }

export const puzzleOf = (s: SpotState) => SPOT_PUZZLES[s.puzzle] ?? SPOT_PUZZLES[0]

export function hitTest(s: SpotState, x: number, y: number) {
  const diffs = puzzleOf(s).diffs
  let best = -1, bestD = Infinity
  diffs.forEach((d, i) => {
    if (s.found[i] !== undefined) return
    const rx = Math.max(d.rx * 1.3, 0.05), ry = Math.max(d.ry * 1.3, 0.04)
    const v = ((x - d.x) / rx) ** 2 + ((y - d.y) / ry) ** 2
    if (v <= 1 && v < bestD) { best = i; bestD = v }
  })
  return best
}

export const spotEngine: Engine<SpotState, SpotAction> = {
  id: 'spot',
  statLabels: { found: '찾은 개수', miss: '헛짚은 횟수' },
  init(seed, players) {
    const r = mulberry32(seed)
    const p: Record<string, SpotPlayer> = {}
    for (const id of players) p[id] = { score: 0, found: 0, miss: 0, lockUntil: 0 }
    return { puzzle: Math.floor(r() * SPOT_PUZZLES.length), mirror: r() < 0.5, found: {}, p, last: null }
  },
  apply(s, pid, a, t) {
    const me0 = s.p[pid]
    if (!me0 || t >= SPOT_TIME || t < me0.lockUntil) return null
    if (!(a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1)) return null
    const n = clone(s); const me = n.p[pid]
    const idx = hitTest(n, a.x, a.y)
    if (idx >= 0) { n.found[idx] = pid; me.score += 1; me.found += 1 }
    else { me.miss += 1; me.lockUntil = t + MISS_LOCK_MS }
    n.last = { pid, idx, x: a.x, y: a.y, t }
    return n
  },
  isOver: (s, t) => t >= SPOT_TIME || Object.keys(s.found).length >= puzzleOf(s).diffs.length,
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { found: p.found, miss: p.miss } }
    return { scores, stats }
  },
}
