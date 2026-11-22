import type { SVGProps } from 'react'
import { GAME_ICON_IMG } from './gameIconData'

const INK = '#3B3541'
type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({ viewBox: '0 0 48 48', 'aria-hidden': true, ...p })

// ── 과일 ──
export const Apple = (p: P) => (
  <svg {...base(p)}>
    <path d="M24 13c-3-2-11-3-14 4s0 18 6 22c3 2 5 1 8 0 3 1 5 2 8 0 6-4 9-15 6-22s-11-6-14-4z" fill="#F2554A" stroke="#C93A31" strokeWidth="1.5" />
    <path d="M24 14c0-4 1-7 3-9" stroke="#6B4A2F" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <path d="M27 9c3-4 8-4 10-2-2 4-7 5-10 2z" fill="#6CBF5B" />
    <ellipse cx="15.5" cy="21" rx="2.6" ry="4.5" fill="#fff" opacity=".45" transform="rotate(20 15.5 21)" />
  </svg>
)
export const Strawberry = (p: P) => (
  <svg {...base(p)}>
    <path d="M24 42c-8-4-15-14-14-22 1-6 7-7 14-7s13 1 14 7c1 8-6 18-14 22z" fill="#F2554A" stroke="#C93A31" strokeWidth="1.5" />
    <path d="M14 13c3 0 6 2 10 0 4 2 7 0 10 0-2 4-6 5-10 4-4 1-8 0-10-4z" fill="#6CBF5B" stroke="#4E9C40" strokeWidth="1" />
    <path d="M24 13V7" stroke="#4E9C40" strokeWidth="2.4" strokeLinecap="round" />
    {[[18, 22], [24, 21], [30, 22], [16, 28], [22, 28], [28, 28], [33, 27], [19, 34], [25, 34], [29, 33]].map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx="1" ry="1.5" fill="#FFE6A8" />
    ))}
  </svg>
)
export const Banana = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 14c2 14 13 24 28 22 3 0 4-3 1-4-12 1-20-7-23-19-1-3-6-3-6 1z" fill="#FFD84D" stroke="#C9A12A" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 14l-1-4 4 1" stroke="#6B4A2F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <path d="M14 18c3 8 9 13 17 14" stroke="#E8B930" strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </svg>
)
export const Grape = (p: P) => (
  <svg {...base(p)}>
    {[[18, 18], [26, 18], [34, 18], [22, 25], [30, 25], [18, 32], [26, 32], [22, 39], [34, 31]].slice(0, 8).map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="5.2" fill="#9B6FD6" stroke="#6E46A8" strokeWidth="1.3" />
    ))}
    <path d="M26 13V7m0 3c3-3 7-3 9-1" stroke="#4E9C40" strokeWidth="2.2" fill="none" strokeLinecap="round" />
  </svg>
)
export const Lemon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 26c0-9 8-15 16-15s16 6 16 15-8 13-16 13S8 35 8 26z" fill="#F6E25A" stroke="#C9B12A" strokeWidth="1.5" transform="rotate(-20 24 26)" />
    <ellipse cx="17" cy="22" rx="3" ry="5" fill="#fff" opacity=".45" transform="rotate(30 17 22)" />
    <path d="M37 14l3-3" stroke="#6B4A2F" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)
export const FRUIT_ICONS = [Strawberry, Banana, Grape, Lemon]

export const Bell = (p: P) => (
  <svg viewBox="0 0 120 110" aria-hidden {...p}>
    <ellipse cx="60" cy="100" rx="44" ry="7" fill="#3B3541" opacity=".12" />
    <path d="M60 10c-4 0-6 3-6 6v3C38 22 30 36 30 54c0 14-4 22-12 28v6h84v-6c-8-6-12-14-12-28 0-18-8-32-24-35v-3c0-3-2-6-6-6z" fill="#FFCF4D" stroke="#B9871E" strokeWidth="3" strokeLinejoin="round" />
    <path d="M42 34c-5 6-7 14-7 22" stroke="#FFF1BF" strokeWidth="6" strokeLinecap="round" fill="none" />
    <rect x="14" y="84" width="92" height="10" rx="5" fill="#F2B43A" stroke="#B9871E" strokeWidth="3" />
    <circle cx="60" cy="98" r="7" fill="#F2B43A" stroke="#B9871E" strokeWidth="3" />
  </svg>
)

