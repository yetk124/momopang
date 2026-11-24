import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const OMOK_N = 15
export const OMOK_TURN_MS = 20_000
/** 시간 초과가 이만큼 쌓이면 패배 */
export const OMOK_MAX_TIMEOUTS = 3

export interface OmokState {
  players: string[]
  /** 0 빈칸 · 1 흑 · 2 백 */
  board: number[]
  color: Record<string, 1 | 2>
  turn: string
  turnStart: number
  last: number
  moves: number
  winner: string | null
  line: number[] | null
  timeouts: Record<string, number>
}
export type OmokAction = { cell: number }

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const
const at = (b: number[], r: number, c: number) => (r < 0 || c < 0 || r >= OMOK_N || c >= OMOK_N ? -1 : b[r * OMOK_N + c])

/** cell에 둔 돌로 5개 이상 이어졌으면 그 줄을 돌려줌 (자유 오목: 6목 이상도 승리) */
export function fiveLine(b: number[], cell: number) {
  const v = b[cell]; if (!v) return null
  const r0 = Math.floor(cell / OMOK_N), c0 = cell % OMOK_N
  for (const [dr, dc] of DIRS) {
    const line = [cell]
    for (let k = 1; at(b, r0 + dr * k, c0 + dc * k) === v; k++) line.push((r0 + dr * k) * OMOK_N + c0 + dc * k)
    for (let k = 1; at(b, r0 - dr * k, c0 - dc * k) === v; k++) line.push((r0 - dr * k) * OMOK_N + c0 - dc * k)
    if (line.length >= 5) return line
  }
  return null
}

const other = (s: OmokState, id: string) => s.players.find((x) => x !== id) ?? id

/** 번갈아 돌을 두고, 가로·세로·대각선으로 5개를 먼저 이으면 승리. 흑이 먼저 */
export const omokEngine: Engine<OmokState, OmokAction> = {
  id: 'omok',
  statLabels: { moves: '둔 수', timeouts: '시간 초과' },
  init(seed, players) {
    const r = mulberry32(seed)
    const black = players[Math.floor(r() * players.length)] ?? players[0]
    const color: Record<string, 1 | 2> = {}
    const timeouts: Record<string, number> = {}
    for (const id of players) { color[id] = id === black ? 1 : 2; timeouts[id] = 0 }
    return { players, board: Array(OMOK_N * OMOK_N).fill(0), color, turn: black, turnStart: 400, last: -1, moves: 0, winner: null, line: null, timeouts }
  },
  apply(s, pid, a, t) {
    if (s.winner || pid !== s.turn || t < s.turnStart) return null
    if (!Number.isInteger(a.cell) || a.cell < 0 || a.cell >= s.board.length || s.board[a.cell]) return null
    const n = clone(s)
    n.board[a.cell] = n.color[pid]; n.last = a.cell; n.moves++
    const line = fiveLine(n.board, a.cell)
    if (line) { n.winner = pid; n.line = line; return n }
    n.turn = other(n, pid); n.turnStart = t
    return n
  },
  tick(s, t) {
    if (s.winner || t - s.turnStart < OMOK_TURN_MS) return null
    const n = clone(s)
    n.timeouts[s.turn] = (n.timeouts[s.turn] ?? 0) + 1
    if (n.timeouts[s.turn] >= OMOK_MAX_TIMEOUTS) { n.winner = other(n, s.turn); return n }
    n.turn = other(n, s.turn); n.turnStart = t
    return n
  },
  timer: (s, t) => (s.winner ? null : Math.max(0, OMOK_TURN_MS - (t - s.turnStart))),
  isOver: (s) => !!s.winner || s.board.every((v) => v !== 0),
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const id of s.players) {
      scores[id] = s.winner === id ? 1 : 0
      stats[id] = { moves: s.board.filter((v) => v === s.color[id]).length, timeouts: s.timeouts[id] ?? 0 }
    }
    return { scores, stats }
  },
}

/** 봇용: 각 빈칸 점수 (내 공격 + 상대 수비) */
export function omokBest(s: OmokState, me: string) {
  const b = s.board, mine = s.color[me], theirs = mine === 1 ? 2 : 1
  if (b.every((v) => v === 0)) return Math.floor(b.length / 2)
  const val = (cnt: number, open: number) => {
    if (cnt >= 5) return 1_000_000
    if (open === 0) return 0
    return [0, 2, 20, 200, 5000][cnt] * (open === 2 ? 5 : 1)
  }
  const evalAt = (cell: number, v: number) => {
    const r0 = Math.floor(cell / OMOK_N), c0 = cell % OMOK_N
    let sum = 0
    for (const [dr, dc] of DIRS) {
      let cnt = 1, open = 0
      let k = 1; while (at(b, r0 + dr * k, c0 + dc * k) === v) { cnt++; k++ } if (at(b, r0 + dr * k, c0 + dc * k) === 0) open++
      k = 1; while (at(b, r0 - dr * k, c0 - dc * k) === v) { cnt++; k++ } if (at(b, r0 - dr * k, c0 - dc * k) === 0) open++
      sum += val(cnt, open)
    }
    return sum
  }
  let best = -1, bestV = -1
  for (let i = 0; i < b.length; i++) {
    if (b[i]) continue
    const r0 = Math.floor(i / OMOK_N), c0 = i % OMOK_N
    let near = false
    for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) if (at(b, r0 + dr, c0 + dc) > 0) { near = true; break }
    if (!near) continue
    const v = evalAt(i, mine) * 1.1 + evalAt(i, theirs) + Math.random() * 3
    if (v > bestV) { bestV = v; best = i }
  }
  return best
}
