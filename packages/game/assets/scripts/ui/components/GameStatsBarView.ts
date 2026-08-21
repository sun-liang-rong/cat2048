import { Color, Node, Rect, SpriteFrame } from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';

export interface GameStats {
  readonly moves: number;
  readonly merges: number;
  readonly spaces: number;
}

type StatKind = keyof GameStats;

const BAR_WIDTH = 620;
const BAR_HEIGHT = 62;
const STAT_WIDTH = 188;
const ICON_SIZE = 44;
const SHEET_CELL_SIZE = 256;
const STAT_COLUMNS: readonly {
  kind: StatKind;
  title: string;
  x: number;
  fallback: string;
  cell: number;
}[] = [
  { kind: 'moves', title: '步数', x: -205, fallback: '步', cell: 0 },
  { kind: 'merges', title: '合成', x: 0, fallback: '合', cell: 1 },
  { kind: 'spaces', title: '空位', x: 205, fallback: '空', cell: 2 },
];

export class GameStatsBarView {
  private readonly values = new Map<StatKind, ReturnType<typeof createLabel>>();
  private root: Node | null = null;

  public constructor(private readonly art: ArtRepository) {}

  public mount(parent: Node, y: number, stats: GameStats): void {
    this.clear();
    const bar = createUiNode('GameStatsBar', BAR_WIDTH, BAR_HEIGHT);
    bar.setPosition(0, y);

    for (const column of STAT_COLUMNS) {
      const stat = createUiNode(`GameStatsBar:${column.kind}`, STAT_WIDTH, BAR_HEIGHT - 4);
      drawRounded(stat, STAT_WIDTH, BAR_HEIGHT - 4, new Color(255, 248, 228, 225), 20,
        { color: new Color(139, 91, 59, 85), width: 1 });
      stat.setPosition(column.x, 0);
      bar.addChild(stat);

      const icon = this.createIcon(column.cell, column.fallback);
      icon.setPosition(-55, 0);
      stat.addChild(icon);

      const title = createLabel(column.title, 15, new Color(117, 76, 52, 235), 82, 22);
      title.node.setPosition(24, 13);
      stat.addChild(title.node);

      const value = createLabel('0', 24, column.kind === 'spaces' ? COLORS.teal : COLORS.ink,
        82, 30, 'display', 'number');
      value.node.setPosition(24, -11);
      stat.addChild(value.node);
      this.values.set(column.kind, value);
    }

    parent.addChild(bar);
    this.root = bar;
    this.refresh(stats);
  }

  public refresh(stats: GameStats): void {
    for (const column of STAT_COLUMNS) {
      const value = Math.max(0, Math.floor(stats[column.kind]));
      const label = this.values.get(column.kind);
      if (label) label.string = String(value);
    }
  }

  public clear(): void {
    this.root?.destroy();
    this.root = null;
    this.values.clear();
  }

  private createIcon(cell: number, fallback: string): Node {
    const sheet = this.art.frame(GAME_CONFIG.art.gameplayStatsSheet);
    if (sheet?.texture) {
      const frame = new SpriteFrame();
      frame.texture = sheet.texture;
      frame.rect = new Rect(cell * SHEET_CELL_SIZE, 0, SHEET_CELL_SIZE, SHEET_CELL_SIZE);
      return createSpriteNode(`GameStatsBar:Icon:${cell}`, frame, ICON_SIZE, ICON_SIZE);
    }
    const node = createUiNode(`GameStatsBar:IconFallback:${cell}`, ICON_SIZE, ICON_SIZE);
    drawRounded(node, ICON_SIZE, ICON_SIZE, COLORS.teal, ICON_SIZE / 2);
    node.addChild(createLabel(fallback, 22, COLORS.white, 42, 40, 'display').node);
    return node;
  }
}