// ── 게임 아이콘 ──
export function GameIcon({ id, className = 'w-10 h-10' }: { id: string; className?: string }) {
  const img = GAME_ICON_IMG[id]
  if (img) return <img src={img} alt="" draggable={false} className={`object-contain select-none ${className}`} />
  switch (id) {
    case 'apple': return <Apple className={className} />
    case 'halli': return <Strawberry className={className} />
    case 'draw': return (
      <svg {...base({ className })}>
        <path d="M24 6C13 6 5 14 5 24s8 18 17 18c3 0 4-2 3-4s0-4 3-4h5c8 0 11-5 11-11C44 13 35 6 24 6z" fill="#FFE7C2" stroke={INK} strokeWidth="2" />
        <circle cx="15" cy="21" r="3.4" fill="#F2554A" /><circle cx="22" cy="13.5" r="3.4" fill="#FFCF4D" /><circle cx="31" cy="14" r="3.4" fill="#6CBF5B" /><circle cx="36" cy="22" r="3.4" fill="#5F8EF2" />
      </svg>
    )
    case 'rush': return (
      <svg {...base({ className })}>
        {[[6, 6, '1'], [25, 6, '2'], [6, 25, '3'], [25, 25, '4']].map(([x, y, n]) => (
          <g key={n as string}><rect x={x as number} y={y as number} width="17" height="17" rx="5" fill="#A897F5" /><text x={(x as number) + 8.5} y={(y as number) + 13} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="sans-serif">{n}</text></g>
        ))}
      </svg>
    )
    case 'block': return (
      <svg {...base({ className })}>
        {[[6, 8, '#5F8EF2'], [18, 8, '#5F8EF2'], [18, 20, '#5F8EF2'], [30, 20, '#7EC8F2'], [6, 32, '#B79CF2'], [18, 32, '#B79CF2'], [30, 32, '#B79CF2']].map(([x, y, c], i) => (
          <rect key={i} x={x as number} y={y as number} width="11" height="11" rx="2.5" fill={c as string} stroke="rgba(0,0,0,.15)" />
        ))}
      </svg>
    )
    case 'word': return (
      <svg {...base({ className })}><path d="M8 10h32a4 4 0 014 4v16a4 4 0 01-4 4H22l-9 7v-7H8a4 4 0 01-4-4V14a4 4 0 014-4z" fill="#fff" stroke={INK} strokeWidth="2.2" /><circle cx="16" cy="22" r="2.4" fill={INK} /><circle cx="24" cy="22" r="2.4" fill={INK} /><circle cx="32" cy="22" r="2.4" fill={INK} /></svg>
    )
    case 'quiz': return <svg {...base({ className })}><path d="M27 4L10 27h12l-3 17 18-24H25z" fill="#FFCF4D" stroke="#C9971E" strokeWidth="2" strokeLinejoin="round" /></svg>
    case 'bomb': return (
      <svg {...base({ className })}><circle cx="21" cy="28" r="14" fill="#3B3541" /><circle cx="16" cy="23" r="3.5" fill="#fff" opacity=".4" /><path d="M30 17l4-4" stroke="#6E6775" strokeWidth="5" strokeLinecap="round" /><path d="M35 12c2-3 5-3 6-6" stroke="#B9871E" strokeWidth="2" fill="none" /><circle cx="41" cy="6" r="3" fill="#FF9B4A" /></svg>
    )
    case 'memory': return (
      <svg {...base({ className })}><path d="M24 9c-3-3-9-3-11 1-4 0-6 4-5 7-3 2-3 7 0 9-1 4 2 7 5 7 1 4 6 6 11 3 5 3 10 1 11-3 3 0 6-3 5-7 3-2 3-7 0-9 1-3-1-7-5-7-2-4-8-4-11-1z" fill="#FFB9C6" stroke="#E07D93" strokeWidth="2" /><path d="M24 10v26M17 18c3 1 4 3 4 6M31 18c-3 1-4 3-4 6" stroke="#E07D93" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
    )
    case 'spot': return (
      <svg {...base({ className })}><circle cx="16" cy="24" r="9" fill="#fff" stroke={INK} strokeWidth="2.2" /><circle cx="32" cy="24" r="9" fill="#fff" stroke={INK} strokeWidth="2.2" /><circle cx="18" cy="25" r="3.6" fill={INK} /><circle cx="34" cy="25" r="3.6" fill={INK} /></svg>
    )
    default: return null
  }
}

// ── UI 아이콘 (라인) ──
const line = (d: string) => (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><path d={d} /></svg>
)
export const IcBack = line('M15 5l-7 7 7 7')
export const IcNext = line('M9 5l7 7-7 7')
export const IcClose = line('M6 6l12 12M18 6L6 18')
export const IcCopy = line('M9 9h10v10H9zM5 15V5h10')
export const IcLink = line('M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1')
export const IcShare = line('M12 3v12M7 8l5-5 5 5M5 13v6h14v-6')
export const IcHome = line('M4 11l8-7 8 7v9h-5v-6H9v6H4z')
export const IcTrophy = line('M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8')
export const IcGear = line('M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 1.9L6 8.2 4 8l-1 3 2 1v0l-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-1.9 1.3-1.3 2 .2 1-3z')
export const IcClock = line('M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2')
export const IcUsers = line('M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 010 6M17 14c2 .5 4 2 4 5')
export const IcCheck = line('M5 12l5 5 9-10')
export const IcBot = line('M12 3v3M6 8h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2zM9 13h.01M15 13h.01M9 16h6')
export const IcEraser = line('M4 17l9-9 6 6-6 6H8zM13 8l3-3 6 6-3 3M8 20h12')
export const IcTrash = line('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')
export const IcSearch = line('M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4')
export const IcHeart = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" fill="#FF8FA3" /></svg>
)
