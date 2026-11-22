// 캐릭터·일러스트 이미지 (src/assets)
import heroUrl from '../assets/hero.webp'
import botUrl from '../assets/bot.webp'

const files = import.meta.glob('../assets/chars/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const byName = (f: Record<string, string>) => Object.fromEntries(Object.entries(f).map(([p, url]) => [p.split('/').pop()!.replace('.webp', ''), url]))

export const CHAR_IMG: Record<string, string> = byName(files)
export const HERO_IMG = heroUrl
export const BOT_IMG = botUrl
export { byName }
