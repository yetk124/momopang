// 끝말잇기 사전 검사: 우리말샘 오픈 API를 서버에서만 부르는 프록시
// ── 대시보드로 배포 (CLI 없이) ──
//   1) Supabase 대시보드 → Edge Functions → Deploy a new function → Via Editor
//   2) 이름: dict-check → 이 파일 내용을 붙여넣고 Deploy
//   3) Edge Functions → Secrets 에 DICT_API_KEY = 우리말샘 인증키 추가
// ── CLI로 배포할 때 ──
//   supabase secrets set DICT_API_KEY=발급받은키
//   supabase functions deploy dict-check
// 프론트: supabase.functions.invoke('dict-check', { body: { word } })  (frontend/src/lib/dict.ts)
// ※ 키는 Deno.env 에서만 읽어요. 프론트 코드·.env(VITE_)·깃허브에는 절대 넣지 마세요.
//
// 응답: { ok: true }  사전에 있는 명사
//       { ok: false } 사전에 없음
//       { ok: null }  확인 못 함 (키 없음·우리말샘 오류) → 앱은 통과 처리

const KEY = Deno.env.get('DICT_API_KEY') ?? ''
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://momopang.vercel.app,http://localhost:5173,http://localhost:4173')
  .split(',').map((s) => s.trim()).filter(Boolean)

const corsFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

// IP별 분당 60회 제한 (인스턴스 메모리 기준)
const hits = new Map<string, { n: number; at: number }>()
const limited = (ip: string) => {
  const now = Date.now(); const h = hits.get(ip)
  if (!h || now - h.at > 60_000) { hits.set(ip, { n: 1, at: now }); if (hits.size > 5000) hits.clear(); return false }
  h.n++; return h.n > 60
}

// 같은 단어는 우리말샘에 다시 묻지 않게 캐시 (인스턴스 메모리, 최대 5000개)
const cache = new Map<string, boolean>()
const remember = (w: string, ok: boolean) => {
  cache.set(w, ok)
  if (cache.size > 5000) cache.delete(cache.keys().next().value as string)
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get('origin'))
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (limited(ip)) return json({ ok: null, reason: 'too-many' }, 429)

  let word = ''
  try { word = String((await req.json())?.word ?? '').trim() } catch { /* noop */ }
  // 입력 검증: 완성형 한글 2~8자만
  if (!/^[가-힣]{2,8}$/.test(word)) return json({ ok: false, reason: 'invalid' })
  const hit = cache.get(word)
  if (hit !== undefined) return json({ ok: hit, cached: true })
  if (!KEY) return json({ ok: null, reason: 'no-key' })

  // 우리말샘 검색 API: 정확히 일치하는 명사(pos=1)
  const url = new URL('https://opendict.korean.go.kr/api/search')
  url.search = new URLSearchParams({
    key: KEY, q: word, req_type: 'json', part: 'word', sort: 'dict', num: '10',
    advanced: 'y', method: 'exact', pos: '1',
  }).toString()
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) })
    if (!r.ok) return json({ ok: null, reason: 'upstream' })
    const data = await r.json()
    // 키 오류 등은 { error: {...} } 로 와요 → 판정하지 않음
    if (!data?.channel) return json({ ok: null, reason: 'upstream' })
    const ok = Number(data.channel.total ?? 0) > 0
    remember(word, ok)
    return json({ ok })
  } catch {
    return json({ ok: null, reason: 'upstream' })
  }
})
