import { settings, useSettings } from './settings'

/**
 * Google Analytics 4 연동
 * - VITE_GA_MEASUREMENT_ID 가 있으면 기본으로 수집하고(안내 후), 사용자가 거부하면 멈춰요. (옵트아웃)
 * - 닉네임·플레이어 ID 같은 개인 식별 정보는 보내지 않아요.
 *
 * 보내는 이벤트
 * - screen_view / page_view : 화면 진입 (home, lobby, game_apple, result_apple …)
 * - screen_time             : 화면을 떠날 때 머문 시간(초)
 * - ui_click                : 누른 버튼 이름 + 그때의 화면
 * - room_create, room_join, game_select, game_start, game_end, rematch_request, room_leave
 */
const GA_ID = ((import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || 'G-X04RFE2HWW').trim()
export const analyticsAvailable = !!GA_ID

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

let loaded = false
let current: { name: string; since: number } | null = null

function load() {
  if (loaded || !GA_ID || typeof document === 'undefined') return
  loaded = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer!.push(arguments) } // eslint-disable-line prefer-rest-params
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(s)
}

const enabled = () => !!GA_ID && settings().analytics !== 'denied'

export function track(event: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (!enabled()) return
  load()
  window.gtag?.('event', event, { ...params, screen_name: params.screen_name ?? current?.name })
}

function flushScreenTime() {
  if (!current) return
  const sec = Math.round((Date.now() - current.since) / 1000)
  if (sec > 0) track('screen_time', { screen_name: current.name, seconds: sec })
}

/** 화면이 바뀔 때마다 호출 */
export function trackScreen(name: string) {
  if (current?.name === name) return
  flushScreenTime()
  current = { name, since: Date.now() }
  sendView(name)
}
function sendView(name: string) {
  if (!enabled()) return
  load()
  window.gtag?.('event', 'page_view', { page_title: name, page_location: `${location.origin}/${name}`, page_path: `/${name}` })
  window.gtag?.('event', 'screen_view', { screen_name: name, app_name: '모모팡' })
}

function labelOf(el: Element): string {
  const t = (el as HTMLElement).dataset?.track || el.getAttribute('aria-label') || el.textContent || ''
  return t.replace(/\s+/g, ' ').trim().slice(0, 40) || el.tagName.toLowerCase()
}

let armed = false
/** 앱 시작 시 한 번: 클릭 추적 + 탭 숨김 시 체류시간 전송 */
export function initAnalytics() {
  if (armed || !GA_ID) return
  armed = true
  if (enabled()) load()
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest('button, a, [role="button"], [role="switch"], [data-track]')
    if (el) track('ui_click', { label: labelOf(el) })
  }, { capture: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { flushScreenTime(); if (current) current.since = Date.now() }
    else if (current) current.since = Date.now()
  })
  useSettings.subscribe((s, prev) => {
    if (s.analytics === prev.analytics) return
    if (s.analytics !== 'denied') { load(); window.gtag?.('consent', 'update', { analytics_storage: 'granted' }); if (current) sendView(current.name) }
    else window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  })
}
