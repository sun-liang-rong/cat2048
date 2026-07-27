import { Board } from './Board';
import {
  BOARD_SIZE,
  type BoardSnapshot,
  type Direction,
  type GameStatus,
  type MoveResult,
  type Position,
  type RandomSource,
  type Tile,
  type TileFactory,
} from './types';

export class Game2048 implements TileFactory {
  private boardValue = new Board();
  private scoreValue = 0;
  private nextId = 1;

  public constructor(private readonly random: RandomSource) {}

  public get board(): BoardSnapshot { return this.boardValue.snapshot(); }
  public get score(): number { return this.scoreValue; }
  public get status(): GameStatus { return this.boardValue.hasLegalMove() ? 'running' : 'game-over'; }

  public start(): BoardSnapshot {
    this.boardValue = new Board();
    this.scoreValue = 0;
    this.nextId = 1;
    this.spawnRandomTile();
    this.spawnRandomTile();
    return this.board;
  }

  public move(direction: Direction): MoveResult {
    const moved = this.boardValue.move(direction, this);
    if (!moved.changed) {
      return { ...moved, score: this.scoreValue, status: this.status };
    }

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
    this.boardValue = Board.fromLevels(levels, this);
    return this.board;
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
