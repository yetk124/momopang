import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'
import { WORDS } from './words'

export const WORD_TIME = 90_000
export const TURN_MS = 10_000

export interface WordPlayer { score: number; words: number; fails: number; longest: number; fast: number }
export interface ChainItem { pid: string; word: string; start?: boolean; pts?: number; len?: number; speed?: number }
export interface WordState {
  players: string[]
  seed: number
  turn: string
  turnStart: number
  chain: ChainItem[]
  used: string[]
  resets: number
  p: Record<string, WordPlayer>
  flash: { pid: string; text: string; t: number; bad: boolean } | null
}
export type WordAction = { word: string }

const JUNG_Y = [2, 6, 7, 12, 17, 20] // ㅑㅕㅖㅛㅠㅣ
/** 두음법칙: 녀→여, 라→나, 리→이 … */
export function dueum(ch: string): string | null {
  const c = ch.charCodeAt(0) - 0xac00
  if (c < 0 || c >= 11172) return null
  const cho = Math.floor(c / 588), jung = Math.floor((c % 588) / 28), jong = c % 28
  const mk = (ci: number) => String.fromCharCode(0xac00 + ci * 588 + jung * 28 + jong)
  if (cho === 5) return mk(JUNG_Y.includes(jung) ? 11 : 2) // ㄹ → ㅇ/ㄴ
  if (cho === 2 && JUNG_Y.includes(jung)) return mk(11) // ㄴ → ㅇ
  return null
}
/** 기본 1 + 길이 보너스(3글자 +1, 4글자 이상 +2) + 속도 보너스(3초 안 +2, 5초 안 +1) */
export function wordPoints(word: string, elapsed: number) {
  const len = word.length >= 4 ? 2 : word.length === 3 ? 1 : 0
  const speed = elapsed <= 3000 ? 2 : elapsed <= 5000 ? 1 : 0
  return { total: 1 + len + speed, len, speed }
}
export const lastChar = (s: WordState) => { const w = s.chain[s.chain.length - 1]?.word ?? ''; return w[w.length - 1] ?? '' }
export const allowedStarts = (s: WordState) => { const l = lastChar(s); const d = dueum(l); return d ? [l, d] : [l] }

// 이어갈 단어가 충분한 끝 글자로 끝나는 2글자만 시작 단어로 사용
const START_POOL = WORDS.filter((w) => {
  if (w.length !== 2) return false
  const l = w[1]; const d = dueum(l)
  return WORDS.filter((x) => x[0] === l || x[0] === d).length >= 3
})
function startWord(seed: number, n: number, used: string[]) {
  const pool = START_POOL.filter((w) => !used.includes(w))
  return pool[Math.floor(mulberry32(seed + n * 131)() * pool.length)] ?? '사과'
}

export const wordEngine: Engine<WordState, WordAction> = {
  id: 'word',
  statLabels: { words: '이은 단어', longest: '최장 글자수', fast: '빠른 답(5초 이내)', fails: '막힌 횟수' },
  init(seed, players) {
    const p: Record<string, WordPlayer> = {}
    for (const id of players) p[id] = { score: 0, words: 0, fails: 0, longest: 0, fast: 0 }
    const w = startWord(seed, 0, [])
    return { players, seed, turn: players[0], turnStart: 0, chain: [{ pid: '', word: w, start: true }], used: [w], resets: 0, p, flash: null }
  },
  apply(s, pid, a, t) {
    if (t >= WORD_TIME || pid !== s.turn) return null
    const word = a.word.replace(/\s/g, '')
    const n = clone(s)
    const bad = (text: string) => { n.flash = { pid, text, t, bad: true }; return n }
    if (!/^[가-힣]{2,8}$/.test(word)) return bad('한글 2글자 이상으로 써주세요')
    if (!allowedStarts(s).includes(word[0])) return bad(`'${allowedStarts(s).join("' 또는 '")}'(으)로 시작해야 해요`)
    if (s.used.includes(word)) return bad('이미 나온 단어예요')
    const { total, len, speed } = wordPoints(word, t - s.turnStart)
    n.chain = [...n.chain, { pid, word, pts: total, len, speed }].slice(-14)
    n.used.push(word)
    const me = n.p[pid]
    me.score += total; me.words += 1; me.longest = Math.max(me.longest, word.length); if (speed > 0) me.fast++
    n.turn = s.players.find((x) => x !== pid)!
    n.turnStart = t
    n.flash = null
    return n
  },
  tick(s, t) {
    if (t >= WORD_TIME || t - s.turnStart < TURN_MS) return null
    const n = clone(s)
    const loser = s.turn; const other = s.players.find((x) => x !== loser)!
    n.p[loser].fails++; n.p[other].score += 2
    n.resets++
    const w = startWord(s.seed, n.resets, n.used)
    n.used.push(w)
    n.chain = [...n.chain, { pid: '', word: w, start: true }].slice(-14)
    n.turn = other // 못 이은 사람 대신 상대가 새 단어로 이어가요
    n.turnStart = t
    n.flash = { pid: loser, text: '시간 초과! 상대 +2', t, bad: false }
    return n
  },
  timer: (s, t) => Math.min(TURN_MS - (t - s.turnStart), WORD_TIME - t),
  isOver: (_s, t) => t >= WORD_TIME,
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { words: p.words, longest: p.longest, fast: p.fast, fails: p.fails } }
    return { scores, stats }
  },
}
