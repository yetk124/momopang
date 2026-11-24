import { mulberry32, shuffle } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const PAIRS_TIME = 150_000
export const PAIRS = 10 // 4×5
export const CLOSE_MS = 1000
export const TURN_MS = 8000
/** 시작할 때 모든 카드를 잠깐 보여주는 시간 */
export const PEEK_MS = 1000
const PEEK_FROM = 300
export const FACES = ['cat', 'rabbit', 'puppy', 'headphone', 'panda', 'hamster', 'penguin', 'bear', 'cake', 'pancake', 'cookie', 'macaron', 'onigiri', 'ramen', 'boba', 'pudding'] as const

export interface PairsPlayer { score: number; pairs: number; attempts: number; bestStreak: number }
export interface PairsState {
  players: string[]
  faces: string[]
  board: number[]
  /** 짝을 찾은 사람 (칸 → 플레이어) */
  owner: Record<number, string>
  open: number[]
  closeAt: number
  turn: string
  turnStart: number
  streak: number
  p: Record<string, PairsPlayer>
  last: { pid: string; ok: boolean; t: number } | null
  /** 이 시각까지 모든 카드 공개 (시작 미리보기) */
  peekUntil?: number
}
export type PairsAction = { cell: number }

const other = (s: PairsState, id: string) => s.players.find((x) => x !== id)!
function pass(n: PairsState, t: number) { n.open = []; n.closeAt = 0; n.turn = other(n, n.turn); n.turnStart = t; n.streak = 0 }

/** 한 판(공유 보드)에서 번갈아 뒤집기. 맞히면 한 번 더, 틀리면 상대 차례 */
export const pairsEngine: Engine<PairsState, PairsAction> = {
  id: 'pairs',
  statLabels: { pairs: '찾은 짝', attempts: '시도 횟수', bestStreak: '최대 연속' },
  init(seed, players) {
    const r = mulberry32(seed)
    const faces = shuffle([...FACES], r).slice(0, PAIRS)
    const board = shuffle([...Array(PAIRS).keys(), ...Array(PAIRS).keys()], r)
    const p: Record<string, PairsPlayer> = {}
    for (const id of players) p[id] = { score: 0, pairs: 0, attempts: 0, bestStreak: 0 }
    return { players, faces, board, owner: {}, open: [], closeAt: 0, turn: players[Math.floor(r() * players.length)] ?? players[0], turnStart: PEEK_FROM + PEEK_MS + 400, streak: 0, p, last: null, peekUntil: PEEK_FROM + PEEK_MS }
  },
  apply(s, pid, a, t) {
    if (t >= PAIRS_TIME || pid !== s.turn || t < s.turnStart || s.open.length >= 2) return null
    if (a.cell < 0 || a.cell >= s.board.length || s.owner[a.cell] || s.open.includes(a.cell)) return null
    const n = clone(s); const me = n.p[pid]
    n.open.push(a.cell)
    if (n.open.length === 2) {
      me.attempts++
      const [x, y] = n.open
      if (n.board[x] === n.board[y]) {
        n.owner[x] = n.owner[y] = pid
        me.pairs++; me.score += 10 + 5 * n.streak // 연속으로 맞히면 +5씩 더
        n.streak++; me.bestStreak = Math.max(me.bestStreak, n.streak)
        n.open = []; n.turnStart = t
        n.last = { pid, ok: true, t }
      } else { n.closeAt = t + CLOSE_MS; n.last = { pid, ok: false, t } }
    }
    return n
  },
  tick(s, t) {
    if (s.open.length === 2 && s.closeAt && t >= s.closeAt) { const n = clone(s); pass(n, t); return n }
    if (s.open.length < 2 && t >= s.turnStart && t - s.turnStart >= TURN_MS) { const n = clone(s); n.last = { pid: s.turn, ok: false, t }; pass(n, t); return n }
    return null
  },
  timer: (s, t) => (s.open.length === 2 || t < s.turnStart ? null : Math.min(TURN_MS - (t - s.turnStart), PAIRS_TIME - t)),
  isOver: (s, t) => t >= PAIRS_TIME || Object.keys(s.owner).length >= s.board.length,
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { pairs: p.pairs, attempts: p.attempts, bestStreak: p.bestStreak } }
    return { scores, stats }
  },
}
