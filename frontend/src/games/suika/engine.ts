import { clone, type Engine } from '../types'

export const SUIKA_TIME = 120_000

export interface SuikaPlayer { score: number; best: number; drops: number; over: boolean }
export interface SuikaState { seed: number; players: string[]; p: Record<string, SuikaPlayer> }
/** 각자 폰에서 물리를 돌리고 점수만 보고 */
export type SuikaAction = { type: 'report'; score: number; best: number; n: number; over: number }

/** 과일 합치기: 각자 자기 통에서 같은 순서의 과일을 받아 수박을 노려요 */
export const suikaEngine: Engine<SuikaState, SuikaAction> = {
  id: 'suika',
  statLabels: { best: '최고 과일 단계', drops: '떨어뜨린 과일' },
  init(seed, players) {
    const p: Record<string, SuikaPlayer> = {}
    for (const id of players) p[id] = { score: 0, best: 0, drops: 0, over: false }
    return { seed, players, p }
  },
  apply(s, pid, a, t) {
    const me0 = s.p[pid]
    if (!me0 || me0.over || t >= SUIKA_TIME || a.type !== 'report') return null
    // 줄어들 수 없고, 한 번에 너무 크게 늘 수 없음
    if (a.score < me0.score || a.n < me0.drops || a.best < me0.best) return null
    if (a.score - me0.score > 400 || a.n - me0.drops > 20 || a.best > 10) return null
    const n = clone(s); const me = n.p[pid]
    me.score = a.score; me.best = a.best; me.drops = a.n; me.over = a.over === 1
    return n
  },
  isOver: (s, t) => t >= SUIKA_TIME || s.players.every((id) => s.p[id]?.over),
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { best: p.best + 1, drops: p.drops } }
    return { scores, stats }
  },
}
