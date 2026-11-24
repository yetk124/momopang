import { mulberry32, shuffle } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const ASK_MS = 8000
export const REVEAL_MS = 1800
export const QUESTIONS_PER_GAME = 10

import { QUIZ_BANK } from './bank'

/** 최근에 나온 문제는 피하고, 카테고리는 한 판에 최대 2문제씩 섞어서 고르기 (방장 기기에 기록) */
const SEEN_KEY = 'momopang.quiz.seen'
function pickQuestions(r: () => number) {
  let seen: number[] = []
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); if (Array.isArray(v)) seen = v.filter((x) => Number.isInteger(x)) } catch { /* noop */ }
  const all = QUIZ_BANK.map((_, i) => i)
  let pool = all.filter((i) => !seen.includes(i))
  if (pool.length < QUESTIONS_PER_GAME * 2) { seen = []; pool = all }
  const picked: number[] = []; const perCat: Record<string, number> = {}
  for (const i of shuffle(pool, r)) {
    const cat = QUIZ_BANK[i][0]
    if ((perCat[cat] ?? 0) >= 2) continue
    perCat[cat] = (perCat[cat] ?? 0) + 1; picked.push(i)
    if (picked.length === QUESTIONS_PER_GAME) break
  }
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...picked].slice(-160))) } catch { /* noop */ }
  return picked
}

export interface QuizQ { q: string; opts: string[]; a: number; cat?: string }
export interface QuizPlayer { score: number; correct: number; wrong: number }
export interface QuizState {
  qs: QuizQ[]
  idx: number
  phase: 'ask' | 'reveal' | 'done'
  askAt: number
  revealUntil: number
  answers: Record<string, { choice: number; t: number; ok: boolean }>
  winner: string | null
  p: Record<string, QuizPlayer>
}
export type QuizAction = { choice: number }

export const quizEngine: Engine<QuizState, QuizAction> = {
  id: 'quiz',
  statLabels: { correct: '먼저 맞힘', wrong: '틀림' },
  init(seed, players) {
    const r = mulberry32(seed)
    const qs = pickQuestions(r).map((i) => {
      const [cat, q, ...o] = QUIZ_BANK[i]
      const opts = shuffle(o, r)
      return { q, opts, a: opts.indexOf(o[0]), cat }
    })
    const p: Record<string, QuizPlayer> = {}
    for (const id of players) p[id] = { score: 0, correct: 0, wrong: 0 }
    return { qs, idx: 0, phase: 'ask', askAt: 600, revealUntil: 0, answers: {}, winner: null, p }
  },
  apply(s, pid, a, t) {
    if (s.phase !== 'ask' || t < s.askAt || s.answers[pid] || !s.p[pid]) return null
    const n = clone(s)
    const ok = a.choice === s.qs[s.idx].a
    n.answers[pid] = { choice: a.choice, t, ok }
    if (ok) { n.winner = pid; n.p[pid].score += 1; n.p[pid].correct++; n.phase = 'reveal'; n.revealUntil = t + REVEAL_MS }
    else {
      n.p[pid].wrong++
      if (Object.keys(n.p).every((id) => n.answers[id])) { n.phase = 'reveal'; n.revealUntil = t + REVEAL_MS }
    }
    return n
  },
  tick(s, t) {
    if (s.phase === 'ask' && t >= s.askAt + ASK_MS) { const n = clone(s); n.phase = 'reveal'; n.revealUntil = t + REVEAL_MS; return n }
    if (s.phase === 'reveal' && t >= s.revealUntil) {
      const n = clone(s)
      if (s.idx + 1 >= s.qs.length) { n.phase = 'done'; return n }
      n.idx++; n.phase = 'ask'; n.askAt = t + 400; n.answers = {}; n.winner = null
      return n
    }
    return null
  },
  timer: (s, t) => (s.phase === 'ask' ? Math.min(ASK_MS, s.askAt + ASK_MS - t) : null),
  isOver: (s) => s.phase === 'done',
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { correct: p.correct, wrong: p.wrong } }
    return { scores, stats }
  },
}
