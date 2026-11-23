// 게임 아이콘 (픽셀 스타일, src/assets/icons)
import { byName } from './charData'
export const GAME_ICON_IMG: Record<string, string> = byName(import.meta.glob('../assets/icons/*.webp', { eager: true, import: 'default' }) as Record<string, string>)
