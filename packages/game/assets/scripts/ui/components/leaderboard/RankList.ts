/**
 * 排行榜滚动列表组件（从 LeaderboardView 拆出）。
 * 纯函数组件：构建滚动视图、列头与行布局。
 */
import { Color, Label, Mask, Node, ScrollView } from 'cc';
import type { LeaderboardEntry } from '../../../features/leaderboard/leaderboard';
import type { ArtRepository } from '../../utils/ArtRepository';
import {
  COLORS,
  createLabel,
  createUiNode,
  drawRounded,
} from '../../utils/uiFactory';
import { createRankItem, ROW_HEIGHT } from './RankItem';

const ROW_STEP = 100;
const HEADER_HEIGHT = 42;
const CAPTION_COLOR = new Color(148, 118, 106, 255);

export interface RankListOptions {
  readonly entries: readonly LeaderboardEntry[];
  readonly currentRank: number | null;
  readonly width: number;
  /** 列表区域顶/底坐标（y 轴正方向朝上）。 */
  readonly top: number;
  readonly bottom: number;
}

/** 构建可滚动的排行榜列表（含列头、遮罩视口与行）。 */
export function createRankList(parent: Node, options: RankListOptions, art: ArtRepository): void {
  const { entries, currentRank, width, top, bottom } = options;
  const listHeight = Math.max(360, top - bottom);
  const scroll = createUiNode('LeaderboardScroll', width, listHeight);
  scroll.setPosition(0, top - listHeight / 2);
  parent.addChild(scroll);

  const header = createUiNode('LeaderboardColumnHeader', width, HEADER_HEIGHT);
  header.setPosition(0, listHeight / 2 - HEADER_HEIGHT / 2);
  scroll.addChild(header);
  renderColumnHeader(header, width);

  const viewportHeight = listHeight - HEADER_HEIGHT;
  const viewport = createUiNode('LeaderboardViewport', width, viewportHeight);
  viewport.setPosition(0, -HEADER_HEIGHT / 2);
  viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  scroll.addChild(viewport);

  const contentHeight = Math.max(viewportHeight, entries.length * ROW_STEP + 24);
  const content = createUiNode('LeaderboardContent', width, contentHeight);
  content.setPosition(0, (viewportHeight - contentHeight) / 2);
  viewport.addChild(content);

  const scrollView = scroll.addComponent(ScrollView);
  scrollView.horizontal = false;
  scrollView.vertical = true;
  scrollView.inertia = true;
  scrollView.content = content;

  entries.forEach((entry, index) => {
    const row = createRankItem(entry, width - 12, entry.rank === currentRank, art);
    row.setPosition(0, contentHeight / 2 - 68 - index * ROW_STEP);
    content.addChild(row);
  });
}

function renderColumnHeader(header: Node, width: number): void {
  const rankLabel = createLabel('名次', 17, CAPTION_COLOR, 70, 30);
  rankLabel.node.setPosition(-width / 2 + 34, 0);
  header.addChild(rankLabel.node);

  const playerLabel = createLabel('玩家', 17, CAPTION_COLOR, 130, 30);
  playerLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
  playerLabel.node.setPosition(-width / 2 + 148 + 65, 0);
  header.addChild(playerLabel.node);

  const scoreLabel = createLabel('最高分', 17, CAPTION_COLOR, 130, 30);
  scoreLabel.node.setPosition(width / 2 - 90, 0);
  header.addChild(scoreLabel.node);

  const rule = createUiNode('LeaderboardHeaderRule', width - 40, 2);
  drawRounded(rule, width - 40, 2, new Color(105, 61, 40, 60), 1);
  rule.setPosition(0, -HEADER_HEIGHT / 2 + 1);
  header.addChild(rule);
}
