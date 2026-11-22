import type { Engine, GameId } from './types'
import { appleEngine } from './apple/engine'
import { halliEngine } from './halli/engine'
import { drawEngine } from './draw/engine'
import { rushEngine } from './rush/engine'
import { blockEngine } from './block/engine'
import { spotEngine } from './spot/engine'
import { wordEngine } from './word/engine'
import { quizEngine } from './quiz/engine'
import { bombEngine } from './bomb/engine'
import { memoryEngine } from './memory/engine'
import { pairsEngine } from './pairs/engine'
import { mergeEngine } from './merge/engine'

export const ENGINES: Record<GameId, Engine> = { apple: appleEngine, halli: halliEngine, draw: drawEngine, rush: rushEngine, block: blockEngine, spot: spotEngine, word: wordEngine, quiz: quizEngine, bomb: bombEngine, memory: memoryEngine, pairs: pairsEngine, merge: mergeEngine }

export interface GameMeta {
  id: GameId
  name: string
  en: string
  tagline: string
  kind: string
  time: string
  /** 시간 표시용 총 길이(ms). draw는 라운드제라 별도 */
  durationMs: number
  rules: string[]
  scoring: string[]
  tint: string // 카드 배경
}

export const GAMES: GameMeta[] = [
  {
    id: 'apple', name: '사과게임', en: 'Number 10', tagline: '합이 10이 되게 드래그!', kind: '경쟁', time: '2분', durationMs: 120_000, tint: '#FFE9E4',
    rules: ['같은 사과 보드를 둘이 함께 써요', '드래그로 네모를 그려 숫자 합을 10으로', '먼저 지운 사람이 사과를 가져가요'],
    scoring: ['사과 1개당 1점', '한 번에 5개 이상 +3', '3연속 성공 +2'],
  },
  {
    id: 'halli', name: '할리갈리', en: 'Fruit Bell', tagline: '과일 5개면 종 치기!', kind: '실시간', time: '90초', durationMs: 90_000, tint: '#FFEFD9',
    rules: ['번갈아 카드를 한 장씩 뒤집어요', '같은 과일이 정확히 5개면 종을 땡!', '3.5초 안에 안 뒤집으면 자동으로 넘어가요'],
    scoring: ['맞게 치면 +1', '잘못 치면 −1', '3연속 성공 +1'],
  },
  {
    id: 'draw', name: '그림 맞히기', en: 'Draw & Guess', tagline: '그리고 맞히고!', kind: '협력', time: '60초×4', durationMs: 240_000, tint: '#EEE9FF',
    rules: ['한 명이 제시어를 그리고 상대가 맞혀요', '라운드마다 역할을 바꿔요 (총 4라운드)', '30초가 지나면 초성 힌트가 나와요'],
    scoring: ['맞힌 사람 +2', '그린 사람 +1', '30초 안에 맞히면 +1'],
  },
  {
    id: 'rush', name: '숫자 찾기', en: 'Number Rush', tagline: '1부터 9까지 빠르게!', kind: '경쟁', time: '60초', durationMs: 60_000, tint: '#E8F0FF',
    rules: ['같은 숫자판을 각자 풀어요', '1 → 9 순서대로 눌러요', '다 누르면 새 판이 나와요'],
    scoring: ['숫자 하나 +1', '한 세트 완성 +3', '틀려도 감점은 없어요'],
  },
  {
    id: 'block', name: '블록 퍼즐', en: 'Block Duel', tagline: '줄을 채워 지워요!', kind: '퍼즐', time: '3분', durationMs: 180_000, tint: '#E5F5EE',
    rules: ['둘 다 같은 순서의 블록을 받아요', '블록을 끌어다 8×8 판에 놓아요', '가로·세로 줄을 채우면 지워져요'],
    scoring: ['한 칸당 1점', '한 줄 10점 · 2줄 +5 · 3줄+ +10', '연속으로 지우면 콤보 보너스'],
  },
  {
    id: 'spot', name: '다른 그림 찾기', en: 'Spot It', tagline: '다른 곳을 먼저 찾아!', kind: '경쟁', time: '90초', durationMs: 90_000, tint: '#FFF3D6',
    rules: ['같은 그림 두 장에서 다른 곳을 찾아요', '먼저 누른 사람이 그 자리를 가져가요', '틀리게 누르면 1.2초 동안 못 눌러요'],
    scoring: ['찾을 때마다 +1', '틀려도 감점은 없어요', '다 찾으면 바로 끝 · 그림 7종 랜덤'],
  },
  {
    id: 'word', name: '끝말잇기', en: 'Word Chain', tagline: '끝 글자로 이어가요!', kind: '경쟁', time: '90초', durationMs: 90_000, tint: '#F1F0FF',
    rules: ['앞 단어의 끝 글자로 시작하는 단어를 써요', '두음법칙 OK (력→역, 녀→여)', '한 턴은 10초! 못 이으면 상대가 새 단어로 시작'],
    scoring: ['기본 +1', '3글자 +1 · 4글자 이상 +2', '3초 안에 +2 · 5초 안에 +1', '못 이으면 상대 +2'],
  },
  {
    id: 'quiz', name: '스피드 퀴즈', en: 'Speed Quiz', tagline: '먼저 맞히면 내 점수!', kind: '실시간', time: '10문제', durationMs: 120_000, tint: '#FFF6D9',
    rules: ['같은 문제가 동시에 나와요', '4개 중 정답을 먼저 고른 사람이 +1', '틀리면 그 문제는 더 못 골라요'],
    scoring: ['먼저 맞히면 +1', '틀려도 감점 없음', '문제당 8초'],
  },
  {
    id: 'bomb', name: '폭탄 돌리기', en: 'Hot Potato', tagline: '터지기 전에 넘겨요!', kind: '실시간', time: '3라운드', durationMs: 90_000, tint: '#EFEDF2',
    rules: ['폭탄을 든 사람은 계산 문제를 풀어야 넘길 수 있어요', '언제 터질지는 아무도 몰라요 (12~26초)', '틀리면 0.9초 동안 못 눌러요'],
    scoring: ['상대 손에서 터지면 +1', '총 3라운드', '터진 사람이 다음 폭탄을 먼저 들어요'],
  },
  {
    id: 'memory', name: '기억력 게임', en: 'Memory', tagline: '순서를 기억해요!', kind: '경쟁', time: '6라운드', durationMs: 90_000, tint: '#FFEAF0',
    rules: ['색이 켜지는 순서를 잘 봐요', '같은 순서로 눌러요 (둘 다 각자)', '라운드마다 하나씩 길어져요 (3→8개)'],
    scoring: ['다 맞히면 +1', '먼저 끝내면 +1 더', '한 번 틀리면 그 라운드 끝'],
  },
  {
    id: 'pairs', name: '짝 맞추기', en: 'Pairs', tagline: '번갈아 뒤집어 짝 찾기!', kind: '기억력·관찰력', time: '2분 30초', durationMs: 150_000, tint: '#F3EEFF',
    rules: ['카드 한 판(4×5, 10쌍)을 둘이 같이 써요', '내 차례에 두 장을 뒤집어 같은 그림이면 짝!', '맞히면 한 번 더 · 틀리면 상대 차례 (한 턴 8초)'],
    scoring: ['짝 하나 +10', '연속으로 맞히면 +5씩 더', '상대가 뒤집은 카드도 기억해두면 유리'],
  },
  {
    id: 'merge', name: '숫자 합치기', en: 'Merge', tagline: '같은 숫자를 합쳐 크게!', kind: '전략·퍼즐', time: '2분', durationMs: 120_000, tint: '#FFF0E6',
    rules: ['스와이프나 방향키로 타일을 밀어요', '같은 숫자가 부딪히면 합쳐져요', '둘 다 같은 순서로 새 타일이 나와요'],
    scoring: ['합쳐서 만든 숫자만큼 점수', '보드가 꽉 차면 끝', '최대 타일도 기록돼요'],
  },
]
export const META = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameMeta>

