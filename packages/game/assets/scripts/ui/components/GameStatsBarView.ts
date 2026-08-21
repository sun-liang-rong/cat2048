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
const BAR_HEIGHT = 72;
const ICON_SIZE = 52;
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
    drawRounded(bar, BAR_WIDTH, BAR_HEIGHT, new Color(247, 224, 181, 244), 28,
      { color: new Color(154, 99, 63, 210), width: 3 });
    bar.setPosition(0, y);

    const highlight = createUiNode('GameStatsBar:Highlight', BAR_WIDTH - 26, 3);
    drawRounded(highlight, BAR_WIDTH - 26, 3, new Color(255, 250, 230, 180), 1.5);
    highlight.setPosition(0, BAR_HEIGHT / 2 - 10);
    bar.addChild(highlight);

    for (const x of [-102.5, 102.5]) {
      const separator = createUiNode('GameStatsBar:Separator', 2, 44);
      drawRounded(separator, 2, 44, new Color(166, 111, 71, 80), 1);
      separator.setPosition(x, 0);
      bar.addChild(separator);
    }

    for (const column of STAT_COLUMNS) {
      const icon = this.createIcon(column.cell, column.fallback);
      icon.setPosition(column.x - 50, 0);
      bar.addChild(icon);

      const title = createLabel(column.title, 16, new Color(117, 76, 52, 255), 94, 24, 'display');
      title.node.setPosition(column.x + 27, 16);
      bar.addChild(title.node);

      const value = createLabel('0', 26, column.kind === 'spaces' ? COLORS.teal : COLORS.ink,
        94, 34, 'display', 'number');
      value.node.setPosition(column.x + 27, -13);
      bar.addChild(value.node);
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
