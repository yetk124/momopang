import { useEffect, useRef, useState } from 'react'
import { Fit } from '../../components/ui'
import { sfx } from '../../lib/sfx'
import { onEph, useStore } from '../../store'
import type { GameProps } from '../rush/RushGame'
import { SUIKA_TIME, type SuikaState } from './engine'
import { BOX_H, BOX_W, DANGER_Y, DROP_Y, FRUITS, RADIUS, drop, newWorld, nextKind, snapshot, step, type World } from './physics'

const FRUIT_IMG = import.meta.glob('../../assets/fruits/*.webp', { eager: true, import: 'default' }) as Record<string, string>
export const fruitSrc = (k: number) => FRUIT_IMG[`../../assets/fruits/${FRUITS[k]}.webp`]
const images: HTMLImageElement[] = []
function img(k: number) {
  if (typeof Image === 'undefined') return null
  if (!images[k]) { const i = new Image(); i.src = fruitSrc(k); images[k] = i }
  return images[k]
}
const DROP_GAP_MS = 450

/** 상대 스냅샷 검증: [x, y, k] 정수 묶음, 최대 80개 */
function cleanSnap(d: unknown): { f: number[]; s: number } | null {
  if (!d || typeof d !== 'object') return null
  const o = d as { f?: unknown; s?: unknown }
  if (!Array.isArray(o.f) || o.f.length > 240 || o.f.length % 3 || typeof o.s !== 'number') return null
  if (!o.f.every((v, i) => Number.isInteger(v) && (i % 3 === 2 ? v >= 0 && v < FRUITS.length : v >= -50 && v <= 600))) return null
  return { f: o.f as number[], s: o.s }
}

function draw(ctx: CanvasRenderingContext2D, w: World | { fruits: { x: number; y: number; k: number }[] }, scale: number, danger: boolean) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, BOX_W, BOX_H)
  ctx.fillStyle = '#FFF7EA'; ctx.fillRect(0, 0, BOX_W, BOX_H)
  ctx.strokeStyle = danger ? '#F05A4E' : 'rgba(240,90,78,.35)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(BOX_W, DANGER_Y); ctx.stroke(); ctx.setLineDash([])
  for (const f of w.fruits) {
    const r = RADIUS[f.k], im = img(f.k)
    if (im?.complete && im.naturalWidth) ctx.drawImage(im, f.x - r * 1.08, f.y - r * 1.08, r * 2.16, r * 2.16)
    else { ctx.fillStyle = '#F2554A'; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill() }
  }
}

