import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const ROUND_MS = 60_000
export const REVEAL_MS = 3200
export const ROUNDS = 4
export const WORDS = {
  easy: ['고양이', '강아지', '사과', '집', '자동차', '햄버거', '우산', '물고기', '나무', '해바라기'],
  normal: ['비행기', '캠핑', '놀이공원', '선글라스', '자전거', '피아노', '눈사람', '케이크', '기린', '등대'],
  hard: ['첫눈', '짝사랑', '월요병', '무중력', '시간 여행', '심쿵', '야근', '소나기'],
}
const DIFF: (keyof typeof WORDS)[] = ['easy', 'normal', 'normal', 'hard']

export interface DrawPlayer { score: number; correct: number; drawnOk: number }
export interface Guess { pid: string; text: string; ok: boolean; t: number }
export interface DrawState {
  players: string[]
  round: number
  drawer: string
  word: string
  phase: 'draw' | 'reveal' | 'done'
  roundStart: number
  revealUntil: number
  solvedAt: number | null
  clearSeq: number
  p: Record<string, DrawPlayer>
  guesses: Guess[]
  seed: number
  used: string[]
}
export type DrawAction = { type: 'guess'; text: string } | { type: 'clear' }

export const normalizeAnswer = (s: string) => s.replace(/\s+/g, '').toLowerCase()
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
export const chosung = (w: string) => [...w].map((ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch }).join('')

function pickWord(seed: number, round: number, used: string[]) {
  const list = WORDS[DIFF[round] ?? 'normal'].filter((w) => !used.includes(w))
  return list[Math.floor(mulberry32(seed + round * 977)() * list.length)]
}

export const drawEngine: Engine<DrawState, DrawAction> = {
  id: 'draw',
  statLabels: { correct: '맞힌 문제', drawnOk: '전달 성공' },
  init(seed, players) {
    const p: Record<string, DrawPlayer> = {}
    for (const id of players) p[id] = { score: 0, correct: 0, drawnOk: 0 }
    const word = pickWord(seed, 0, [])
    return { players, round: 0, drawer: players[0], word, phase: 'draw', roundStart: 0, revealUntil: 0, solvedAt: null, clearSeq: 0, p, guesses: [], seed, used: [word] }
  },
  apply(s, pid, a, t) {
    if (s.phase !== 'draw' || !s.p[pid]) return null
    if (a.type === 'clear') { if (pid !== s.drawer) return null; const n = clone(s); n.clearSeq++; return n }
    if (pid === s.drawer) return null
    const text = a.text.trim().slice(0, 20)
    if (!text) return null
    const n = clone(s)
    const ok = normalizeAnswer(text) === normalizeAnswer(s.word)
    n.guesses = [...n.guesses, { pid, text, ok, t }].slice(-8)
    if (ok) {
      const elapsed = t - s.roundStart
      n.p[pid].score += 2 + (elapsed <= 30_000 ? 1 : 0); n.p[pid].correct++
      n.p[s.drawer].score += 1; n.p[s.drawer].drawnOk++
      n.phase = 'reveal'; n.solvedAt = t; n.revealUntil = t + REVEAL_MS
    }
    return n
  },
  tick(s, t) {
    if (s.phase === 'draw' && t >= s.roundStart + ROUND_MS) {
      const n = clone(s); n.phase = 'reveal'; n.solvedAt = null; n.revealUntil = t + REVEAL_MS; return n
    }
    if (s.phase === 'reveal' && t >= s.revealUntil) {
      const n = clone(s)
      if (s.round >= ROUNDS - 1) { n.phase = 'done'; return n }
      n.round++; n.drawer = s.players[n.round % 2]; n.word = pickWord(s.seed, n.round, s.used); n.used = [...s.used, n.word]
      n.phase = 'draw'; n.roundStart = t; n.solvedAt = null; n.guesses = []
      return n
    }
    return null
  },
  isOver: (s) => s.phase === 'done',
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { correct: p.correct, drawnOk: p.drawnOk } }
    return { scores, stats }
  },
}
