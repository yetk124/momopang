import { mulberry32, shuffle } from '../../lib/rng'
import { clone, type Engine } from '../types'
import { BALANCE_QS } from './questions'

export const BALANCE_COUNT = 10
/** 연애 질문은 한 판에 최대 몇 개 */
const MAX_LOVE = 5

export interface BalanceQ { cat: string; a: string; b: string }
export interface BalanceState {
  qs: BalanceQ[]
  idx: number
  phase: 'vote' | 'reveal' | 'done'
  /** 이번 질문의 선택 (0 = A, 1 = B) */
  votes: Record<string, number>
  /** 지난 질문들의 선택 기록 */
  history: Record<string, number>[]
  same: number
  players: string[]
}
/** choice 0/1 = 투표, -1 = 다음 질문 */
export type BalanceAction = { choice: number }

/** 최근에 본 질문은 피해서 고르기 (방장 기기에 기록) */
const SEEN_KEY = 'momopang.balance.seen'
function pick(r: () => number) {
  let seen: number[] = []
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); if (Array.isArray(v)) seen = v.filter((x) => Number.isInteger(x)) } catch { /* noop */ }
  const all = BALANCE_QS.map((_, i) => i)
  let pool = all.filter((i) => !seen.includes(i))
  if (pool.length < BALANCE_COUNT * 2) { seen = []; pool = all }
  const out: number[] = []; let love = 0
  for (const i of shuffle(pool, r)) {
    const isLove = BALANCE_QS[i][0] === '연애'
    if (isLove && love >= MAX_LOVE) continue
    if (isLove) love++
    out.push(i)
    if (out.length === BALANCE_COUNT) break
  }
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...out].slice(-50))) } catch { /* noop */ }
  return out
}

/** 시간 제한 없음: 둘 다 고르면 결과 공개 → 누구든 '다음'을 누르면 다음 질문 */
export const balanceEngine: Engine<BalanceState, BalanceAction> = {
  id: 'balance',
  statLabels: { same: '같은 선택', diff: '다른 선택' },
  init(seed, players) {
    const r = mulberry32(seed)
    const qs = pick(r).map((i) => {
      const [cat, a, b] = BALANCE_QS[i]
      return r() < 0.5 ? { cat, a, b } : { cat, a: b, b: a } // A/B 위치도 섞기
    })
    return { qs, idx: 0, phase: 'vote', votes: {}, history: [], same: 0, players }
  },
  apply(s, pid, a) {
    if (!s.players.includes(pid)) return null
    if (a.choice === -1) {
      if (s.phase !== 'reveal') return null
      const n = clone(s)
      n.history.push(n.votes); n.votes = {}
      if (n.idx + 1 >= n.qs.length) n.phase = 'done'
      else { n.idx++; n.phase = 'vote' }
      return n
    }
    if (s.phase !== 'vote' || (a.choice !== 0 && a.choice !== 1) || s.votes[pid] !== undefined) return null
    const n = clone(s)
    n.votes[pid] = a.choice
    if (n.players.every((id) => n.votes[id] !== undefined)) {
      n.phase = 'reveal'
      const vs = n.players.map((id) => n.votes[id])
      if (vs.every((v) => v === vs[0])) n.same++
    }
    return n
  },
  timer: () => null,
  isOver: (s) => s.phase === 'done',
  result(s) {
    // 승패 대신 궁합: 둘 다 '같은 선택' 수를 점수로 (항상 무승부)
    const answered = s.history.length + (s.phase === 'reveal' ? 1 : 0)
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const id of s.players) { scores[id] = s.same; stats[id] = { same: s.same, diff: Math.max(0, answered - s.same) } }
    return { scores, stats }
  },
}

/** 궁합 퍼센트 (0~100) */
export const balanceMatch = (same: number, total: number) => (total ? Math.round((same / total) * 100) : 0)
