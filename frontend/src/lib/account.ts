// [백엔드 연결] 카카오 계정 데이터: 프로필 · 기록 · 랭킹 합치기 · 탈퇴
// 테이블/함수: backend/supabase/migrations/20261122010000_profiles.sql, 20261122020000_account.sql
import { toAvatarId, type AvatarId } from '../components/Avatar'
import type { GameId } from '../games/types'
import { cleanNickname } from '../net/validate'
import { getSupabase } from '../net/transports'
import { currentKakao, signOut } from './auth'
import { getDeviceId, getLoginType, loadHistory, setLoginType, type HistoryItem } from './storage'
import { loadProgress, mergeProgress, type LimitedId } from './unlocks'
import { syncBlocks } from './safety'

const uidOf = async () => (await getSupabase()?.auth.getSession())?.data.session?.user.id ?? null
export const isKakao = () => getLoginType() === 'kakao'

/** 서버에 저장된 내 프로필 */
export async function fetchMyProfile(): Promise<{ nickname: string; avatar: AvatarId } | null> {
  const sb = getSupabase(); const uid = await uidOf(); if (!sb || !uid) return null
  const { data } = await sb.from('profiles').select('nickname, avatar').eq('id', uid).maybeSingle()
  const nickname = data ? cleanNickname(data.nickname) : null
  return data && nickname ? { nickname, avatar: toAvatarId(String(data.avatar)) } : null
}

/** 프로필 저장 (로그인 상태일 때만) */
export async function saveMyProfile(nickname: string, avatar: string) {
  const sb = getSupabase(); const uid = await uidOf(); if (!sb || !uid) return
  try { await sb.from('profiles').upsert({ id: uid, nickname, avatar, updated_at: new Date().toISOString() }) } catch { /* 다음에 다시 */ }
}

const toRow = (uid: string, h: HistoryItem) => ({
  user_id: uid, session_id: h.id.slice(0, 64), game: h.game, my_score: h.myScore, opp_score: h.oppScore,
  opp_name: (cleanNickname(h.oppName) ?? '상대').slice(0, 10), outcome: h.outcome, played_at: new Date(h.at).toISOString(),
})

/** 게임 1판 기록을 서버에 저장 */
export async function saveHistory(h: HistoryItem) {
  if (!isKakao()) return
  const sb = getSupabase(); const uid = await uidOf(); if (!sb || !uid) return
  try { await sb.from('game_history').upsert(toRow(uid, h), { onConflict: 'user_id,session_id', ignoreDuplicates: true }) } catch { /* noop */ }
}

/** 서버의 내 최근 기록 50판 */
export async function fetchHistory(): Promise<HistoryItem[] | null> {
  const sb = getSupabase(); const uid = await uidOf(); if (!sb || !uid) return null
  const { data, error } = await sb.from('game_history').select('session_id, game, my_score, opp_score, opp_name, outcome, played_at').eq('user_id', uid).order('played_at', { ascending: false }).limit(50)
  if (error || !data) return null
  return data.map((r) => ({ id: r.session_id, game: r.game as GameId, at: Date.parse(r.played_at), myScore: r.my_score, oppScore: r.opp_score, oppName: r.opp_name, outcome: r.outcome as HistoryItem['outcome'] }))
}

/**
 * 카카오 로그인 직후 한 번: 게스트 기록(랭킹·최근 기록)을 계정으로 옮기고 프로필을 맞춤
 * 반환: 서버 프로필(있으면) 또는 null(처음 로그인 → 프로필 정하기 필요)
 */
export async function onKakaoLogin(localProfile: { nickname: string; avatar: string } | null) {
  const sb = getSupabase(); const uid = await uidOf(); if (!sb || !uid) return null
  setLoginType('kakao')
  try { await sb.rpc('merge_guest', { p_device: getDeviceId() }) } catch { /* noop */ }
  const local = loadHistory()
  if (local.length) { try { await sb.from('game_history').upsert(local.map((h) => toRow(uid, h)), { onConflict: 'user_id,session_id', ignoreDuplicates: true }) } catch { /* noop */ } }
  const server = await fetchMyProfile()
  if (!server && localProfile) await saveMyProfile(localProfile.nickname, localProfile.avatar)
  void syncUnlocks(); void syncBlocks()
  return server ?? localProfile
}

/** 해금 진행도를 서버 기록과 합치고, 해금 목록을 계정에 저장 → 새로 열린 아바타 */
export async function syncUnlocks(): Promise<LimitedId[]> {
  if (!isKakao()) return []
  const sb = getSupabase(); const uid = await uidOf(); if (!sb || !uid) return []
  try {
    const [{ count: wins }, { data: games }, { data: prof }] = await Promise.all([
      sb.from('game_history').select('session_id', { count: 'exact', head: true }).eq('user_id', uid).eq('outcome', 'win'),
      sb.from('game_history').select('game').eq('user_id', uid).limit(2000),
      sb.from('profiles').select('unlocked').eq('id', uid).maybeSingle(),
    ])
    const played = [...new Set((games ?? []).map((r) => String(r.game)))] as GameId[]
    const before = (prof?.unlocked as string[] | undefined) ?? []
    const { progress, fresh } = mergeProgress({ wins: wins ?? 0, played, unlocked: before as LimitedId[] })
    if (progress.unlocked.length !== before.length) await sb.from('profiles').update({ unlocked: progress.unlocked }).eq('id', uid)
    return fresh
  } catch { return [] }
}

/** 해금 목록만 계정에 저장 (게임 끝나고 새로 열렸을 때) */
export async function saveUnlocks() {
  if (!isKakao()) return
  const sb = getSupabase(); const uid = await uidOf(); if (!sb || !uid) return
  try { await sb.from('profiles').update({ unlocked: loadProgress().unlocked }).eq('id', uid) } catch { /* 다음에 다시 */ }
}

/** 앱 시작 시: 카카오 세션이 있는데 아직 합치기 전이면 처리 */
export async function checkLoginOnBoot(localProfile: { nickname: string; avatar: string } | null) {
  const k = await currentKakao()
  if (!k) { if (isKakao()) setLoginType('guest'); return null } // 세션 만료 → 게스트로
  if (isKakao()) { void syncUnlocks(); void syncBlocks(); return null }
  return onKakaoLogin(localProfile)
}

/** 회원 탈퇴: 서버 계정·프로필·기록·랭킹 삭제 + 기기 데이터 초기화 */
export async function deleteAccount() {
  const sb = getSupabase(); if (!sb) throw new Error('연결되지 않았어요')
  const { error } = await sb.rpc('delete_my_account')
  if (error) throw new Error('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요')
  await signOut()
  try { ['duoplay-profile', 'duoplay-history', 'duoplay-login', 'duoplay-device'].forEach((k) => localStorage.removeItem(k)) } catch { /* noop */ }
}
