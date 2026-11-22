import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const BLOCK_TIME = 180_000
export const N = 8
export interface Shape { cells: [number, number][]; color: number; w: number; h: number }
const rot = (cells: [number, number][]): [number, number][] => cells.map(([r, c]) => [c, -r])
const norm = (cells: [number, number][]): [number, number][] => {
  const mr = Math.min(...cells.map((x) => x[0])); const mc = Math.min(...cells.map((x) => x[1]))
  return cells.map(([r, c]) => [r - mr, c - mc] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
}
const variants = (base: [number, number][], n: number) => {
  const out: [number, number][][] = []; let cur = base
  for (let i = 0; i < n; i++) { out.push(norm(cur)); cur = rot(cur) }
  return out
}
const line = (k: number): [number, number][] => Array.from({ length: k }, (_, i) => [0, i] as [number, number])
// 1칸, 2~5칸 직선, 2×2, 3칸 L, 4칸 L, T, 작은 Z  — [변형들, 색, 가중치]
const FAMILIES: [[number, number][][], number, number][] = [
  [[line(1)], 1, 3],
  [variants(line(2), 2), 2, 4],
  [variants(line(3), 2), 3, 4],
  [variants(line(4), 2), 4, 3],
  [variants(line(5), 2), 5, 2],
  [[[[0, 0], [0, 1], [1, 0], [1, 1]]], 6, 3],
  [variants([[0, 0], [1, 0], [1, 1]], 4), 7, 3],
  [variants([[0, 0], [1, 0], [2, 0], [2, 1]], 4), 8, 3],
  [variants([[0, 0], [0, 1], [0, 2], [1, 1]], 4), 9, 2],
  [[...variants([[0, 0], [0, 1], [1, 1], [1, 2]], 2), ...variants([[0, 1], [0, 2], [1, 0], [1, 1]], 2)], 10, 2],
]
export const SHAPES: Shape[] = []
const WEIGHTED: number[] = []
for (const [vars, color, weight] of FAMILIES) {
  for (const cells of vars) {
    const idx = SHAPES.length
    SHAPES.push({ cells, color, w: Math.max(...cells.map((x) => x[1])) + 1, h: Math.max(...cells.map((x) => x[0])) + 1 })
    for (let i = 0; i < weight; i++) WEIGHTED.push(idx)
  }
}
export const BLOCK_COLORS = ['', '#F7C948', '#7EC8F2', '#8DD58C', '#B79CF2', '#F2879B', '#5F8EF2', '#F2A35E', '#E77DC8', '#55C3B4', '#F26B5E']

export const blockSet = (seed: number, set: number) => { const r = mulberry32(seed * 31 + set * 104729); return [0, 1, 2].map(() => WEIGHTED[Math.floor(r() * WEIGHTED.length)]) as (number | null)[] }
export function fits(board: number[], shape: Shape, r: number, c: number) {
  for (const [dr, dc] of shape.cells) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= N || cc >= N || board[rr * N + cc]) return false }
  return true
}
export function canPlaceAny(board: number[], shape: Shape) {
  for (let r = 0; r <= N - shape.h; r++) for (let c = 0; c <= N - shape.w; c++) if (fits(board, shape, r, c)) return true
  return false
}
/** 배치 시 완성되는 줄 (미리보기/엔진 공용) */
export function previewClear(board: number[], shape: Shape, r: number, c: number) {
  const b = board.slice(); for (const [dr, dc] of shape.cells) b[(r + dr) * N + c + dc] = shape.color
  const rows: number[] = []; const cols: number[] = []
  for (let i = 0; i < N; i++) {
    let rf = true, cf = true
    for (let j = 0; j < N; j++) { if (!b[i * N + j]) rf = false; if (!b[j * N + i]) cf = false }
    if (rf) rows.push(i); if (cf) cols.push(i)
  }
  return { b, rows, cols }
}

export interface BlockPlayer { board: number[]; hand: (number | null)[]; set: number; score: number; lines: number; maxClear: number; combo: number; over: boolean; placed: number; lastClear: { t: number; n: number; cells: number[] } | null }
export interface BlockState { seed: number; p: Record<string, BlockPlayer> }
export type BlockAction = { h: number; r: number; c: number }

export const blockEngine: Engine<BlockState, BlockAction> = {
  id: 'block',
  predict: true,
  statLabels: { lines: '제거한 줄', maxClear: '최대 동시 제거', placed: '놓은 블록' },
  init(seed, players) {
    const p: Record<string, BlockPlayer> = {}
    for (const id of players) p[id] = { board: Array(N * N).fill(0), hand: blockSet(seed, 0), set: 0, score: 0, lines: 0, maxClear: 0, combo: 0, over: false, placed: 0, lastClear: null }
    return { seed, p }
  },
  apply(s, pid, a, t) {
    const me0 = s.p[pid]
    if (!me0 || me0.over || t >= BLOCK_TIME) return null
    const si = me0.hand[a.h]; if (si == null) return null
    const shape = SHAPES[si]; if (!fits(me0.board, shape, a.r, a.c)) return null
    const n = clone(s); const me = n.p[pid]
    const { b, rows, cols } = previewClear(me.board, shape, a.r, a.c)
    me.score += shape.cells.length; me.placed++
    const cleared = new Set<number>()
    rows.forEach((r) => { for (let j = 0; j < N; j++) cleared.add(r * N + j) })
    cols.forEach((c) => { for (let j = 0; j < N; j++) cleared.add(j * N + c) })
    cleared.forEach((i) => (b[i] = 0))
    me.board = b
    const k = rows.length + cols.length
    if (k > 0) {
      me.score += 10 * k + (k === 2 ? 5 : k >= 3 ? 10 : 0)
      me.combo += 1; if (me.combo >= 2) me.score += 5 * (me.combo - 1)
      me.lines += k; me.maxClear = Math.max(me.maxClear, k); me.lastClear = { t, n: k, cells: [...cleared] }
    } else me.combo = 0
    me.hand[a.h] = null
    if (me.hand.every((x) => x == null)) { me.set++; me.hand = blockSet(s.seed, me.set) }
    if (!me.hand.some((x) => x != null && canPlaceAny(me.board, SHAPES[x]))) me.over = true
    return n
  },
  isOver: (s, t) => t >= BLOCK_TIME || Object.values(s.p).every((p) => p.over),
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { lines: p.lines, maxClear: p.maxClear, placed: p.placed } }
    return { scores, stats }
  },
}
