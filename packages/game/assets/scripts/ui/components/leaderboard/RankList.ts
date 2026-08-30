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
const CAPTION_COLOR = new Color(156, 136, 126, 255);  // 柔和的辅助文字颜色

export interface RankListOptions {
  readonly entries: readonly LeaderboardEntry[];
  readonly currentRank: number | null;
  /** 自己的真实名次超出返回条目窗口时，追加到列表末尾的条目（前置省略号分隔）。 */
  readonly trailingMeEntry?: LeaderboardEntry | null;
  readonly width: number;
  /** 列表区域顶/底坐标（y 轴正方向朝上）。 */
  readonly top: number;
  readonly bottom: number;
}

/** 构建可滚动的排行榜列表（含列头、遮罩视口与行）。 */
export function createRankList(parent: Node, options: RankListOptions, art: ArtRepository): void {
  const { entries, currentRank, trailingMeEntry, width, top, bottom } = options;
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

  // 追加的自己那行多占一个行槽；省略分隔悬浮在两行之间的空档里，不额外占位
  const slots = entries.length + (trailingMeEntry ? 1 : 0);
  const contentHeight = Math.max(viewportHeight, slots * ROW_STEP + 24);
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

  if (trailingMeEntry) {
    const ownSlot = entries.length;
    if (showSeparator(entries, trailingMeEntry)) {
      const separator = createLabel('· · ·', 26, CAPTION_COLOR, width - 120, 34);
      separator.node.setPosition(0,
        contentHeight / 2 - 68 - ownSlot * ROW_STEP + ROW_STEP / 2);
      content.addChild(separator.node);
    }
    const row = createRankItem(trailingMeEntry, width - 12,
      trailingMeEntry.rank === currentRank, art);
    row.setPosition(0, contentHeight / 2 - 68 - ownSlot * ROW_STEP);
    content.addChild(row);
  }
}

/** 名次与列表末位之间有空档（差值 > 1）才显示省略号；第 51 名紧挨着排即可。 */
function showSeparator(entries: readonly LeaderboardEntry[], trailing: LeaderboardEntry): boolean {
  const last = entries[entries.length - 1];
  return entries.length > 0 && trailing.rank - last.rank > 1;
}

function renderColumnHeader(header: Node, width: number): void {
  const rankLabel = createLabel('名次', 18, CAPTION_COLOR, 70, 30);
  rankLabel.node.setPosition(-width / 2 + 36, 0);
  header.addChild(rankLabel.node);

  const playerLabel = createLabel('玩家', 18, CAPTION_COLOR, 130, 30);
  playerLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
  playerLabel.node.setPosition(-width / 2 + 148 + 65, 0);
  header.addChild(playerLabel.node);

  const scoreLabel = createLabel('最高分', 18, CAPTION_COLOR, 130, 30);
  scoreLabel.node.setPosition(width / 2 - 92, 0);
  header.addChild(scoreLabel.node);

  const rule = createUiNode('LeaderboardHeaderRule', width - 40, 1);
  drawRounded(rule, width - 40, 1, new Color(220, 210, 195, 255), 0.5);
  rule.setPosition(0, -HEADER_HEIGHT / 2 + 1);
  header.addChild(rule);
}
