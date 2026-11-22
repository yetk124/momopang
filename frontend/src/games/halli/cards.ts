// 할리갈리 카드 이미지: HALLI_CARDS[과일][개수-1] (딸기·바나나·포도·레몬, src/assets/halli)
import { byName } from '../../components/charData'
const all = byName(import.meta.glob('../../assets/halli/*.webp', { eager: true, import: 'default' }) as Record<string, string>)
export const HALLI_CARDS: string[][] = [0, 1, 2, 3].map((f) => [1, 2, 3, 4, 5].map((n) => all[`f${f}-${n}`]))
