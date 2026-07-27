import {
  BOARD_SIZE,
  MAX_LEVEL,
  type BoardMoveResult,
  type BoardSnapshot,
  type Direction,
  type MergeRecord,
  type MotionRecord,
  type Position,
  type RandomSource,
  type Tile,
  type TileFactory,
} from './types';

interface Group {
  sources: Tile[];
  level: number;
}

const keyOf = ({ row, col }: Position): string => `${row}:${col}`;
const copyPosition = ({ row, col }: Position): Position => ({ row, col });
const copyTile = (tile: Tile): Tile => ({ ...tile });

export class Board {
  private readonly byCell: ReadonlyMap<string, Tile>;

  public constructor(snapshot: BoardSnapshot = { size: BOARD_SIZE, tiles: [] }) {
    Board.validateSnapshot(snapshot);
    this.byCell = new Map(snapshot.tiles.map((tile) => [keyOf(tile), copyTile(tile)]));
  }

  public static fromLevels(levels: readonly (readonly number[])[], factory: TileFactory): Board {
    if (levels.length !== BOARD_SIZE || levels.some((row) => row.length !== BOARD_SIZE)) {
      throw new Error(`Fixture board must be ${BOARD_SIZE}x${BOARD_SIZE}.`);
    }
    const tiles: Tile[] = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const level = levels[row][col];
        if (level > 0) tiles.push(factory.create(level, { row, col }));
      }
    }
    return new Board({ size: BOARD_SIZE, tiles });
  }

  public snapshot(): BoardSnapshot {
    return {
      size: BOARD_SIZE,
      tiles: [...this.byCell.values()]
        .map(copyTile)
        .sort((a, b) => a.row - b.row || a.col - b.col),
    };
  }

  public tileAt(position: Position): Tile | undefined {
    const tile = this.byCell.get(keyOf(position));
    return tile ? copyTile(tile) : undefined;
  }

  public emptyCells(): Position[] {
    const cells: Position[] = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (!this.byCell.has(keyOf({ row, col }))) cells.push({ row, col });
      }
    }
    return cells;
  }

  public spawn(level: number, random: RandomSource, factory: TileFactory): { board: Board; tile: Tile } | undefined {
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
      throw new Error(`Invalid spawn level: ${level}`);
    }
    const empty = this.emptyCells();
    if (empty.length === 0) return undefined;
    const roll = random.next();
    Board.validateRandom(roll);
    const position = empty[Math.min(empty.length - 1, Math.floor(roll * empty.length))];
    const tile = factory.create(level, position);
    return { board: new Board({ size: BOARD_SIZE, tiles: [...this.byCell.values(), tile] }), tile: copyTile(tile) };
  }

  public move(direction: Direction, factory: TileFactory): BoardMoveResult {
    Board.validateDirection(direction);
    const resultTiles: Tile[] = [];
    const motions: MotionRecord[] = [];
    const merges: MergeRecord[] = [];
    let changed = false;
    let scoreDelta = 0;

    for (let line = 0; line < BOARD_SIZE; line += 1) {
      const coordinates = this.lineCoordinates(direction, line);
      const gathered = coordinates
        .map((position) => this.byCell.get(keyOf(position)))
        .filter((tile): tile is Tile => tile !== undefined);
      const groups: Group[] = [];

      for (const tile of gathered) {
        const previous = groups.at(-1);
        if (previous && previous.sources.length === 1 && previous.level === tile.level && tile.level < MAX_LEVEL) {
          previous.sources.push(tile);
          previous.level += 1;
        } else {
          groups.push({ sources: [tile], level: tile.level });
        }
      }

      groups.forEach((group, index) => {
        const destination = coordinates[index];
        const merged = group.sources.length === 2;
        const resultTile = merged
          ? factory.create(group.level, destination)
          : { ...group.sources[0], ...destination };
        resultTiles.push(resultTile);

        for (const source of group.sources) {
          const moved = source.row !== destination.row || source.col !== destination.col;
          changed ||= moved || merged;
          motions.push({
            tileId: source.id,
            from: { row: source.row, col: source.col },
            to: copyPosition(destination),
            ...(merged ? { mergedInto: resultTile.id } : {}),
          });
        }

        if (merged) {
          const score = 2 ** group.level;
          scoreDelta += score;
          merges.push({
            sourceIds: [group.sources[0].id, group.sources[1].id],
            resultId: resultTile.id,
            level: group.level,
            at: copyPosition(destination),
            score,
          });
        }
      });
    }

    if (!changed) {
      return { changed: false, board: this.snapshot(), motions: [], merges: [], scoreDelta: 0 };
    }
    const board = new Board({ size: BOARD_SIZE, tiles: resultTiles });
    return { changed: true, board: board.snapshot(), motions, merges, scoreDelta };
  }

  public hasLegalMove(): boolean {
    if (this.byCell.size < BOARD_SIZE * BOARD_SIZE) return true;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const tile = this.byCell.get(keyOf({ row, col }));
        if (!tile) continue;
        const right = col + 1 < BOARD_SIZE ? this.byCell.get(keyOf({ row, col: col + 1 })) : undefined;
        const down = row + 1 < BOARD_SIZE ? this.byCell.get(keyOf({ row: row + 1, col })) : undefined;
        if ((right && right.level === tile.level && tile.level < MAX_LEVEL)
          || (down && down.level === tile.level && tile.level < MAX_LEVEL)) return true;
      }
    }
    return false;
  }

  private lineCoordinates(direction: Direction, line: number): Position[] {
    const indexes = [0, 1, 2, 3];
    switch (direction) {
      case 'left': return indexes.map((col) => ({ row: line, col }));
      case 'right': return indexes.map((offset) => ({ row: line, col: BOARD_SIZE - 1 - offset }));
      case 'up': return indexes.map((row) => ({ row, col: line }));
      case 'down': return indexes.map((offset) => ({ row: BOARD_SIZE - 1 - offset, col: line }));
    }
  }

  private static validateDirection(direction: string): asserts direction is Direction {
    if (!['up', 'down', 'left', 'right'].includes(direction)) throw new Error(`Invalid direction: ${direction}`);
  }

  private static validateRandom(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error(`Random source returned ${value}; expected [0, 1).`);
  }

  private static validateSnapshot(snapshot: BoardSnapshot): void {
    if (snapshot.size !== BOARD_SIZE || !Array.isArray(snapshot.tiles)) throw new Error('Malformed board snapshot.');
    const ids = new Set<string>();
    const cells = new Set<string>();
    for (const tile of snapshot.tiles) {
      if (!tile || typeof tile.id !== 'string' || ids.has(tile.id)) throw new Error('Tile IDs must be unique strings.');
      if (!Number.isInteger(tile.level) || tile.level < 1 || tile.level > MAX_LEVEL) throw new Error(`Invalid tile level: ${tile.level}`);
      if (!Number.isInteger(tile.row) || !Number.isInteger(tile.col)
        || tile.row < 0 || tile.row >= BOARD_SIZE || tile.col < 0 || tile.col >= BOARD_SIZE) throw new Error('Tile is outside the board.');
      const cell = keyOf(tile);
      if (cells.has(cell)) throw new Error(`Multiple tiles occupy ${cell}.`);
      ids.add(tile.id);
      cells.add(cell);
    }
  }
}
