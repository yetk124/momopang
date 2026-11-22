// [백엔드 연결] 카카오 로그인 (Supabase Auth)
// 설정: Kakao Developers 앱 + Supabase 대시보드 › Authentication › Providers › Kakao
// 이메일은 받지 않아요 (Supabase Kakao 설정에서 "Allow users without an email" 켜기)
import { getSupabase, supabaseConfigured } from '../net/transports'

export const kakaoAvailable = supabaseConfigured && import.meta.env.VITE_KAKAO_LOGIN !== 'false'

export interface KakaoProfile { id: string; nickname: string; avatarUrl?: string }

/** 카카오 로그인 페이지로 이동 (돌아오면 앱 주소로 리다이렉트) */
/** selectAccount: true면 카카오 계정 선택(다른 계정 로그인) 화면을 띄움 */
export async function signInWithKakao(selectAccount = false) {
  const sb = getSupabase(); if (!sb) throw new Error('온라인 연결 후 사용할 수 있어요')
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${location.origin}/`,
      // 이메일(account_email)은 비즈앱만 가능 → 닉네임·프로필 사진만 요청
      scopes: 'profile_nickname profile_image',
      ...(selectAccount ? { queryParams: { prompt: 'select_account' } } : {}),
    },
  })
  if (error) throw new Error('카카오 로그인을 시작하지 못했어요')
}

/** 로그인 상태면 카카오 프로필 반환 */
export async function currentKakao(): Promise<KakaoProfile | null> {
  const sb = getSupabase(); if (!sb) return null
  try {
    const { data, error } = await sb.auth.getSession()
    if (error) console.error('[kakao] 세션 확인 실패', error.message)
    const u = data.session?.user
    if (!u) return null
    const providers: string[] = u.app_metadata?.providers ?? [String(u.app_metadata?.provider ?? '')]
    if (!providers.includes('kakao')) return null
    const m = u.user_metadata ?? {}
    return { id: u.id, nickname: String(m.name ?? m.nickname ?? m.full_name ?? ''), avatarUrl: typeof m.avatar_url === 'string' ? m.avatar_url : undefined }
  } catch { return null }
}

export async function signOut() { try { await getSupabase()?.auth.signOut() } catch { /* noop */ } }
