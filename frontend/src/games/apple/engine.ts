import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const APPLE_TIME = 60_000
export const ROWS = 12
export const COLS = 8

export interface Rect { r1: number; c1: number; r2: number; c2: number }
export interface ApplePlayer { score: number; removed: number; success: number; combo: number; best: number; fail: number }
export interface AppleState { board: number[]; p: Record<string, ApplePlayer>; last: { pid: string; cells: number[]; t: number; bonus: number } | null; seed: number; round: number }

export const normRect = (r: Rect): Rect => ({ r1: Math.min(r.r1, r.r2), c1: Math.min(r.c1, r.c2), r2: Math.max(r.r1, r.r2), c2: Math.max(r.c1, r.c2) })
export function rectCells(r: Rect) {
  const out: number[] = []
  for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) out.push(i * COLS + j)
  return out
}
export const rectSum = (board: number[], r: Rect) => rectCells(r).reduce((a, i) => a + board[i], 0)

/** 합이 10인 직사각형 목록 (봇/힌트용) */
export function findTens(board: number[]) {
  const res: Rect[] = []
  for (let r1 = 0; r1 < ROWS; r1++) for (let c1 = 0; c1 < COLS; c1++)
    for (let r2 = r1; r2 < ROWS; r2++) {
      for (let c2 = c1; c2 < COLS; c2++) {
        const s = rectSum(board, { r1, c1, r2, c2 })
        if (s === 10) res.push({ r1, c1, r2, c2 })
        if (s >= 10) break
      }
    }
  return res
}

/** 사과판 만들기 (같은 seed·round면 두 사람 모두 같은 판) */
function makeBoard(seed: number, round: number) {
  for (let k = 0; k < 20; k++) {
    const rnd = mulberry32(seed + round * 104729 + k * 7)
    const board = Array.from({ length: ROWS * COLS }, () => 1 + Math.floor(rnd() * 9))
    // 전체 합을 10의 배수로 맞춰 '다 지울 수 있는' 느낌을 준다
    const total = board.reduce((a, b) => a + b, 0)
    const fix = (10 - (total % 10)) % 10
    if (fix) board[board.length - 1] = ((board[board.length - 1] + fix - 1) % 9) + 1
    if (findTens(board).length) return board
  }
  return Array.from({ length: ROWS * COLS }, (_, i) => (i % 2 ? 9 : 1))
}

export const appleEngine: Engine<AppleState, Rect> = {
  id: 'apple',
  predict: true,
  statLabels: { removed: '제거한 사과', success: '성공 횟수', best: '최고 콤보' },
  init(seed, players) {
    const board = makeBoard(seed, 0)
    const p: Record<string, ApplePlayer> = {}
    for (const id of players) p[id] = { score: 0, removed: 0, success: 0, combo: 0, best: 0, fail: 0 }
    return { board, p, last: null, seed, round: 0 }
  },
  apply(s, pid, a, t) {
    if (t >= APPLE_TIME || !s.p[pid]) return null
    const r = normRect(a)
    if (r.r1 < 0 || r.c1 < 0 || r.r2 >= ROWS || r.c2 >= COLS) return null
    const n = clone(s); const me = n.p[pid]
    const cells = rectCells(r).filter((i) => n.board[i] > 0)
    const sum = cells.reduce((acc, i) => acc + n.board[i], 0)
    if (sum !== 10) { me.combo = 0; me.fail++; return n } // 실패: 점수 없음, 콤보 초기화
    cells.forEach((i) => (n.board[i] = 0))
    let bonus = 0
    if (cells.length >= 5) bonus += 3
    me.combo++; me.best = Math.max(me.best, me.combo)
    if (me.combo % 3 === 0) bonus += 2
    me.score += cells.length + bonus; me.removed += cells.length; me.success++
    n.last = { pid, cells, t, bonus }
    // 더 이상 합 10을 만들 수 없으면 새 사과판
    if (!findTens(n.board).length) { n.round = (s.round ?? 0) + 1; n.board = makeBoard(s.seed ?? 0, n.round) }
    return n
  },
  isOver: (_s, t) => t >= APPLE_TIME,
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { removed: p.removed, success: p.success, best: p.best } }
    return { scores, stats }
  },
}
