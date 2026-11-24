import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { useStore } from '../store'
import { HERO_IMG } from './charData'
import { IcBack, IcClock } from './Icons'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'peach' | 'danger'
export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-lav-400 text-white shadow-pop hover:bg-lav-500 disabled:bg-lav-200 disabled:shadow-none',
    secondary: 'bg-white text-ink border border-lav-100 shadow-soft hover:bg-lav-50 disabled:text-ink-mute',
    ghost: 'bg-transparent text-ink-soft hover:bg-white/60',
    peach: 'bg-peach-200 text-ink hover:bg-peach-400/60',
    danger: 'bg-[#FFE4E1] text-[#C9433A] hover:bg-[#FFD3CE]',
  }
  return (
    <button
      className={`min-h-[52px] rounded-2xl px-5 font-bold text-[16px] inline-flex items-center justify-center gap-2 transition active:scale-[.97] disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lav-500 ${v[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function TopBar({ title, onBack, right }: { title?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="relative z-20 flex items-center h-14 px-2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-24">{onBack && <button onClick={onBack} aria-label="뒤로" className="w-11 h-11 grid place-items-center rounded-full hover:bg-white text-ink"><IcBack className="w-6 h-6" /></button>}</div>
      <div className="flex-1 text-center font-bold text-[17px]">{title}</div>
      <div className="w-24 flex justify-end whitespace-nowrap">{right}</div>
    </div>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const [dy, setDy] = useState(0)
  const drag = useRef<{ y: number; t: number } | null>(null)
  useEffect(() => {
    if (!open) { setDy(0); return }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  // 시트가 열려 있는 동안 뒤 페이지 스크롤 고정 (아이폰에서 페이지가 같이 끌려 내려가는 문제)
  useEffect(() => {
    if (!open) return
    const y = window.scrollY, b = document.body.style
    const prev = { position: b.position, top: b.top, left: b.left, right: b.right, overflow: b.overflow }
    b.position = 'fixed'; b.top = `-${y}px`; b.left = '0'; b.right = '0'; b.overflow = 'hidden'
    return () => { Object.assign(b, prev); window.scrollTo(0, y) }
  }, [open])
  if (!open) return null
  // 손잡이·제목 영역을 아래로 끌어내리면 닫힘
  const start = (e: React.PointerEvent) => { drag.current = { y: e.clientY, t: Date.now() }; (e.currentTarget as Element).setPointerCapture?.(e.pointerId) }
  const move = (e: React.PointerEvent) => { if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y)) }
  const end = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d) return
    const dist = e.clientY - d.y, speed = dist / Math.max(1, Date.now() - d.t)
    if (dist > 110 || (dist > 40 && speed > 0.6)) onClose(); else setDy(0)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal>
      <button aria-label="닫기" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-fadeup touch-none" style={{ opacity: Math.max(0.2, 1 - dy / 400) }} onClick={onClose} />
      <div className="relative w-full max-w-[440px]" style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: drag.current ? 'none' : 'transform .2s ease-out' }}>
      <div className="w-full bg-cream rounded-t-4xl px-6 pb-8 shadow-card max-h-[92dvh] flex flex-col" 
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))', animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1) both' }}>
        <div className="pt-3 pb-3 cursor-grab active:cursor-grabbing touch-none select-none" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-lav-200" aria-hidden />
          {title && <h2 className="text-xl font-extrabold mt-3">{title}</h2>}
        </div>
        <div className="overflow-y-auto overscroll-contain min-h-0 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>{children}</div>
      </div>
      </div>
    </div>
  )
}

export function Toast() {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div key={toast.id} className="fixed top-4 inset-x-0 z-[60] flex justify-center pointer-events-none px-4" style={{ marginTop: 'env(safe-area-inset-top)' }}>
      <div className="bg-ink text-white text-[15px] font-semibold px-4 py-2.5 rounded-full shadow-card animate-fadeup">{toast.text}</div>
    </div>
  )
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-bold ${className}`}>{children}</div>
}

export function TimerPill({ ms, warn = 10_000 }: { ms: number; warn?: number }) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const low = ms <= warn
  return (
    <Pill className={`tabular-nums ${low ? 'bg-[#FFE4E1] text-[#C9433A]' : 'bg-lav-100 text-lav-600'}`}>
      <IcClock className="w-4 h-4" />
      {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </Pill>
  )
}

export function useBox(ref: RefObject<HTMLElement>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); return () => ro.disconnect()
  }, [ref])
  return box
}
/** 남은 공간 안에 비율을 지키며 최대한 크게 (작은 화면에서도 넘치지 않게) */
export function Fit({ aspect = 1, max = 9999, className = '', children }: { aspect?: number; max?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { w, h } = useBox(ref)
  const width = Math.max(0, Math.min(max, w, h * aspect))
  return (
    <div ref={ref} className={`flex-1 min-h-0 w-full grid place-items-center ${className}`}>
      {width > 0 && <div style={{ width, height: width / aspect }}>{children}</div>}
    </div>
  )
}

/** 일정 간격 리렌더 (타이머용) */
export function useNow(interval = 100) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), interval); return () => clearInterval(id) }, [interval])
  return now
}

export function Hero({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <img src={HERO_IMG} alt="게임기를 든 곰돌이와 고양이" draggable={false} className="relative w-full h-auto select-none animate-[floaty_4s_ease-in-out_infinite]" />
    </div>
  )
}

export function Confetti() {
  const colors = ['#A897F5', '#FFB08A', '#FFCF4D', '#6CBF5B', '#FF8FA3', '#7EC8F2']
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 12) * 0.12}s`, animationDuration: `${2.4 + (i % 5) * 0.35}s`, transform: `rotate(${i * 23}deg)` }} />
      ))}
    </div>
  )
}

export function ConfirmSheet({ open, title, desc, confirm, onConfirm, onClose }: { open: boolean; title: string; desc?: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {desc && <p className="text-ink-soft mb-5">{desc}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button variant="danger" onClick={onConfirm}>{confirm}</Button>
      </div>
    </Sheet>
  )
}
