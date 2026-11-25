// 랜덤 매칭 신고 · 차단
// - 매칭 ID: 랜덤 매칭에서만 쓰는 브라우저별 공개 ID (랭킹용 기기 ID와 분리)
// - 차단 목록: 폰(localStorage)에 저장 + 카카오 로그인 시 서버 blocks 테이블과 동기화
// - 신고: 서버 report_player 함수 (backend/supabase/migrations/20261125000000_safety.sql)
import { useSyncExternalStore } from 'react'
import { getSupabase } from '../net/transports'
import { uid } from './rng'

export type ReportReason = 'abuse' | 'sexual' | 'privacy' | 'grief' | 'etc'
export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'abuse', label: '욕설 · 비하 · 혐오 표현' },
  { id: 'sexual', label: '음란하거나 성적인 내용' },
  { id: 'privacy', label: '개인정보 요구 · 연락처 교환 유도' },
  { id: 'grief', label: '게임 방해 · 도배 · 불쾌한 닉네임' },
  { id: 'etc', label: '기타' },
]

export interface Blocked { mid: string; name: string; at: number }

const MID_KEY = 'momopang.mid'
const BLOCK_KEY = 'momopang.blocks'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isMid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s)

const ls = (() => { try { return window.localStorage } catch { return undefined } })()

/** 내 매칭 ID (브라우저마다 하나, 계속 유지) */
export function getMatchId(): string {
  let id: string | null = null
  try { id = ls?.getItem(MID_KEY) ?? null } catch { /* noop */ }
  if (!isMid(id)) { id = uid(); try { ls?.setItem(MID_KEY, id) } catch { /* noop */ } }
  return id
}

// ── 차단 목록 (구독 가능한 작은 저장소) ──
let blocks: Blocked[] = (() => {
  try {
    const v = JSON.parse(ls?.getItem(BLOCK_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((b) => isMid(b?.mid)).map((b) => ({ mid: b.mid, name: String(b.name ?? '').slice(0, 10), at: Number(b.at) || 0 })) : []
  } catch { return [] }
})()
const subs = new Set<() => void>()
const save = (next: Blocked[]) => {
  blocks = next
  try { ls?.setItem(BLOCK_KEY, JSON.stringify(next)) } catch { /* noop */ }
  subs.forEach((f) => f())
}
export const getBlocks = () => blocks
export const isBlocked = (mid: string | undefined) => !!mid && blocks.some((b) => b.mid === mid)
export const useBlocks = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, getBlocks, getBlocks)

const kakaoUid = async () => {
  const sb = getSupabase(); if (!sb) return null
  const s = (await sb.auth.getSession()).data.session
  // 익명 세션은 제외 (카카오 계정만 서버 저장)
  return s && !s.user.is_anonymous ? s.user.id : null
}

export async function blockPlayer(mid: string, name: string) {
  if (!isMid(mid) || mid === getMatchId() || isBlocked(mid)) return
  save([{ mid, name: name.slice(0, 10), at: Date.now() }, ...blocks].slice(0, 500))
  const u = await kakaoUid(); if (!u) return
  try { await getSupabase()!.from('blocks').upsert({ user_id: u, blocked_mid: mid, blocked_name: name.slice(0, 10) }, { ignoreDuplicates: true }) } catch { /* 다음 동기화 때 */ }
}

export async function unblockPlayer(mid: string) {
  save(blocks.filter((b) => b.mid !== mid))
  const u = await kakaoUid(); if (!u) return
  try { await getSupabase()!.from('blocks').delete().eq('user_id', u).eq('blocked_mid', mid) } catch { /* noop */ }
}

/** 카카오 로그인 직후/앱 시작 시: 폰 목록과 서버 목록을 합쳐 양쪽에 맞춤 */
export async function syncBlocks() {
  const u = await kakaoUid(); if (!u) return
  const sb = getSupabase()!
  try {
    const { data, error } = await sb.from('blocks').select('blocked_mid, blocked_name, created_at').eq('user_id', u).limit(500)
    if (error || !data) return
    const server = new Set(data.map((r) => r.blocked_mid as string))
    const missing = blocks.filter((b) => !server.has(b.mid))
    if (missing.length) await sb.from('blocks').upsert(missing.map((b) => ({ user_id: u, blocked_mid: b.mid, blocked_name: b.name })), { ignoreDuplicates: true })
    const local = new Set(blocks.map((b) => b.mid))
    const add = data.filter((r) => isMid(r.blocked_mid) && !local.has(r.blocked_mid)).map((r) => ({ mid: r.blocked_mid as string, name: String(r.blocked_name ?? ''), at: Date.parse(r.created_at) || Date.now() }))
    if (add.length) save([...blocks, ...add].sort((a, b) => b.at - a.at))
  } catch { /* noop */ }
}

/** 신고 접수. 서버가 없으면(데모) 성공한 것처럼 처리 */
export async function reportPlayer(p: { target: string; name: string; reason: ReportReason; detail: string; game: string; room: string }): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return true
  try {
    const { data, error } = await sb.rpc('report_player', {
      p_reporter: getMatchId(), p_target: p.target, p_name: p.name.slice(0, 10), p_reason: p.reason,
      p_detail: p.detail.slice(0, 200), p_game: p.game.slice(0, 20), p_room: p.room.slice(0, 12),
    })
    return !error && data !== false
  } catch { return false }
}

/** 신고 누적으로 랜덤 매칭이 제한됐는지 (풀리는 시각, 없으면 null) */
export async function matchRestrictedUntil(): Promise<number | null> {
  const sb = getSupabase(); if (!sb) return null
  try {
    const { data, error } = await sb.rpc('match_restricted_until', { p_mid: getMatchId() })
    if (error || !data) return null
    const t = Date.parse(String(data)); return t > Date.now() ? t : null
  } catch { return null }
}
