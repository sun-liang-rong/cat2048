import { describe, expect, it } from 'vitest';
import { Board } from '../assets/scripts/core/Board';
import { Game2048 } from '../assets/scripts/core/Game2048';
import type { Position, RandomSource, Tile, TileFactory } from '../assets/scripts/core/types';

class FixedRandom implements RandomSource {
  public calls = 0;
  public constructor(private readonly values: number[]) {}
  public next(): number {
    const value = this.values[this.calls++];
    if (value === undefined) throw new Error('Fixed random sequence exhausted.');
    return value;
  }
}

class Factory implements TileFactory {
  private nextId = 1;
  public create(level: number, at: Position): Tile { return { id: `f-${this.nextId++}`, level, ...at }; }
}

const levels = (board: Board) => {
  const output = Array.from({ length: 4 }, () => Array<number>(4).fill(0));
  board.snapshot().tiles.forEach((tile) => { output[tile.row][tile.col] = tile.level; });
  return output;
};

describe('Board movement', () => {
  it('keeps existing tiles when spawning from a Map-backed board', () => {
    const factory = new Factory();
    const board = Board.fromLevels([[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], factory);
    const spawned = board.spawn(1, new FixedRandom([0]), factory);

    expect(spawned?.board.snapshot().tiles.map((tile) => tile.id)).toEqual(['f-1', 'f-2']);
  });

  it.each([
    ['left', [[1, 1, 0, 0]], [2, 0, 0, 0]],
    ['right', [[1, 1, 0, 0]], [0, 0, 0, 2]],
  ] as const)('compresses and merges %s', (direction, row, expected) => {
    const factory = new Factory();
    const board = Board.fromLevels([...row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], factory);
    const result = board.move(direction, factory);
    expect(levels(new Board(result.board))[0]).toEqual(expected);
    expect(result.scoreDelta).toBe(4);
  });

  it.each([
    ['up', [[1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]],
    ['down', [[1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0]]],
  ] as const)('compresses and merges %s', (direction, fixture, expected) => {
    const factory = new Factory();
    const result = Board.fromLevels(fixture, factory).move(direction, factory);
    expect(levels(new Board(result.board))).toEqual(expected);
    expect(result.scoreDelta).toBe(4);
  });

  it('handles three and four tile chains without double-merging', () => {
    const factory = new Factory();
    const three = Board.fromLevels([[1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], factory).move('left', factory);
    expect(levels(new Board(three.board))[0]).toEqual([2, 1, 0, 0]);
    const four = Board.fromLevels([[1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], factory).move('left', factory);
    expect(levels(new Board(four.board))[0]).toEqual([2, 2, 0, 0]);
  });

  it('moves vertically and supports independent merges', () => {
    const factory = new Factory();
    const board = Board.fromLevels([[1, 0, 2, 0], [1, 0, 2, 0], [2, 0, 3, 0], [2, 0, 3, 0]], factory);
    const result = board.move('down', factory);
    expect(levels(new Board(result.board))).toEqual([[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 3, 0], [3, 0, 4, 0]]);
    expect(result.scoreDelta).toBe(4 + 8 + 8 + 16);
  });

  it('merges through level 11 and keeps terminal level 12 tiles', () => {
    const factory = new Factory();
    const advanced = Board.fromLevels([[11, 11, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], factory)
      .move('left', factory);
    expect(levels(new Board(advanced.board))[0]).toEqual([12, 0, 0, 0]);
    expect(advanced.merges).toHaveLength(1);

    const terminal = Board.fromLevels([[12, 12, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], factory)
      .move('left', factory);
    expect(levels(new Board(terminal.board))[0]).toEqual([12, 12, 0, 0]);
    expect(terminal.merges).toHaveLength(0);
  });

  it('validates snapshots, spawn levels, directions, and random values', () => {
    const factory = new Factory();
    expect(() => new Board({ size: 3, tiles: [] })).toThrow('Malformed board snapshot');
    expect(() => new Board({ size: 4, tiles: [
      { id: 'same', level: 1, row: 0, col: 0 },
      { id: 'same', level: 1, row: 0, col: 1 },
    ] })).toThrow('Tile IDs must be unique');
    expect(() => new Board({ size: 4, tiles: [
      { id: 'a', level: 1, row: 0, col: 0 },
      { id: 'b', level: 1, row: 0, col: 0 },
    ] })).toThrow('Multiple tiles occupy');
    const board = new Board();
    expect(() => board.spawn(0, new FixedRandom([0]), factory)).toThrow('Invalid spawn level');
    expect(() => board.spawn(1, new FixedRandom([1]), factory)).toThrow('expected [0, 1)');
    expect(() => board.move('diagonal' as never, factory)).toThrow('Invalid direction');
  });

  it('does not mutate its input snapshot', () => {
    const factory = new Factory();
    const original = { size: 4, tiles: [{ id: 'a', level: 1, row: 0, col: 3 }] } as const;
    const before = JSON.stringify(original);
    new Board(original).move('left', factory);
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe('Game2048', () => {
  it('spawns two deterministic cats and one after an effective move', () => {
    const random = new FixedRandom([0.1, 0, 0.95, 0, 0.2, 0]);
    const game = new Game2048(random);
    const start = game.start();
    expect(start.tiles.map((tile) => tile.level)).toEqual([1, 2]);
    const result = game.move('right');
    expect(result.changed).toBe(true);
    expect(result.spawned?.tile.level).toBe(1);
    expect(random.calls).toBe(6);
  });

  it('does not consume randomness for an ineffective move', () => {
    const random = new FixedRandom([]);
    const game = new Game2048(random);
    game.loadFixture([[1, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const calls = random.calls;
    const result = game.move('left');
    expect(result.changed).toBe(false);
    expect(random.calls).toBe(calls);
  });

  it('detects terminal and playable full boards', () => {
    const game = new Game2048(new FixedRandom([]));
    game.loadFixture([
      [1, 2, 1, 2], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 1],
    ]);
    expect(game.status).toBe('game-over');
    game.loadFixture([
      [1, 1, 2, 1], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 1],
    ]);
    expect(game.status).toBe('running');
  });

  it('resets score and identifiers when starting a new game', () => {
    const game = new Game2048(new FixedRandom([0, 0, 0, 0, 0, 0, 0, 0]));
    game.loadFixture([[1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 99);
    game.start();
    expect(game.score).toBe(0);
    expect(game.board.tiles.map((tile) => tile.id)).toEqual(['tile-1', 'tile-2']);
  });

  it('undoes the latest effective move once and restores its score', () => {
    const game = new Game2048(new FixedRandom([0.95, 0]));
    const before = game.loadFixture([
      [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ], 12);

    const moved = game.move('left');
    expect(moved.changed).toBe(true);
    expect(game.items.canUse('undo')).toBe(true);
    expect(game.items.canUseMore).toBe(true);

    const undone = game.undo();
    expect(undone.changed).toBe(true);
    expect(undone.board).toEqual(before);
    expect(undone.score).toBe(12);
    expect(game.items.canUse('undo')).toBe(true);
    expect(game.items.canUseMore).toBe(true);
    expect(game.undo().changed).toBe(false);
  });

  it('keeps undo history after an ineffective move', () => {
    const game = new Game2048(new FixedRandom([0.95, 0]));
    const before = game.loadFixture([
      [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);

    expect(game.move('left').changed).toBe(true);
    expect(game.move('left').changed).toBe(false);
    expect(game.undo().board).toEqual(before);
  });

  it('undoes only the most recent of two effective moves', () => {
    const game = new Game2048(new FixedRandom([0.95, 0, 0.95, 0]));
    game.loadFixture([
      [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    game.move('left');
    const beforeSecondMove = game.board;
    game.move('right');

    expect(game.undo().board).toEqual(beforeSecondMove);
  });

  it('erases a single tile at a specified position', () => {
    const game = new Game2048(new FixedRandom([]));
    game.loadFixture([
      [2, 1, 0, 1], [1, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ], 24);
    const target = game.board.tiles.find((tile) => tile.level === 1)!;

    const result = game.erase({ row: target.row, col: target.col });
    expect(result.changed).toBe(true);
    expect(result.removedTileId).toBe(target.id);
    expect(result.board.tiles).toHaveLength(4);
    expect(result.score).toBe(24);
    expect(game.items.canUse('erase')).toBe(true);
    expect(game.items.canUseMore).toBe(true);
  });

  it('does not erase on an empty board', () => {
    const game = new Game2048(new FixedRandom([]));
    game.loadFixture([
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    expect(game.erase({ row: 0, col: 0 }).changed).toBe(false);
    expect(game.items.canUse('erase')).toBe(true);
  });

  it('spawns a new cat on a random empty cell', () => {
    const game = new Game2048(new FixedRandom([0.5, 0.9]));
    game.loadFixture([
      [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    const result = game.spawn();
    expect(result.changed).toBe(true);
    expect(result.board.tiles).toHaveLength(2);
    expect(result.spawned).toBeDefined();
    expect(game.items.canUse('spawn')).toBe(false);
  });

  it('shuffles all tiles randomly', () => {
    const game = new Game2048(new FixedRandom([0.1, 0.2, 0.3]));
    game.loadFixture([
      [1, 2, 0, 0], [3, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    const levelsBefore = game.board.tiles.map((tile) => tile.level).sort();
    const result = game.shuffle();
    expect(result.changed).toBe(true);
    const levelsAfter = result.board.tiles.map((tile) => tile.level).sort();
    expect(levelsAfter).toEqual(levelsBefore);
    expect(game.items.canUse('shuffle')).toBe(false);
  });

  it('keeps undo and erase available after the legacy total item limit', () => {
    const game = new Game2048(new FixedRandom([0.5, 0.9, 0.5, 0.9]));
    game.loadFixture([
      [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    game.move('left');
    expect(game.undo().changed).toBe(true);
    expect(game.items.canUseMore).toBe(true);
    expect(game.spawn().changed).toBe(true);
    expect(game.items.canUseMore).toBe(true);
    expect(game.items.canUse('shuffle')).toBe(false);
    expect(game.items.canUse('erase')).toBe(true);
  });

  it('resets items on a new game', () => {
    const game = new Game2048(new FixedRandom([0, 0, 0, 0, 0, 0]));
    game.loadFixture([
      [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ]);
    game.move('left');
    game.undo();
    expect(game.items.canUse('undo')).toBe(true);

    game.start();
    expect(game.items.canUse('undo')).toBe(true);
    expect(game.items.canUseMore).toBe(true);
    expect(game.items.usedKinds).toEqual([]);
  });

  it.each([[-0.1], [1], [Number.NaN]])('rejects an invalid level random value: %s', (value) => {
    const game = new Game2048(new FixedRandom([value]));
    expect(() => game.start()).toThrow('expected [0, 1)');
  });

  it('exports and restores full run state including item usage', () => {
    const game = new Game2048(new FixedRandom([0.95, 0, 0.95, 0]));
    game.loadFixture([
      [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ], 12);
    game.move('left');
    game.undo();
    const state = game.exportState();
    expect(state.score).toBe(12);
    expect(state.usedItemKinds).toEqual(['undo']);

    const restored = new Game2048(new FixedRandom([0.95, 0]));
    restored.restore(state);
    expect(restored.board).toEqual(game.board);
    expect(restored.score).toBe(12);
    expect(restored.items.canUse('undo')).toBe(true);
    expect(restored.reviveState.remaining).toBe(1);

    const moved = restored.move('right');
    expect(moved.changed).toBe(true);
    const ids = restored.board.tiles.map((tile) => tile.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can roll back an item operation without losing undo history', () => {
    const game = new Game2048(new FixedRandom([0.95, 0, 0.95, 0]));
    const before = game.loadFixture([
      [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ], 12);
    game.move('left');
    const rollback = game.captureRollbackState();

    expect(game.undo().changed).toBe(true);
    game.restoreRollbackState(rollback);

    expect(game.board).toEqual(rollback.board);
    expect(game.score).toBe(rollback.score);
    expect(game.items.canUse('undo')).toBe(true);
    expect(game.undo().board).toEqual(before);
  });
});
