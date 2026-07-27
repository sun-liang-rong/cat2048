export const BOARD_SIZE = 4;
export const MAX_LEVEL = 9;

export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'running' | 'game-over';

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

export interface RandomSource {
  next(): number;
}

export interface TileFactory {
  create(level: number, position: Position): Tile;
}
