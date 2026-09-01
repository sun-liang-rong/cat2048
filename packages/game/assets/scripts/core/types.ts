export const BOARD_SIZE = 4;
export const MAX_LEVEL = 12;

export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'running' | 'game-over';
export type ItemKind = 'undo' | 'spawn' | 'shuffle' | 'erase';

export interface Position {
  readonly row: number;
  readonly col: number;
}

export interface Tile extends Position {
  readonly id: string;
  readonly level: number;
}

export interface BoardSnapshot {
  readonly size: number;
  readonly tiles: readonly Tile[];
}

export interface MotionRecord {
  readonly tileId: string;
  readonly from: Position;
  readonly to: Position;
  readonly mergedInto?: string;
}

export interface MergeRecord {
  readonly sourceIds: readonly [string, string];
  readonly resultId: string;
  readonly level: number;
  readonly at: Position;
  readonly score: number;
}

export interface SpawnRecord {
  readonly tile: Tile;
}

export interface BoardMoveResult {
  readonly changed: boolean;
  readonly board: BoardSnapshot;
  readonly motions: readonly MotionRecord[];
  readonly merges: readonly MergeRecord[];
  readonly scoreDelta: number;
}

export interface MoveResult extends BoardMoveResult {
  readonly spawned?: SpawnRecord;
  readonly score: number;
  readonly status: GameStatus;
}

export interface ItemState {
  /** 本局已使用的道具种类 */
  readonly usedKinds: readonly ItemKind[];
  /** 本局是否还有任一道具允许使用 */
  readonly canUseMore: boolean;
  /** 检查指定道具本局是否可用 */
  canUse(kind: ItemKind): boolean;
}

export interface ReviveState {
  readonly remaining: 0 | 1;
  readonly canRevive: boolean;
}

export interface UndoResult {
  readonly changed: boolean;
  readonly board: BoardSnapshot;
  readonly score: number;
  readonly status: GameStatus;
}

export interface RemoveTilesResult extends UndoResult {
  readonly removedTileIds: readonly string[];
}

export interface SpawnResult {
  readonly changed: boolean;
  readonly board: BoardSnapshot;
  readonly score: number;
  readonly status: GameStatus;
  readonly spawned?: SpawnRecord;
}

export interface ShuffleResult {
  readonly changed: boolean;
  readonly board: BoardSnapshot;
  readonly score: number;
  readonly status: GameStatus;
}

export interface EraseResult {
  readonly changed: boolean;
  readonly removedTileId: string | undefined;
  readonly board: BoardSnapshot;
  readonly score: number;
  readonly status: GameStatus;
}

export interface ReviveResult extends RemoveTilesResult {
  readonly revived: boolean;
}

/** 一局游戏的可持久化完整状态（不含 runId 等会话元信息）。 */
export interface GameRunState {
  readonly board: BoardSnapshot;
  readonly score: number;
  readonly nextTileId: number;
  /** 本局已使用的道具种类 */
  readonly usedItemKinds: readonly ItemKind[];
  readonly reviveRemaining: 0 | 1;
}

export interface RandomSource {
  next(): number;
}

export interface TileFactory {
  create(level: number, position: Position): Tile;
}
