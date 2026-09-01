import { Board } from './Board';
import {
  ITEM_PER_GAME_MAX,
  REVIVE_REMOVE_COUNT,
  rollSpawnLevel,
} from './config';
import {
  BOARD_SIZE,
  type BoardSnapshot,
  type Direction,
  type EraseResult,
  type GameRunState,
  type GameStatus,
  type ItemKind,
  type ItemState,
  type MoveResult,
  type Position,
  type RandomSource,
  type RemoveTilesResult,
  type ReviveResult,
  type ReviveState,
  type ShuffleResult,
  type SpawnResult,
  type Tile,
  type TileFactory,
  type UndoResult,
} from './types';

interface UndoSnapshot {
  readonly board: BoardSnapshot;
  readonly score: number;
}

/**
 * 仅供对局流程在外部副作用失败时回滚的完整内存状态。
 * 不用于持久化，避免把撤回历史扩大到存档协议中。
 */
export interface GameRollbackState {
  readonly board: BoardSnapshot;
  readonly score: number;
  readonly nextTileId: number;
  readonly undoSnapshot?: {
    readonly board: BoardSnapshot;
    readonly score: number;
  };
  readonly usedItemKinds: readonly ItemKind[];
  readonly reviveRemaining: 0 | 1;
}

export class Game2048 implements TileFactory {
  private boardValue = new Board();
  private scoreValue = 0;
  private nextId = 1;
  private undoSnapshot: UndoSnapshot | undefined;
  private usedItemKindsValue = new Set<ItemKind>();
  private reviveRemainingValue: 0 | 1 = 1;

  public constructor(private readonly random: RandomSource) {}

  public get board(): BoardSnapshot { return this.boardValue.snapshot(); }
  public get score(): number { return this.scoreValue; }
  public get status(): GameStatus { return this.boardValue.hasLegalMove() ? 'running' : 'game-over'; }
  public get items(): ItemState {
    const usedKinds = [...this.usedItemKindsValue];
    return {
      usedKinds,
      // 撤回/消除可在同一局中重复使用；其它历史道具仍保留原有局内上限。
      canUseMore: this.usedItemKindsValue.size < ITEM_PER_GAME_MAX
        || this.canUseItem('undo') || this.canUseItem('erase'),
      canUse: (kind: ItemKind) => this.canUseItem(kind),
    };
  }
  public get reviveState(): ReviveState {
    return {
      remaining: this.reviveRemainingValue,
      canRevive: this.reviveRemainingValue > 0 && this.status === 'game-over',
    };
  }

  /** 捕获可回滚的内存状态，不包含对局会话元信息。 */
  public captureRollbackState(): GameRollbackState {
    return {
      board: this.board,
      score: this.scoreValue,
      nextTileId: this.nextId,
      ...(this.undoSnapshot ? {
        undoSnapshot: {
          board: this.undoSnapshot.board,
          score: this.undoSnapshot.score,
        },
      } : {}),
      usedItemKinds: [...this.usedItemKindsValue],
      reviveRemaining: this.reviveRemainingValue,
    };
  }

  /** 恢复 captureRollbackState 捕获的状态。 */
  public restoreRollbackState(state: GameRollbackState): void {
    this.boardValue = new Board(state.board);
    this.scoreValue = state.score;
    this.nextId = state.nextTileId;
    this.undoSnapshot = state.undoSnapshot ? {
      board: new Board(state.undoSnapshot.board).snapshot(),
      score: state.undoSnapshot.score,
    } : undefined;
    this.usedItemKindsValue = new Set(state.usedItemKinds);
    this.reviveRemainingValue = state.reviveRemaining;
  }

  /** 检查指定道具本局是否可用（不检查库存，仅检查局内限制） */
  public canUseItem(kind: ItemKind): boolean {
    if (kind === 'undo' || kind === 'erase') return true;
    // 已经使用过这种道具
    if (this.usedItemKindsValue.has(kind)) return false;
    // 总使用次数已达上限
    if (this.usedItemKindsValue.size >= ITEM_PER_GAME_MAX) return false;
    return true;
  }

  public start(): BoardSnapshot {
    this.boardValue = new Board();
    this.scoreValue = 0;
    this.nextId = 1;
    this.undoSnapshot = undefined;
    this.usedItemKindsValue = new Set();
    this.reviveRemainingValue = 1;
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
    this.usedItemKindsValue = new Set();
    this.reviveRemainingValue = 1;
    this.boardValue = Board.fromLevels(levels, this);
    return this.board;
  }

  public undo(): UndoResult {
    if (!this.canUseItem('undo') || !this.undoSnapshot) {
      return { changed: false, board: this.board, score: this.scoreValue, status: this.status };
    }
    const snapshot = this.undoSnapshot;
    this.boardValue = new Board(snapshot.board);
    this.scoreValue = snapshot.score;
    this.undoSnapshot = undefined;
    this.usedItemKindsValue.add('undo');
    return { changed: true, board: this.board, score: this.scoreValue, status: this.status };
  }

