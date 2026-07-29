import { Board } from './Board';
import {
  BOARD_SIZE,
  type BoardSnapshot,
  type Direction,
  type GameStatus,
  type ItemState,
  type MoveResult,
  type Position,
  type RandomSource,
  type RemoveTilesResult,
  type Tile,
  type TileFactory,
  type UndoResult,
} from './types';

interface UndoSnapshot {
  readonly board: BoardSnapshot;
  readonly score: number;
}

export class Game2048 implements TileFactory {
  private boardValue = new Board();
  private scoreValue = 0;
  private nextId = 1;
  private undoSnapshot: UndoSnapshot | undefined;
  private undoRemainingValue = 1;
  private removeLowestRemainingValue = 1;

  public constructor(private readonly random: RandomSource) {}

  public get board(): BoardSnapshot { return this.boardValue.snapshot(); }
  public get score(): number { return this.scoreValue; }
  public get status(): GameStatus { return this.boardValue.hasLegalMove() ? 'running' : 'game-over'; }
  public get items(): ItemState {
    return {
      undoRemaining: this.undoRemainingValue,
      removeLowestRemaining: this.removeLowestRemainingValue,
      canUndo: this.undoRemainingValue > 0 && this.undoSnapshot !== undefined,
      canRemoveLowest: this.removeLowestRemainingValue > 0 && this.boardValue.snapshot().tiles.length > 0,
    };
  }

  public start(): BoardSnapshot {
    this.boardValue = new Board();
    this.scoreValue = 0;
    this.nextId = 1;
    this.undoSnapshot = undefined;
    this.undoRemainingValue = 1;
    this.removeLowestRemainingValue = 1;
    this.spawnRandomTile();
    this.spawnRandomTile();
    return this.board;
  }

  public move(direction: Direction): MoveResult {
    const beforeMove: UndoSnapshot = { board: this.board, score: this.scoreValue };
    const moved = this.boardValue.move(direction, this);
    if (!moved.changed) {
      return { ...moved, score: this.scoreValue, status: this.status };
    }

    this.undoSnapshot = beforeMove;
    this.boardValue = new Board(moved.board);
    this.scoreValue += moved.scoreDelta;
    const spawned = this.spawnRandomTile();
    return {
      ...moved,
      board: this.board,
      score: this.scoreValue,
      status: this.status,
      ...(spawned ? { spawned: { tile: spawned } } : {}),
    };
  }

  public loadFixture(levels: readonly (readonly number[])[], score = 0): BoardSnapshot {
    this.nextId = 1;
    this.scoreValue = score;
    this.undoSnapshot = undefined;
    this.undoRemainingValue = 1;
    this.removeLowestRemainingValue = 1;
    this.boardValue = Board.fromLevels(levels, this);
    return this.board;
  }

  public undo(): UndoResult {
    if (this.undoRemainingValue === 0 || !this.undoSnapshot) {
      return { changed: false, board: this.board, score: this.scoreValue, status: this.status };
    }
    const snapshot = this.undoSnapshot;
    this.boardValue = new Board(snapshot.board);
    this.scoreValue = snapshot.score;
    this.undoSnapshot = undefined;
    this.undoRemainingValue = 0;
    return { changed: true, board: this.board, score: this.scoreValue, status: this.status };
  }

  public removeLowestTiles(count: number): RemoveTilesResult {
    if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid removal count: ${count}`);
    const tiles = [...this.board.tiles];
    if (this.removeLowestRemainingValue === 0 || tiles.length === 0) {
      return { changed: false, removedTileIds: [], board: this.board, score: this.scoreValue, status: this.status };
    }
    tiles.sort((a, b) => a.level - b.level || a.row - b.row || a.col - b.col);
    const removedTileIds = tiles.slice(0, count).map((tile) => tile.id);
    const removed = new Set(removedTileIds);
    this.boardValue = new Board({ size: BOARD_SIZE, tiles: this.board.tiles.filter((tile) => !removed.has(tile.id)) });
    this.undoSnapshot = undefined;
    this.removeLowestRemainingValue = 0;
    return { changed: true, removedTileIds, board: this.board, score: this.scoreValue, status: this.status };
  }

  public create(level: number, position: Position): Tile {
    return { id: `tile-${this.nextId++}`, level, row: position.row, col: position.col };
  }

  private spawnRandomTile(): Tile | undefined {
    if (this.boardValue.emptyCells().length === 0) return undefined;
    const levelRoll = this.random.next();
    if (!Number.isFinite(levelRoll) || levelRoll < 0 || levelRoll >= 1) {
      throw new Error(`Random source returned ${levelRoll}; expected [0, 1).`);
    }
    const level = levelRoll < 0.9 ? 1 : 2;
    const spawned = this.boardValue.spawn(level, this.random, this);
    if (!spawned) return undefined;
    this.boardValue = spawned.board;
    return spawned.tile;
  }
}

export const emptyFixture = (): number[][] => Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE).fill(0));
