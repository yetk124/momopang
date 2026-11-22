// Supabase Edge Function 예시: 비밀 API 키를 서버에만 두고 단어를 확인하는 프록시
// 배포:  supabase secrets set DICT_API_KEY=발급받은키 ALLOWED_ORIGIN=https://내도메인
//        supabase functions deploy dict-check
// 프론트: supabase.functions.invoke('dict-check', { body: { word } })
// ※ 키는 Deno.env 에서만 읽어요. 프론트 코드·.env(VITE_)에는 절대 넣지 마세요.

const KEY = Deno.env.get('DICT_API_KEY') ?? ''
const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

// 아주 간단한 IP별 분당 제한 (인스턴스 메모리 기준)
const hits = new Map<string, { n: number; at: number }>()
const limited = (ip: string) => {
  const now = Date.now(); const h = hits.get(ip)
  if (!h || now - h.at > 60_000) { hits.set(ip, { n: 1, at: now }); return false }
  h.n++; return h.n > 60
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (limited(ip)) return Response.json({ error: 'too many requests' }, { status: 429, headers: cors })

  let word = ''
  try { word = String((await req.json())?.word ?? '') } catch { /* noop */ }
  // 입력 검증: 완성형 한글 2~8자만
  if (!/^[가-힣]{2,8}$/.test(word)) return Response.json({ ok: false, reason: 'invalid' }, { headers: cors })
  if (!KEY) return Response.json({ ok: null, reason: 'no-key' }, { headers: cors })

  // 우리말샘 검색 API (명사만)
  const url = new URL('https://opendict.korean.go.kr/api/search')
  url.search = new URLSearchParams({ key: KEY, q: word, req_type: 'json', part: 'word', sort: 'dict', pos: '1', advanced: 'y', method: 'exact' }).toString()
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
    const data = await r.json()
    const total = Number(data?.channel?.total ?? 0)
    return Response.json({ ok: total > 0 }, { headers: cors })
  } catch {
    return Response.json({ ok: null, reason: 'upstream' }, { headers: cors })
  }
})
