export type GameId = 'apple' | 'halli' | 'draw' | 'rush' | 'block' | 'spot' | 'word' | 'quiz' | 'bomb' | 'memory' | 'pairs' | 'merge'

export interface GameResultData {
  scores: Record<string, number>
  /** 플레이어별 통계 (라벨 → 값) */
  stats: Record<string, Record<string, number>>
}

/**
 * 게임 엔진: 순수 함수. 방장(호스트) 클라이언트가 권한자로 실행하고,
 * predict=true면 게스트도 자기 입력을 미리 적용(낙관적 업데이트) 후 호스트 상태로 보정한다.
 * t = 게임 시작 후 경과 ms (일시정지 시간 제외)
 */
export interface Engine<S = any, A = any> {
  id: GameId
  predict?: boolean
  init(seed: number, players: string[]): S
  apply(s: S, pid: string, a: A, t: number): S | null
  tick?(s: S, t: number): S | null
  /** 상단 타이머에 보일 남은 ms (null이면 숨김). 없으면 게임 전체 시간 기준 */
  timer?(s: S, t: number): number | null
  isOver(s: S, t: number): boolean
  result(s: S): GameResultData
  /** 결과 화면 통계 라벨 */
  statLabels: Record<string, string>
}

export const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))
