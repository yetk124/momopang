// 끝말잇기 사전 검사
// 1) 내장 단어 목록에 있으면 바로 통과
// 2) 서버(Supabase Edge Function 'dict-check' → 우리말샘)에 물어봄. 결과는 기기에 캐시
// 3) 서버가 없거나(데모) 키가 없거나 1.5초 안에 답이 없으면 null → 게임이 멈추지 않게 통과 처리
import { WORDS } from '../games/word/words'
import { getSupabase } from '../net/transports'

const KEY = 'momopang.dict'
const MAX = 800
const TIMEOUT = 1500
const BUILTIN = new Set(WORDS)

const ls = (() => { try { return window.localStorage } catch { return undefined } })()
const cache: Map<string, boolean> = (() => {
  try {
    const v = JSON.parse(ls?.getItem(KEY) ?? '[]')
    return new Map(Array.isArray(v) ? v.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'boolean') : [])
  } catch { return new Map() }
})()
const remember = (w: string, ok: boolean) => {
  cache.delete(w); cache.set(w, ok)
  while (cache.size > MAX) cache.delete(cache.keys().next().value as string)
  try { ls?.setItem(KEY, JSON.stringify([...cache])) } catch { /* noop */ }
}

/** true: 사전에 있음 / false: 없음 / null: 확인 못 함(통과 처리) */
export async function checkWord(word: string): Promise<boolean | null> {
  if (!/^[가-힣]{2,8}$/.test(word)) return false
  if (BUILTIN.has(word)) return true
  const hit = cache.get(word)
  if (hit !== undefined) return hit
  const sb = getSupabase()
  if (!sb) return null
  try {
    const res = await Promise.race([
      sb.functions.invoke('dict-check', { body: { word } }),
      new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT)),
    ])
    if (!res || res.error) return null
    const ok = (res.data as { ok?: boolean | null } | null)?.ok
    if (typeof ok !== 'boolean') return null
    remember(word, ok)
    return ok
  } catch { return null }
}