export function SuikaGame({ state, t, meId, oppId }: GameProps<SuikaState>) {
  const act = useStore((s) => s.act)
  const eph = useStore((s) => s.eph)
  const me = state.p[meId]; const opp = state.p[oppId]
  const world = useRef<World>(newWorld())
  const canvas = useRef<HTMLCanvasElement>(null)
  const oppCanvas = useRef<HTMLCanvasElement>(null)
  const aim = useRef(BOX_W / 2)
  /** 화면에 보이는 조준 위치 (aim을 부드럽게 따라감) */
  const shown = useRef(BOX_W / 2)
  const lastDrop = useRef(0)
  const [hud, setHud] = useState({ score: 0, drops: 0, over: false })
  const timeUp = t >= SUIKA_TIME
  const timeUpRef = useRef(timeUp); timeUpRef.current = timeUp

  // 물리 + 그리기 루프
  useEffect(() => {
    let raf = 0, prev = performance.now(), lastReport = 0, lastSnap = 0
    let sent = { score: -1, best: -1, n: -1, over: -1 }
    const loop = (now: number) => {
      const w = world.current
      step(w, (now - prev) / 1000); prev = now
      if (w.pops.length) { sfx.pop(); w.pops = [] }
      const c = canvas.current
      if (c) {
        // 화면 크기에 맞춰 캔버스 해상도 조정 (처음엔 기본 300×150이라)
        const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr)
        if (cw && (c.width !== cw || c.height !== ch)) { c.width = cw; c.height = ch }
        const ctx = c.getContext('2d')
        if (ctx) {
          const sc = c.width / BOX_W
          draw(ctx, w, sc, w.dangerSince !== null)
          if (!w.over && !timeUpRef.current) {
            // 조준선 + 떨어뜨릴 과일
            shown.current += (aim.current - shown.current) * 0.3 // 부드럽게 따라가기
            const k = nextKind(state.seed, w.drops), r = RADIUS[k], x = Math.max(r, Math.min(BOX_W - r, shown.current))
            ctx.strokeStyle = 'rgba(143,123,234,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, DROP_Y + r); ctx.lineTo(x, BOX_H); ctx.stroke()
            const im = img(k); if (im?.complete) { ctx.globalAlpha = now - lastDrop.current < DROP_GAP_MS ? 0.35 : 1; ctx.drawImage(im, x - r * 1.08, DROP_Y - r * 1.08, r * 2.16, r * 2.16); ctx.globalAlpha = 1 }
          }
        }
      }
      // 점수 보고 (바뀌었을 때만, 0.25초 간격)
      const cur = { score: w.score, best: w.best, n: w.drops, over: w.over ? 1 : 0 }
      if ((cur.score !== sent.score || cur.best !== sent.best || cur.n !== sent.n || cur.over !== sent.over) && now - lastReport > 250) {
        lastReport = now; sent = cur; act({ type: 'report', ...cur })
        setHud({ score: w.score, drops: w.drops, over: w.over })
      }
      if (now - lastSnap > 400) { lastSnap = now; eph('suika', { f: snapshot(w), s: w.score }) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state.seed]) // eslint-disable-line react-hooks/exhaustive-deps

  // 상대 미리보기
  useEffect(() => onEph((from, k, d) => {
    if (k !== 'suika' || from !== oppId) return
    const snap = cleanSnap(d); const c = oppCanvas.current
    if (!snap || !c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const fruits = []; for (let i = 0; i < snap.f.length; i += 3) fruits.push({ x: snap.f[i], y: snap.f[i + 1], k: snap.f[i + 2] })
    draw(ctx, { fruits }, c.width / BOX_W, false)
  }), [oppId])

  // PC: 마우스가 과일통 밖에 있어도 좌우를 따라오고, ← → 키로 움직이고 스페이스로 떨어뜨리기
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !canvas.current) return
      const r = canvas.current.getBoundingClientRect()
      aim.current = Math.max(0, Math.min(BOX_W, ((e.clientX - r.left) / r.width) * BOX_W))
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { aim.current = Math.max(0, aim.current - 18); e.preventDefault() }
      else if (e.key === 'ArrowRight') { aim.current = Math.min(BOX_W, aim.current + 18); e.preventDefault() }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); dropNow() }
    }
    addEventListener('pointermove', move); addEventListener('keydown', key)
    return () => { removeEventListener('pointermove', move); removeEventListener('keydown', key) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dropNow = () => {
    const w = world.current, now = performance.now()
    if (w.over || timeUpRef.current || now - lastDrop.current < DROP_GAP_MS) return
    lastDrop.current = now; shown.current = aim.current
    drop(w, nextKind(state.seed, w.drops), aim.current); sfx.tap()
  }
  const toX = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * BOX_W }
  const onDown = (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); aim.current = toX(e) }
  // 마우스는 누르지 않아도 따라오고, 터치는 끄는 동안 따라와요
  const onMove = (e: React.PointerEvent) => { if (e.pointerType === 'mouse' || e.buttons || e.pointerType === 'touch') aim.current = toX(e) }
  const onUp = (e: React.PointerEvent) => { aim.current = toX(e); dropNow() }

  const w = world.current
  const upcoming = nextKind(state.seed, w.drops + 1)
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        <div className="rounded-2xl bg-white/85 shadow-soft px-3 py-2 flex flex-col items-center justify-center min-w-[72px]">
          <span className="text-[11px] font-bold text-ink-mute">다음 과일</span>
          <img src={fruitSrc(upcoming)} alt="" className="w-9 h-9 object-contain" />
        </div>
        <div className="flex-1 rounded-2xl bg-white/85 shadow-soft px-3 py-2 flex flex-col items-center justify-center">
          <span className="text-[11px] font-bold text-ink-mute">내 점수</span>
          <span className="font-round text-[26px] leading-none tabular-nums text-lav-500">{me?.score ?? hud.score}</span>
          <span className="text-[11px] font-bold text-ink-mute mt-0.5">최고 <img src={fruitSrc(me?.best ?? 0)} alt="" className="inline w-4 h-4 -mt-0.5" /></span>
        </div>
        <div className="rounded-2xl bg-white/85 shadow-soft p-1.5 flex flex-col items-center">
          <canvas ref={oppCanvas} width={66} height={92} className="rounded-lg w-[66px] h-[92px] bg-[#FFF7EA]" aria-label="상대 과일통 미리보기" />
          <span className="text-[11px] font-bold text-ink-soft tabular-nums mt-0.5">상대 {opp?.score ?? 0}{opp?.over ? ' · 끝' : ''}</span>
        </div>
      </div>
      <Fit aspect={BOX_W / BOX_H} max={360}>
        <div className="relative w-full h-full">
          <canvas ref={canvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="w-full h-full rounded-3xl shadow-card touch-none border-[3px] border-[#E8C79A]" aria-label="내 과일통" />
          {(hud.over || me?.over) && (
            <div className="absolute inset-0 rounded-3xl bg-white/70 grid place-items-center text-center">
              <div><p className="font-round text-[26px] text-peach-400">과일통이 꽉 찼어요!</p><p className="text-[13px] font-bold text-ink-soft mt-1">상대가 끝날 때까지 기다려요</p></div>
            </div>
          )}
        </div>
      </Fit>
    </div>
  )
}
