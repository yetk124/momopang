import { useEffect, useState } from 'react'
import { HERO_IMG } from '../components/charData'
import wordmarkUrl from '../assets/wordmark.webp'

// 둥둥 떠다니는 장식 (하트·별·반짝이·게임패드)
const DECO: { k: 'heart' | 'star' | 'spark' | 'pad'; x: number; y: number; s: number; d: number; c: string }[] = [
  { k: 'heart', x: 12, y: 14, s: 26, d: 0, c: '#FF9FB8' },
  { k: 'star', x: 82, y: 11, s: 28, d: 0.6, c: '#FFD24D' },
  { k: 'spark', x: 70, y: 24, s: 18, d: 1.2, c: '#B9A6F7' },
  { k: 'pad', x: 18, y: 30, s: 30, d: 0.3, c: '#C9B6FA' },
  { k: 'spark', x: 30, y: 8, s: 14, d: 1.5, c: '#FFB08A' },
  { k: 'star', x: 6, y: 78, s: 22, d: 0.9, c: '#FFD24D' },
  { k: 'heart', x: 88, y: 74, s: 22, d: 0.4, c: '#FF9FB8' },
  { k: 'pad', x: 80, y: 82, s: 28, d: 1.1, c: '#FFC2D4' },
  { k: 'spark', x: 22, y: 86, s: 16, d: 0.2, c: '#B9A6F7' },
]
function Deco({ k, c, s }: { k: string; c: string; s: number }) {
  const common = { width: s, height: s, viewBox: '0 0 24 24' }
  if (k === 'heart') return <svg {...common}><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z" fill={c} /></svg>
  if (k === 'star') return <svg {...common}><path d="M12 2.5l2.8 6 6.4.7-4.8 4.4 1.4 6.4L12 16.8 6.2 20l1.4-6.4L2.8 9.2l6.4-.7z" fill={c} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
  if (k === 'spark') return <svg {...common}><path d="M12 2c.8 5 3 7.2 8 8-5 .8-7.2 3-8 8-.8-5-3-7.2-8-8 5-.8 7.2-3 8-8z" fill={c} /></svg>
  return <svg {...common}><path d="M7 7h10a5 5 0 014.8 6.3l-1 3.7a2.6 2.6 0 01-4.3 1.2L14 16h-4l-2.5 2.2a2.6 2.6 0 01-4.3-1.2l-1-3.7A5 5 0 017 7z" fill={c} /><circle cx="16" cy="11" r="1.2" fill="#fff" /><path d="M7 10v3M5.5 11.5h3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" /></svg>
}

/** 앱 첫 로딩 화면 */
export function Splash({ onDone, minMs = 1700 }: { onDone: () => void; minMs?: number }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    let alive = true
    const ready = Promise.all([HERO_IMG, wordmarkUrl].map((src) => new Promise<void>((r) => { const i = new Image(); i.onload = i.onerror = () => r(); i.src = src })))
    const wait = new Promise((r) => setTimeout(r, minMs))
    void Promise.all([ready, wait]).then(() => { if (!alive) return; setLeaving(true); setTimeout(onDone, 450) })
    return () => { alive = false }
  }, [minMs, onDone])

  return (
    <div className={`fixed inset-0 z-[80] flex justify-center transition-all duration-500 ${leaving ? 'opacity-0 scale-[1.03]' : 'opacity-100'}`} role="status" aria-label="모모팡 불러오는 중">
      <div className="relative w-full max-w-[440px] h-full overflow-hidden flex flex-col items-center justify-center px-8"
        style={{ background: 'radial-gradient(120% 70% at 50% 0%, #EDE6FF 0%, #F6F0FF 35%, transparent 70%), radial-gradient(120% 60% at 50% 100%, #FFE6EE 0%, transparent 65%), #FFF8F0' }}>
        {DECO.map((d, i) => (
          <span key={i} className="absolute pointer-events-none" aria-hidden
            style={{ left: `${d.x}%`, top: `${d.y}%`, animation: `decoFloat ${3 + (i % 3)}s ${d.d}s ease-in-out infinite, fadeup .6s ${0.2 + d.d * 0.3}s ease-out both` }}>
            <Deco k={d.k} c={d.c} s={d.s} />
          </span>
        ))}

        <div className="relative w-full flex flex-col items-center">
          <img src={wordmarkUrl} alt="모모팡" className="w-[72%] max-w-[300px] h-auto drop-shadow-[0_6px_14px_rgba(168,151,245,.25)]" style={{ animation: 'splashPop .7s cubic-bezier(.2,1.6,.4,1) both' }} />
          <div className="relative w-[92%] max-w-[360px] mt-4">
            <div className="absolute left-[10%] right-[10%] bottom-[2%] h-[10%] rounded-[50%] bg-lav-300/30 blur-md" />
            <img src={HERO_IMG} alt="" className="relative w-full h-auto" style={{ animation: 'heroIn .7s .25s cubic-bezier(.2,1.3,.4,1) both, decoFloat 3.2s 1s ease-in-out infinite' }} />
          </div>
          <p className="mt-5 text-ink-soft font-bold text-[16px] text-center" style={{ animation: 'fadeup .5s .55s ease-out both' }}>전화하면서, 게임도 하고 더 가까워져요</p>
        </div>

        <div className="absolute inset-x-0 flex flex-col items-center gap-2" style={{ bottom: 'max(48px, calc(env(safe-area-inset-bottom) + 32px))' }}>
          <div className="w-40 h-2 rounded-full bg-white/80 overflow-hidden shadow-[inset_0_1px_2px_rgba(120,90,160,.15)]">
            <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#B9A6F7,#FF9FB8)', animation: `loadBar ${minMs}ms ease-out both` }} />
          </div>
          <span className="text-[12px] font-semibold text-ink-mute">친구랑 놀 준비 중…</span>
        </div>
      </div>
      <style>{`
        @keyframes splashPop { 0% { transform: scale(.4) rotate(-6deg); opacity: 0 } 60% { transform: scale(1.06) rotate(2deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes heroIn { 0% { transform: translateY(30px) scale(.9); opacity: 0 } 100% { transform: none; opacity: 1 } }
        @keyframes decoFloat { 0%, 100% { translate: 0 0 } 50% { translate: 0 -8px } }
        @keyframes loadBar { from { width: 4% } to { width: 100% } }
      `}</style>
    </div>
  )
}
