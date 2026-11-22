import { mulberry32, shuffle } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const ASK_MS = 8000
export const REVEAL_MS = 1800
export const QUESTIONS_PER_GAME = 10

// [문제, 정답, 오답1, 오답2, 오답3]
const BANK: [string, string, string, string, string][] = [
  ['우리나라의 수도는?', '서울', '부산', '대구', '인천'],
  ['한글을 만든 왕은?', '세종대왕', '태조', '정조', '광개토대왕'],
  ['1년은 며칠일까? (윤년 아님)', '365일', '360일', '366일', '364일'],
  ['무지개 색은 몇 가지?', '7가지', '5가지', '6가지', '8가지'],
  ['가장 큰 바다는?', '태평양', '대서양', '인도양', '북극해'],
  ['물이 끓는 온도는? (1기압)', '100℃', '90℃', '80℃', '120℃'],
  ['거미의 다리는 몇 개?', '8개', '6개', '10개', '12개'],
  ['태양계에서 가장 큰 행성은?', '목성', '토성', '지구', '해왕성'],
  ['피자의 고향 나라는?', '이탈리아', '프랑스', '미국', '스페인'],
  ['축구 한 팀의 선수는 몇 명?', '11명', '9명', '10명', '12명'],
  ['독도는 어느 도에 속할까?', '경상북도', '강원도', '경상남도', '울릉도청'],
  ['8 × 7 = ?', '56', '54', '48', '63'],
  ['하루는 몇 시간?', '24시간', '12시간', '20시간', '36시간'],
  ['펭귄이 사는 대륙은?', '남극', '북극', '아프리카', '유럽'],
  ['빨강 + 파랑 = ?', '보라', '초록', '주황', '갈색'],
  ['우리나라 최고봉은?', '한라산', '백두산', '지리산', '설악산'],
  ['1분은 몇 초?', '60초', '100초', '30초', '90초'],
  ['김치의 주재료 채소는?', '배추', '양파', '감자', '당근'],
  ['에펠탑이 있는 도시는?', '파리', '런던', '로마', '베를린'],
  ['오징어 다리는 몇 개?', '10개', '8개', '6개', '12개'],
  ['가장 빠른 육상 동물은?', '치타', '사자', '말', '타조'],
  ['한국 화폐 오만원권 인물은?', '신사임당', '세종대왕', '이황', '이이'],
  ['셜록 홈즈의 조수 이름은?', '왓슨', '모리어티', '레스트레이드', '허드슨'],
  ['12 ÷ 4 = ?', '3', '4', '2', '6'],
  ['얼음이 녹으면 무엇이 될까?', '물', '수증기', '눈', '소금'],
  ['남산타워가 있는 도시는?', '서울', '부산', '광주', '대전'],
  ['사계절 중 가장 더운 계절은?', '여름', '봄', '가을', '겨울'],
  ['고양이 울음소리는?', '야옹', '멍멍', '음메', '꽥꽥'],
  ['올림픽 오륜기의 원은 몇 개?', '5개', '4개', '6개', '7개'],
  ['우리 몸에서 가장 큰 장기는?', '피부', '간', '심장', '폐'],
  ['붕어빵 안에 주로 들어가는 것은?', '팥', '고기', '치즈', '김치'],
  ['한국 전통 명절 추석의 다른 말은?', '한가위', '설날', '단오', '동지'],
  ['지구에서 가장 가까운 별은?', '태양', '북극성', '시리우스', '달'],
  ['3의 제곱은?', '9', '6', '12', '27'],
  ['스마트폰 OS가 아닌 것은?', '윈도우 98', 'iOS', '안드로이드', 'HarmonyOS'],
  ['바나나는 무슨 색으로 익을까?', '노랑', '빨강', '보라', '파랑'],
  ['한국의 국화(나라꽃)는?', '무궁화', '장미', '진달래', '개나리'],
  ['컴퓨터의 두뇌라 불리는 부품은?', 'CPU', 'RAM', 'SSD', '모니터'],
  ['떡볶이의 주재료는?', '떡', '면', '밥', '빵'],
  ['일주일은 며칠?', '7일', '5일', '6일', '10일'],
]

export interface QuizQ { q: string; opts: string[]; a: number }
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
    const qs = shuffle(BANK, r).slice(0, QUESTIONS_PER_GAME).map(([q, ...o]) => {
      const opts = shuffle(o, r)
      return { q, opts, a: opts.indexOf(o[0]) }
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
