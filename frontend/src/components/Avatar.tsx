import { BOT_IMG, CHAR_IMG } from './charData'
import unicornUrl from '../assets/limited-unicorn.webp'
import wizardUrl from '../assets/limited-wizard.webp'

/** 한정판 아바타 (잠금) — 획득 조건은 추후 결정 */
export const LIMITED_AVATARS = [
  { id: 'unicorn', name: '유니콘냥', img: unicornUrl },
  { id: 'wizard', name: '마법사냥', img: wizardUrl },
] as const

export type AvatarId = 'mouse' | 'cow' | 'tiger' | 'rabbit' | 'dragon' | 'snake' | 'horse' | 'sheep' | 'monkey' | 'rooster' | 'dog' | 'pig' | 'bot'
export const AVATARS: { id: AvatarId; name: string; bg: string }[] = [
  { id: 'mouse', name: '찍찍냥', bg: '#EEF0F4' },
  { id: 'cow', name: '음메냥', bg: '#F6EFE8' },
  { id: 'tiger', name: '어흥냥', bg: '#FFEBD6' },
  { id: 'rabbit', name: '깡총냥', bg: '#FFEFF3' },
  { id: 'dragon', name: '용용냥', bg: '#E9F5E1' },
  { id: 'snake', name: '스르냥', bg: '#EAF5DC' },
  { id: 'horse', name: '히힝냥', bg: '#F7EADF' },
  { id: 'sheep', name: '메에냥', bg: '#FBF6EA' },
  { id: 'monkey', name: '끼끼냥', bg: '#F3E8E0' },
  { id: 'rooster', name: '꼬끼냥', bg: '#FFF1EE' },
  { id: 'dog', name: '멍멍냥', bg: '#FAF0E2' },
  { id: 'pig', name: '꿀꿀냥', bg: '#FFEAF0' },
]
const LEGACY: Record<string, AvatarId> = { maltese: 'sheep', poodle: 'dog', cat: 'tiger', bunny: 'rabbit', bear: 'monkey', chick: 'rooster' }
export const toAvatarId = (id: string): AvatarId => (id === 'bot' || CHAR_IMG[id] ? (id as AvatarId) : LEGACY[id] ?? 'rabbit')

export function CharImg({ id, className = '', style }: { id: AvatarId; className?: string; style?: React.CSSProperties }) {
  const aid = toAvatarId(id)
  return <img src={aid === 'bot' ? BOT_IMG : CHAR_IMG[aid]} alt="" draggable={false} className={`select-none pointer-events-none ${className}`} style={style} />
}

/** 원 배경 위에 캐릭터 전신을 잘리지 않게 올림 */
export function Avatar({ id, size = 48, ring, dim, className = '' }: { id: AvatarId; size?: number; ring?: string; dim?: boolean; className?: string }) {
  const aid = toAvatarId(id)
  const bg = AVATARS.find((a) => a.id === aid)?.bg ?? '#fff'
  if (aid === 'bot') return (
    <div className={`relative shrink-0 rounded-full ${dim ? 'grayscale opacity-50' : ''} ${className}`} style={{ width: size, height: size, boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }}>
      <img src={BOT_IMG} alt="" draggable={false} className="w-full h-full select-none pointer-events-none" />
    </div>
  )
  return (
    <div className={`relative shrink-0 ${dim ? 'grayscale opacity-50' : ''} ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: bg, boxShadow: ring ? `0 0 0 3px ${ring}` : 'inset 0 0 0 1.5px rgba(59,53,65,.06)' }} />
      <CharImg id={aid} className="absolute left-1/2 -translate-x-1/2 bottom-[2%] w-[92%] h-[92%] object-contain" />
    </div>
  )
}
