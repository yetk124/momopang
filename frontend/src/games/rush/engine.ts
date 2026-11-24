import { mulberry32, shuffle } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const RUSH_TIME = 20_000
export interface RushPlayer { set: number; board: number[]; next: number; score: number; sets: number; taps: number; errors: number; errAt: number }
export interface RushState { seed: number; p: Record<string, RushPlayer> }
export type RushAction = { cell: number }

/** set번째 판: 1~9, 10~18, 19~27 … 처럼 숫자가 이어져요 */
export const rushBoard = (seed: number, set: number) => shuffle(Array.from({ length: 9 }, (_, i) => set * 9 + i + 1), mulberry32(seed + set * 7919))
/** 지금 판에서 몇 개 눌렀는지 (0~9) */
export const rushProgress = (p: { next: number; set: number }) => p.next - 1 - p.set * 9

export const rushEngine: Engine<RushState, RushAction> = {
  id: 'rush',
  predict: true,
  statLabels: { sets: '완성 세트', taps: '맞힌 숫자', errors: '실수' },
  init(seed, players) {
    const p: Record<string, RushPlayer> = {}
    for (const id of players) p[id] = { set: 0, board: rushBoard(seed, 0), next: 1, score: 0, sets: 0, taps: 0, errors: 0, errAt: -1 }
    return { seed, p }
  },
  apply(s, pid, a, t) {
    if (t >= RUSH_TIME || !s.p[pid]) return null
    const n = clone(s); const me = n.p[pid]
    const v = me.board[a.cell]
    if (v === undefined) return null
    if (v < me.next) return null // 이미 누른 칸
    if (v === me.next) {
      me.next++; me.score += 1; me.taps++
      if (me.next > (me.set + 1) * 9) { me.sets++; me.score += 3; me.set++; me.board = rushBoard(s.seed, me.set) } // 다음 판은 이어지는 숫자
    } else { me.errors++; me.errAt = t }
    return n
  },
  isOver: (_s, t) => t >= RUSH_TIME,
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { sets: p.sets, taps: p.taps, errors: p.errors } }
    return { scores, stats }
  },
}
