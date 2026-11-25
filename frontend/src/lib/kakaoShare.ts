// 카카오톡 공유 (JavaScript SDK, 필요할 때만 불러옴)
// - JavaScript 키는 브라우저에 공개되는 키라 코드에 기본값으로 둬요 (비밀 키 아님)
// - 카카오 디벨로퍼스: 플랫폼 키 > JavaScript 키 > JS SDK 도메인, 제품 링크 관리 > 웹 도메인에 사이트 주소 등록 필요
import { isKid } from './settings'

const KEY = import.meta.env.MODE === 'single' ? '' : ((import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) || '80b2844552a2228287bd94b54c9e3054').trim()
const SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js'
const SRI = 'sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E'
const SITE = 'https://momopang.vercel.app'

interface KakaoSDK { init(k: string): void; isInitialized(): boolean; Share: { sendDefault(o: unknown): void } }
declare global { interface Window { Kakao?: KakaoSDK } }

/** 배포 사이트에서만, 어린이 모드가 아닐 때만 */
export const kakaoShareAvailable = () => {
  if (!KEY || isKid()) return false
  try { return location.protocol === 'https:' || location.hostname === 'localhost' } catch { return false }
}

let loading: Promise<KakaoSDK | null> | null = null
function load(): Promise<KakaoSDK | null> {
  if (window.Kakao?.isInitialized()) return Promise.resolve(window.Kakao)
  loading ??= new Promise((resolve) => {
    const done = () => {
      const K = window.Kakao
      if (!K) { loading = null; resolve(null); return }
      try { if (!K.isInitialized()) K.init(KEY); resolve(K) } catch { loading = null; resolve(null) }
    }
    if (window.Kakao) { done(); return }
    const s = document.createElement('script')
    s.src = SDK; s.integrity = SRI; s.crossOrigin = 'anonymous'; s.async = true
    s.onload = done
    s.onerror = () => { loading = null; s.remove(); resolve(null) }
    document.head.appendChild(s)
  })
  return loading
}

/** 미리 불러두기 (대기실에 들어왔을 때) */
export const preloadKakao = () => { if (kakaoShareAvailable()) void load() }

/** 방 초대 카드 보내기. 실패하면 false (호출한 쪽에서 링크 공유로 대체) */
export async function shareRoomToKakao(p: { code: string; url: string; nickname: string; game?: string }): Promise<boolean> {
  if (!kakaoShareAvailable()) return false
  const K = await load(); if (!K) return false
  const link = { mobileWebUrl: p.url, webUrl: p.url }
  try {
    K.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${p.nickname}님이 같이 놀재요!`,
        description: `${p.game ? `${p.game} 한 판 어때? · ` : ''}방 코드 ${p.code}`,
        imageUrl: `${SITE}/og.png`,
        imageWidth: 1200, imageHeight: 600,
        link,
      },
      buttons: [{ title: '같이 하기', link }],
    })
    return true
  } catch { return false }
}
