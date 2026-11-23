import { toAvatarId } from '../components/Avatar'
import type { GameId } from '../games/types'
import type { Intent, PlayerInfo } from './protocol'

/**
 * 네트워크로 들어온 값은 전부 믿지 않는다.
 * 방장(권한자)이 처리하기 전에 모양·범위를 검사하고, 맞지 않으면 버린다.
 */
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const isNum = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// 제어문자·zero-width·양방향 제어 문자 제거
const CTRL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g
export const cleanText = (s: string, max: number) => s.normalize('NFC').replace(CTRL, '').trim().slice(0, max)

/**
 * 입력 칸 화이트리스트: 허용한 글자만 남김 (꺾쇠·따옴표·슬래시·백틱 등 코드에 쓰이는 문자는 전부 제거)
 * - 닉네임: 한글·영문·숫자·공백·_ . -
 * - 단어(끝말잇기): 완성형 한글만
 * - 정답(그림 맞히기): 한글·영문·숫자·공백
 */
const NICK_RE = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 _.\-]/g
const WORD_RE = /[^가-힣]/g
const WORD_TYPING_RE = /[^가-힣ㄱ-ㅎㅏ-ㅣ]/g // 입력 중(한글 조합 중)엔 자모 허용
const GUESS_RE = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]/g
export const filterNickInput = (s: string) => s.normalize('NFC').replace(CTRL, '').replace(NICK_RE, '').replace(/\s{2,}/g, ' ').slice(0, 10)
export const filterWordInput = (s: string) => s.normalize('NFC').replace(WORD_RE, '').slice(0, 8)
export const filterWordTyping = (s: string) => s.normalize('NFC').replace(WORD_TYPING_RE, '').slice(0, 8)
export const filterGuessInput = (s: string) => s.normalize('NFC').replace(CTRL, '').replace(GUESS_RE, '').slice(0, 20)

// 기본 비속어 필터 (필요하면 목록을 늘리세요)
const BAD = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새', '지랄', 'fuck', 'shit']
export const hasBadWord = (s: string) => { const t = s.toLowerCase().replace(/[\s_.\-]/g, ''); return BAD.some((w) => t.includes(w)) }
export function cleanNickname(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const n = filterNickInput(s).trim()
  if (!n || hasBadWord(n)) return null
  return n
}

export function cleanPlayer(p: unknown): PlayerInfo | null {
  if (!isObj(p) || !isStr(p.id, 64) || !/^[\w-]{1,64}$/.test(p.id) || !isStr(p.nickname, 40)) return null
  const nickname = cleanNickname(p.nickname) ?? '친구'
  return { id: p.id, nickname, avatar: toAvatarId(String(p.avatar ?? '')), bot: p.bot === true }
}

const ACTIONS: Record<GameId, (a: Record<string, unknown>) => boolean> = {
  rush: (a) => isInt(a.cell, 0, 8),
  block: (a) => isInt(a.h, 0, 2) && isInt(a.r, -1, 10) && isInt(a.c, -1, 10),
  apple: (a) => ['r1', 'c1', 'r2', 'c2'].every((k) => isInt(a[k], 0, 20)),
  halli: (a) => a.type === 'flip' || a.type === 'bell',
  draw: (a) => a.type === 'clear' || (a.type === 'guess' && isStr(a.text, 40)),
  spot: (a) => isNum(a.x, 0, 1) && isNum(a.y, 0, 1),
  word: (a) => isStr(a.word, 20),
  quiz: (a) => isInt(a.choice, 0, 3),
  bomb: (a) => isInt(a.choice, -1000, 1000),
  memory: (a) => isInt(a.c, 0, 3),
  pairs: (a) => isInt(a.cell, 0, 39),
  merge: (a) => a.dir === 'up' || a.dir === 'down' || a.dir === 'left' || a.dir === 'right',
}
const GAME_IDS = Object.keys(ACTIONS) as GameId[]

export function cleanIntent(i: unknown, game: GameId | undefined): Intent | null {
  if (!isObj(i) || typeof i.type !== 'string') return null
  switch (i.type) {
    case 'join': { const player = cleanPlayer(i.player); return player ? { type: 'join', player } : null }
    case 'ready': return typeof i.v === 'boolean' ? { type: 'ready', v: i.v } : null
    case 'select': return GAME_IDS.includes(i.game as GameId) ? { type: 'select', game: i.game as GameId } : null
    case 'act': {
      if (!game || !isObj(i.a) || !ACTIONS[game](i.a)) return null
      // 알려진 키만 골라 새 객체로 (예상 못 한 필드·__proto__ 등 차단)
      const KEYS = ['type', 'cell', 'h', 'r', 'c', 'r1', 'c1', 'r2', 'c2', 'x', 'y', 'text', 'word', 'choice', 'dir']
      const a: Record<string, unknown> = Object.create(null)
      for (const k of KEYS) if (Object.prototype.hasOwnProperty.call(i.a, k)) a[k] = i.a[k]
      if (typeof a.text === 'string') a.text = filterGuessInput(a.text)
      if (typeof a.word === 'string') a.word = filterWordInput(a.word)
      return { type: 'act', a: { ...a } }
    }
    case 'rematch': case 'rematchAccept': case 'rematchDecline': case 'toLobby': case 'leave':
      return { type: i.type }
    default: return null
  }
}

/** 실시간 효과(그림 획, 선택 영역) 검증 */
export function cleanStroke(d: unknown) {
  if (!isObj(d) || !isInt(d.round, 0, 10) || !isStr(d.sid, 80) || !Array.isArray(d.pts) || d.pts.length > 600 || d.pts.length % 2) return null
  if (!d.pts.every((v) => isNum(v, 0, 1))) return null
  const color = typeof d.color === 'string' && /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#3B3541'
  const fill = d.fill === true
  if (fill && d.pts.length !== 2) return null
  return { round: d.round, sid: d.sid, color, size: isNum(d.size, 1, 40) ? d.size : 6, pts: d.pts as number[], done: d.done === true, fill }
}
export function cleanRect(d: unknown) {
  if (d === null) return null
  if (!isObj(d) || !['r1', 'c1', 'r2', 'c2'].every((k) => isInt(d[k], 0, 20))) return undefined
  return { r1: d.r1 as number, c1: d.c1 as number, r2: d.r2 as number, c2: d.c2 as number }
}

/** 플레이어별 초당 입력 제한 (토큰 버킷) */
export class RateLimiter {
  private b = new Map<string, { tokens: number; at: number }>()
  constructor(private perSec = 25, private burst = 40) {}
  allow(id: string) {
    const now = Date.now(); const s = this.b.get(id) ?? { tokens: this.burst, at: now }
    s.tokens = Math.min(this.burst, s.tokens + ((now - s.at) / 1000) * this.perSec); s.at = now
    if (s.tokens < 1) { this.b.set(id, s); return false }
    s.tokens -= 1; this.b.set(id, s); return true
  }
}
