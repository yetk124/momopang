import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'
import { SPOT_PUZZLES } from './puzzles'

export const SPOT_TIME = 90_000
export const MISS_LOCK_MS = 700

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

/** 정답 판정 범위(원본 크기보다 넉넉하게 + 최소 크기 보장) */
const radius = (d: { rx: number; ry: number }) => ({ rx: Math.max(d.rx * 1.5, 0.07), ry: Math.max(d.ry * 1.5, 0.055) })

/** 아직 못 찾은 정답 중 범위 안에 있는 것 (없으면 -1). includeFound면 이미 찾은 것도 포함 */
export function hitTest(s: SpotState, x: number, y: number, includeFound = false) {
  const diffs = puzzleOf(s).diffs
  let best = -1, bestD = Infinity
  diffs.forEach((d, i) => {
    if (!includeFound && s.found[i] !== undefined) return
    const { rx, ry } = radius(d)
    const v = ((x - d.x) / rx) ** 2 + ((y - d.y) / ry) ** 2
    if (v <= 1 && v < bestD) { best = i; bestD = v }
  })
  return best
}

/** 화면에서 손가락 크기(px)만큼 여유를 두고 가장 가까운 정답을 찾음 → 그 중심 좌표로 보정 */
export function snapTap(s: SpotState, x: number, y: number, wPx: number, hPx: number, tolPx = 26) {
  const diffs = puzzleOf(s).diffs
  let best = -1, bestD = Infinity
  diffs.forEach((d, i) => {
    if (s.found[i] !== undefined) return
    const { rx, ry } = radius(d)
    // 정답 타원 가장자리까지의 대략적인 픽셀 거리
    const dx = Math.max(0, Math.abs(x - d.x) * wPx - rx * wPx), dy = Math.max(0, Math.abs(y - d.y) * hPx - ry * hPx)
    const dist = Math.hypot(dx, dy)
    if (dist <= tolPx && dist < bestD) { best = i; bestD = dist }
  })
  return best >= 0 ? { x: diffs[best].x, y: diffs[best].y } : { x, y }
}

/** 최근에 나온 그림은 피해서 고르기 (방장 기기에만 기록) */
const RECENT_KEY = 'momopang.spot.recent'
function pickPuzzle(r: () => number) {
  const n = SPOT_PUZZLES.length
  let recent: number[] = []
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { /* noop */ }
  const keep = Math.min(Math.max(n - 2, 0), 4) // 최근 4개(그림이 적으면 n-2개)는 제외
  const avoid = new Set(recent.slice(-keep))
  const pool = Array.from({ length: n }, (_, i) => i).filter((i) => !avoid.has(i))
  const pick = (pool.length ? pool : Array.from({ length: n }, (_, i) => i))[Math.floor(r() * (pool.length || n))]
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([...recent, pick].slice(-8))) } catch { /* noop */ }
  return pick
}

export const spotEngine: Engine<SpotState, SpotAction> = {
  id: 'spot',
  statLabels: { found: '찾은 개수', miss: '헛짚은 횟수' },
  init(seed, players) {
    const r = mulberry32(seed)
    const p: Record<string, SpotPlayer> = {}
    for (const id of players) p[id] = { score: 0, found: 0, miss: 0, lockUntil: 0 }
    return { puzzle: pickPuzzle(r), mirror: r() < 0.5, found: {}, p, last: null }
  },
  apply(s, pid, a, t) {
    const me0 = s.p[pid]
    if (!me0 || t >= SPOT_TIME || t < me0.lockUntil) return null
    if (!(a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1)) return null
    const idx0 = hitTest(s, a.x, a.y)
    // 이미 찾은 곳(상대가 방금 찾은 곳 포함)을 누르면 틀린 걸로 치지 않고 무시
    if (idx0 < 0 && hitTest(s, a.x, a.y, true) >= 0) return null
    const n = clone(s); const me = n.p[pid]
    const idx = idx0
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