  /** 使用刷新道具：在随机空格生成 Lv1 或 Lv2 猫咪 */
  public spawn(): SpawnResult {
    if (!this.canUseItem('spawn')) {
      return { changed: false, board: this.board, score: this.scoreValue, status: this.status };
    }
    if (this.boardValue.emptyCells().length === 0) {
      return { changed: false, board: this.board, score: this.scoreValue, status: this.status };
    }
    const levelRoll = this.random.next();
    if (!Number.isFinite(levelRoll) || levelRoll < 0 || levelRoll >= 1) {
      throw new Error(`Random source returned ${levelRoll}; expected [0, 1).`);
    }
    const level = rollSpawnLevel(levelRoll);
    const spawned = this.boardValue.spawn(level, this.random, this);
    if (!spawned) {
      return { changed: false, board: this.board, score: this.scoreValue, status: this.status };
    }
    this.boardValue = spawned.board;
    this.undoSnapshot = undefined;
    this.usedItemKindsValue.add('spawn');
    return {
      changed: true,
      board: this.board,
      score: this.scoreValue,
      status: this.status,
      spawned: { tile: spawned.tile },
    };
  }

  /** 使用洗牌道具：随机打乱棋盘上所有猫咪的位置 */
  public shuffle(): ShuffleResult {
    if (!this.canUseItem('shuffle')) {
      return { changed: false, board: this.board, score: this.scoreValue, status: this.status };
    }
    const tiles = [...this.board.tiles];
    if (tiles.length <= 1) {
      return { changed: false, board: this.board, score: this.scoreValue, status: this.status };
    }
    // Fisher-Yates 洗牌
    const positions = tiles.map((tile) => ({ row: tile.row, col: tile.col }));
    for (let i = positions.length - 1; i > 0; i -= 1) {
      const roll = this.random.next();
      const j = Math.min(i, Math.floor(roll * (i + 1)));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const shuffledTiles: Tile[] = tiles.map((tile, index) => ({
      ...tile,
      row: positions[index].row,
      col: positions[index].col,
    }));
    this.boardValue = new Board({ size: BOARD_SIZE, tiles: shuffledTiles });
    this.undoSnapshot = undefined;
    this.usedItemKindsValue.add('shuffle');
    return { changed: true, board: this.board, score: this.scoreValue, status: this.status };
  }

  /** 使用消除道具：移除指定位置的猫咪 */
  public erase(position: Position): EraseResult {
    if (!this.canUseItem('erase')) {
      return { changed: false, removedTileId: undefined, board: this.board, score: this.scoreValue, status: this.status };
    }
    const tile = this.boardValue.tileAt(position);
    if (!tile) {
      return { changed: false, removedTileId: undefined, board: this.board, score: this.scoreValue, status: this.status };
    }
    this.boardValue = new Board({
      size: BOARD_SIZE,
      tiles: this.board.tiles.filter((t) => t.id !== tile.id),
    });
    this.undoSnapshot = undefined;
    this.usedItemKindsValue.add('erase');
    return { changed: true, removedTileId: tile.id, board: this.board, score: this.scoreValue, status: this.status };
  }

  public revive(): ReviveResult {
    if (!this.reviveState.canRevive) {
      return {
        changed: false,
        revived: false,
        removedTileIds: [],
        board: this.board,
        score: this.scoreValue,
        status: this.status,
      };
    }
    const removedTileIds = this.lowestTileIds([...this.board.tiles], REVIVE_REMOVE_COUNT);
    const removed = new Set(removedTileIds);
    this.boardValue = new Board({
      size: BOARD_SIZE,
      tiles: this.board.tiles.filter((tile) => !removed.has(tile.id)),
    });
    this.undoSnapshot = undefined;
    this.reviveRemainingValue = 0;
    return {
      changed: removedTileIds.length > 0,
      revived: true,
      removedTileIds,
      board: this.board,
      score: this.scoreValue,
      status: this.status,
    };
  }

  public exportState(): GameRunState {
    return {
      board: this.board,
      score: this.scoreValue,
      nextTileId: this.nextId,
      usedItemKinds: [...this.usedItemKindsValue],
      reviveRemaining: this.reviveRemainingValue,
    };
  }

  public restore(state: GameRunState): void {
    this.boardValue = new Board(state.board);
    this.scoreValue = state.score;
    this.nextId = state.nextTileId;
    this.undoSnapshot = undefined;
    this.usedItemKindsValue = new Set(state.usedItemKinds ?? []);
    this.reviveRemainingValue = state.reviveRemaining === 0 ? 0 : 1;
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
    const level = rollSpawnLevel(levelRoll);
    const spawned = this.boardValue.spawn(level, this.random, this);
    if (!spawned) return undefined;
    this.boardValue = spawned.board;
    return spawned.tile;
  }

  private lowestTileIds(tiles: Tile[], count: number): string[] {
    tiles.sort((a, b) => a.level - b.level || a.row - b.row || a.col - b.col);
    return tiles.slice(0, count).map((tile) => tile.id);
  }

  /** 标记道具已使用（供外部在库存扣减成功后调用，用于复活等不经过 useXxx 方法的场景） */
  public markItemUsed(kind: ItemKind): void {
    this.usedItemKindsValue.add(kind);
  }
}

export const emptyFixture = (): number[][] => Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE).fill(0));
