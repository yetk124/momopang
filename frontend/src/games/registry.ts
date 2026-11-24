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
import { suikaEngine } from './suika/engine'
import { omokEngine } from './omok/engine'
import { balanceEngine } from './balance/engine'

export const ENGINES: Record<GameId, Engine> = { apple: appleEngine, halli: halliEngine, draw: drawEngine, rush: rushEngine, block: blockEngine, spot: spotEngine, word: wordEngine, quiz: quizEngine, bomb: bombEngine, memory: memoryEngine, pairs: pairsEngine, merge: mergeEngine, suika: suikaEngine, omok: omokEngine, balance: balanceEngine }

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
  /** 게임 목록에서 보여줄 짧은 설명 */
  desc: string
  /** 자세히 보기: 하는 법 페이지 (e: 그림 이모지, t: 제목, d: 설명) */
  guide: { e: string; t: string; d: string }[]
  tint: string // 카드 배경
}

const ALL_GAMES: GameMeta[] = [
  {
    id: 'apple', name: '사과게임', en: 'Number 10', tagline: '합이 10이 되게 드래그!', kind: '경쟁', time: '1분', durationMs: 60_000, tint: '#FFE9E4',
    rules: ['같은 사과 보드를 둘이 함께 써요', '드래그로 네모를 그려 숫자 합을 10으로', '먼저 지운 사람이 사과를 가져가요', '더 만들 10이 없으면 새 사과판이 나와요'],
    scoring: ['사과 1개당 1점', '한 번에 5개 이상 +3', '3연속 성공 +2'],
    desc: '숫자가 적힌 사과들 중에서 합이 10이 되는 묶음을 찾아 드래그해요. 같은 판을 둘이 같이 쓰니까 먼저 찾는 사람이 임자!',
    guide: [{ e: '🍎➕🍎', t: '네모로 드래그', d: '사과 위를 손가락으로 끌어 네모를 그려요. 네모 안 숫자 합이 딱 10이면 사과가 사라져요.' }, { e: '⚡🤝', t: '같은 판, 빠른 손', d: '먼저 지운 사람이 사과를 가져가요. 더 만들 10이 없으면 새 사과판이 나와요.' }],
  },
  {
    id: 'halli', name: '과일땡!', en: 'Fruit Bell', tagline: '과일 5개면 종 치기!', kind: '실시간', time: '90초', durationMs: 90_000, tint: '#FFEFD9',
    rules: ['번갈아 카드를 한 장씩 뒤집어요', '같은 과일이 정확히 5개면 종을 땡!', '3.5초 안에 안 뒤집으면 자동으로 넘어가요'],
    scoring: ['맞게 치면 +1', '잘못 치면 −1', '3연속 성공 +1'],
    desc: '카드를 번갈아 뒤집다가 같은 과일이 딱 5개가 되는 순간 종을 먼저 치는 순발력 게임이에요.',
    guide: [{ e: '🃏🍓🍌', t: '번갈아 뒤집기', d: '내 차례에 카드를 한 장 뒤집어요. 3.5초 안에 안 뒤집으면 자동으로 넘어가요.' }, { e: '🔔✋', t: '5개면 땡!', d: '보이는 카드 중 같은 과일이 정확히 5개면 종을 눌러요. 4개나 6개일 때 치면 감점!' }],
  },
  {
    id: 'draw', name: '그림 맞히기', en: 'Draw & Guess', tagline: '그리고 맞히고!', kind: '협력', time: '60초×4', durationMs: 240_000, tint: '#EEE9FF',
    rules: ['한 명이 제시어를 그리고 상대가 맞혀요', '라운드마다 역할을 바꿔요 (총 4라운드)', '30초가 지나면 초성 힌트가 나와요'],
    scoring: ['맞힌 사람 +2', '그린 사람 +1', '30초 안에 맞히면 +1'],
    desc: '한 명이 그리고 한 명이 맞히는 협동 게임이에요. 4라운드 동안 역할을 바꿔가며 해요.',
    guide: [{ e: '✏️🎨', t: '그리는 사람', d: '제시어가 보여요. 펜, 색, 채우기로 그림만 그려서 설명해요. 글자는 쓰면 안 돼요!' }, { e: '💬✅', t: '맞히는 사람', d: '그림을 보고 정답을 입력해요. 30초가 지나면 초성 힌트가 나와요.' }],
  },
  {
    id: 'rush', name: '숫자 찾기', en: 'Number Rush', tagline: '순서대로 빠르게!', kind: '경쟁', time: '20초', durationMs: 20_000, tint: '#E8F0FF',
    rules: ['같은 숫자판을 각자 풀어요', '1부터 순서대로 눌러요', '9까지 누르면 10~18, 그다음 19~27처럼 이어져요'],
    scoring: ['숫자 하나 +1', '한 세트 완성 +3', '틀려도 감점은 없어요'],
    desc: '1부터 숫자를 순서대로 빠르게 누르는 20초 승부예요. 9까지 누르면 10부터 이어지는 새 판이 나와요.',
    guide: [{ e: '1️⃣2️⃣3️⃣', t: '순서대로 탭', d: '흩어진 숫자 중 1부터 차례대로 눌러요. 틀려도 감점은 없지만 시간이 아까워요.' }, { e: '🔁⏱️', t: '숫자가 이어져요', d: '9까지 누르면 10~18, 19~27처럼 다음 숫자판이 나와요. 20초 동안 더 멀리 간 사람이 이겨요.' }],
  },
  {
    id: 'block', name: '블록 퍼즐', en: 'Block Duel', tagline: '줄을 채워 지워요!', kind: '퍼즐', time: '3분', durationMs: 180_000, tint: '#E5F5EE',
    rules: ['둘 다 같은 순서의 블록을 받아요', '블록을 끌어다 8×8 판에 놓아요', '가로·세로 줄을 채우면 지워져요'],
    scoring: ['한 칸당 1점', '한 줄 10점 · 2줄 +5 · 3줄+ +10', '연속으로 지우면 콤보 보너스'],
    desc: '블록을 8×8 판에 놓아 가로나 세로 줄을 채우면 지워져요. 둘 다 같은 블록을 받아요.',
    guide: [{ e: '🧩👆', t: '끌어다 놓기', d: '아래 블록 3개 중 하나를 판 위 빈자리로 끌어다 놓아요.' }, { e: '➖💥', t: '줄을 채우면 펑', d: '가로나 세로 한 줄이 꽉 차면 지워지고 점수! 여러 줄을 한 번에 지우면 보너스예요.' }],
  },
  {
    id: 'spot', name: '다른 그림 찾기', en: 'Spot It', tagline: '다른 곳을 먼저 찾아!', kind: '경쟁', time: '90초', durationMs: 90_000, tint: '#FFF3D6',
    rules: ['같은 그림 두 장에서 다른 곳을 찾아요', '먼저 누른 사람이 그 자리를 가져가요', '틀리게 누르면 0.7초 동안 못 눌러요'],
    scoring: ['찾을 때마다 +1', '틀려도 감점은 없어요', '다 찾으면 바로 끝 · 안 해본 그림부터 나와요'],
    desc: '똑같아 보이는 두 그림에서 다른 곳을 먼저 찾는 사람이 점수를 가져가요.',
    guide: [{ e: '🖼️🔍', t: '다른 곳 탭', d: '위아래 그림을 비교해서 다른 부분을 아무 그림에서나 눌러요.' }, { e: '✔️⏳', t: '먼저 찾으면 내 것', d: '찾은 곳엔 내 색 체크가 생겨요. 틀리게 누르면 0.7초 동안 못 눌러요.' }],
  },
  {
    id: 'word', name: '끝말잇기', en: 'Word Chain', tagline: '끝 글자로 이어가요!', kind: '경쟁', time: '90초', durationMs: 90_000, tint: '#F1F0FF',
    rules: ['앞 단어의 끝 글자로 시작하는 단어를 써요', '두음법칙 OK (력→역, 녀→여)', '한 턴은 10초! 못 이으면 상대가 새 단어로 시작'],
    scoring: ['기본 +1', '3글자 +1 · 4글자 이상 +2', '3초 안에 +2 · 5초 안에 +1', '못 이으면 상대 +2'],
    desc: '앞 단어의 끝 글자로 시작하는 단어를 번갈아 써요. 길고 빠를수록 점수가 커요.',
    guide: [{ e: '🔤➡️🔤', t: '끝 글자로 잇기', d: '기차 → 차표 → 표정처럼 이어가요. 두음법칙도 돼요 (력 → 역).' }, { e: '⏱️🔥', t: '한 턴 10초', d: '10초 안에 못 이으면 상대가 +2점을 받고 새 단어로 시작해요. 3초 안에 쓰면 보너스!' }],
  },
  {
    id: 'quiz', name: '스피드 퀴즈', en: 'Speed Quiz', tagline: '먼저 맞히면 내 점수!', kind: '실시간', time: '10문제', durationMs: 120_000, tint: '#FFF6D9',
    rules: ['같은 문제가 동시에 나와요', '상식·과학·속담·맞춤법·넌센스 등 16개 분야 200문제', '4개 중 정답을 먼저 고른 사람이 +1'],
    scoring: ['먼저 맞히면 +1', '틀려도 감점 없음', '문제당 8초'],
    desc: '16개 분야 200문제 중 10문제가 섞여 나와요. 4개 보기 중 정답을 먼저 고른 사람이 점수를 가져가요.',
    guide: [{ e: '❓🅰️🅱️', t: '4개 중 하나', d: '문제를 읽고 보기 4개 중 정답을 눌러요. 문제당 8초예요.' }, { e: '🏃💨', t: '먼저 맞히면 승', d: '먼저 맞힌 사람만 +1점. 틀리면 그 문제는 더 고를 수 없어요.' }],
  },
  {
    id: 'bomb', name: '폭탄 돌리기', en: 'Hot Potato', tagline: '터지기 전에 넘겨요!', kind: '실시간', time: '3라운드', durationMs: 90_000, tint: '#EFEDF2',
    rules: ['폭탄을 든 사람은 계산 문제를 풀어야 넘길 수 있어요', '언제 터질지는 아무도 몰라요 (12~26초)', '틀리면 0.9초 동안 못 눌러요'],
    scoring: ['상대 손에서 터지면 +1', '총 3라운드', '터진 사람이 다음 폭탄을 먼저 들어요'],
    desc: '폭탄을 든 사람은 계산 문제를 풀어야 상대에게 넘길 수 있어요. 내 손에서 터지면 안 돼요!',
    guide: [{ e: '💣🧮', t: '문제 풀고 넘기기', d: '폭탄이 내 쪽에 오면 간단한 계산 문제가 나와요. 맞히면 폭탄이 상대에게 넘어가요.' }, { e: '⏰💥', t: '언제 터질지 몰라요', d: '12~26초 사이에 아무 때나 터져요. 상대 손에서 터지면 내가 +1점!' }],
  },
  {
    id: 'memory', name: '기억력 게임', en: 'Memory', tagline: '순서를 기억해요!', kind: '경쟁', time: '6라운드', durationMs: 90_000, tint: '#FFEAF0',
    rules: ['색이 켜지는 순서를 잘 봐요', '같은 순서로 눌러요 (둘 다 각자)', '라운드마다 하나씩 길어져요 (3→8개)'],
    scoring: ['다 맞히면 +1', '먼저 끝내면 +1 더', '한 번 틀리면 그 라운드 끝'],
    desc: '색이 켜지는 순서를 기억했다가 똑같이 누르는 게임이에요. 라운드마다 하나씩 길어져요.',
    guide: [{ e: '👀🟥🟦', t: '순서 보기', d: '색깔 칸이 하나씩 반짝여요. 순서를 잘 기억해요.' }, { e: '👆✅', t: '똑같이 누르기', d: '같은 순서로 눌러요. 다 맞히면 +1, 상대보다 먼저 끝내면 +1 더!' }],
  },
  {
    id: 'pairs', name: '짝 맞추기', en: 'Pairs', tagline: '번갈아 뒤집어 짝 찾기!', kind: '기억력·관찰력', time: '2분 30초', durationMs: 150_000, tint: '#F3EEFF',
    rules: ['카드 한 판(4×5, 10쌍)을 둘이 같이 써요', '시작할 때 1초 동안 모든 카드를 보여줘요', '내 차례에 두 장을 뒤집어 같은 그림이면 짝!', '맞히면 한 번 더 · 틀리면 상대 차례 (한 턴 8초)'],
    scoring: ['짝 하나 +10', '연속으로 맞히면 +5씩 더', '상대가 뒤집은 카드도 기억해두면 유리'],
    desc: '시작할 때 1초 동안 모든 카드를 보여줘요. 잘 기억했다가 번갈아 두 장씩 뒤집어 같은 그림 짝을 찾아요.',
    guide: [{ e: '🂠🂠', t: '두 장 뒤집기', d: '내 차례에 카드 두 장을 뒤집어요. 같은 그림이면 짝! 한 번 더 할 수 있어요.' }, { e: '🧠🔄', t: '틀리면 상대 차례', d: '다르면 다시 덮이고 상대 차례예요. 상대가 뒤집은 카드도 기억해 두면 유리해요.' }],
  },
  {
    id: 'merge', name: '숫자 합치기', en: 'Merge', tagline: '같은 숫자를 합쳐 크게!', kind: '전략·퍼즐', time: '2분', durationMs: 120_000, tint: '#FFF0E6',
    rules: ['스와이프나 방향키로 타일을 밀어요', '같은 숫자가 부딪히면 합쳐져요', '둘 다 같은 순서로 새 타일이 나와요'],
    scoring: ['합쳐서 만든 숫자만큼 점수', '보드가 꽉 차면 끝', '최대 타일도 기록돼요'],
    desc: '타일을 밀어서 같은 숫자끼리 합쳐 더 큰 숫자를 만들어요. 둘 다 같은 순서로 타일이 나와요.',
    guide: [{ e: '👆↔️', t: '스와이프로 밀기', d: '위아래 좌우로 스와이프하면 모든 타일이 그쪽으로 쭉 밀려요.' }, { e: '2️⃣➕2️⃣', t: '같은 숫자 합치기', d: '2와 2가 부딪히면 4가 돼요. 만든 숫자만큼 점수! 판이 꽉 차면 끝나요.' }],
  },
  {
    id: 'suika', name: '수박게임', en: 'Fruit Merge', tagline: '같은 과일 합쳐 수박까지!', kind: '퍼즐', time: '2분', durationMs: 120_000, tint: '#E6F6E1',
    rules: ['각자 자기 과일통에 과일을 떨어뜨려요', '같은 과일끼리 닿으면 한 단계 큰 과일로', '둘 다 같은 순서로 과일이 나와요'],
    scoring: ['큰 과일을 만들수록 점수가 커요', '수박끼리 합치면 +100', '빨간 선 위로 2초 넘게 쌓이면 끝'],
    desc: '체리부터 수박까지! 같은 과일끼리 합쳐서 더 큰 과일을 만들어요. 과일통이 넘치지 않게 조심해요.',
    guide: [{ e: '🍒➡️🍉', t: '떨어뜨려 합치기', d: '좌우로 위치를 정하고 손을 떼면 과일이 떨어져요. 같은 과일끼리 닿으면 합쳐져요.' }, { e: '⚠️📦', t: '넘치면 끝', d: '빨간 점선 위로 과일이 2초 넘게 쌓이면 끝나요. 오른쪽 위에서 상대 통도 볼 수 있어요.' }],
  },
  {
    id: 'omok', name: '오목', en: 'Gomoku', tagline: '다섯 개를 먼저 이어요!', kind: '전략', time: '한 수 20초', durationMs: 0, tint: '#FCEBD2',
    rules: ['흑부터 번갈아 돌을 둬요', '가로·세로·대각선 5개를 먼저 이으면 승리', '한 수 20초 · 시간 초과 3번이면 패배'],
    scoring: ['오목 완성하면 승리', '같은 자리를 두 번 탭하면 착수', '판이 꽉 차면 무승부'],
    desc: '번갈아 흑돌과 백돌을 두면서 가로·세로·대각선으로 5개를 먼저 잇는 사람이 이겨요.',
    guide: [{ e: '⚫⚪', t: '번갈아 두기', d: '흑부터 시작해요. 같은 자리를 두 번 탭하면 돌을 둬요. 첫 탭에 미리보기가 보여요.' }, { e: '⚫⚫⚫⚫⚫', t: '5개를 이으면 승리', d: '가로·세로·대각선 어느 쪽이든 5개를 먼저 이으면 이겨요. 상대 줄도 막아야 해요!' }],
  },
  {
    id: 'balance', name: '밸런스 게임', en: 'This or That', tagline: '너라면 뭐 골라?', kind: '대화', time: '10문제', durationMs: 0, tint: '#F6ECFF',
    rules: ['둘 중 하나를 골라요 · 시간 제한 없음', '둘 다 고르면 서로의 선택이 공개돼요', '얘기 나누고 다음 질문으로'],
    scoring: ['승패 대신 우리 궁합 %', '같은 선택이 많을수록 궁합 UP', '연애·일상·음식·상상 질문'],
    desc: '둘 중 하나를 고르면 서로의 선택이 공개돼요. "왜 그걸 골라?!" 하면서 통화로 수다 떨기 딱 좋아요.',
    guide: [{ e: '🅰️🆚🅱️', t: '하나만 골라요', d: '시간 제한은 없어요. 둘 다 고를 때까지 상대 선택은 안 보여요.' }, { e: '💕🔥', t: '공개하고 수다', d: '같으면 하트, 다르면 불꽃! 왜 골랐는지 얘기하다가 누구든 다음 질문을 누르면 넘어가요.' }],
  },
]
/** 화면에 보이는 순서 (새 게임 3개를 위쪽에) */
const ORDER: GameId[] = ['apple', 'halli', 'draw', 'suika', 'omok', 'balance', 'rush', 'block', 'spot', 'word', 'quiz', 'bomb', 'memory', 'pairs', 'merge']
export const GAMES: GameMeta[] = ORDER.map((id) => ALL_GAMES.find((g) => g.id === id)!).filter(Boolean)
export const META = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameMeta>

