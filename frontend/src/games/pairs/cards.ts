// 짝 맞추기 카드 이미지 (src/assets/cards)
import { byName } from '../../components/charData'
const all = byName(import.meta.glob('../../assets/cards/*.webp', { eager: true, import: 'default' }) as Record<string, string>)
export const CARD_BACK = all.back
export const CARD_FACES: Record<string, string> = all
