/**
 * 排行榜单行排名组件（从 LeaderboardView 拆出）。
 * 纯函数组件：接收条目数据与画布信息，返回渲染好的 Node。
 */
import {
  Color,
  ImageAsset,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  Texture2D,
  assetManager,
} from 'cc';
import type { LeaderboardEntry } from '../../../features/leaderboard/leaderboard';
import { GAME_CONFIG } from '../../../core/config/gameConfig';
import type { ArtRepository } from '../../utils/ArtRepository';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  withAlpha,
} from '../../utils/uiFactory';
import { displayNameOf, formatDateText, formatScore, initialOf } from '../../utils/format';

export const ROW_HEIGHT = 88;
const MEDAL_COLORS = [
  new Color(255, 193, 7, 255),     // 金牌 - 更鲜艳的金色
  new Color(189, 195, 199, 255),   // 银牌 - 更纯净的银色
  new Color(205, 127, 50, 255),    // 铜牌 - 更亮的铜色
] as const;
export const PAPER_BORDER = new Color(220, 210, 195, 255);  // 更柔和的边框
export const CAPTION_COLOR = new Color(156, 136, 126, 255); // 更柔和的辅助文字
const PAPER_FALLBACK = new Color(252, 248, 242, 255);       // 更亮的纸面
const CARD_HIGHLIGHT = new Color(255, 245, 230, 255);       // 高亮卡片 - 温暖奶黄色
const ROW_SHADOW = new Color(0, 0, 0, 25);                  // 更自然的阴影
const PILL_BG = new Color(255, 250, 240, 255);              // 分数胶囊背景
const PILL_BORDER = new Color(230, 220, 205, 255);          // 胶囊边框
const PAPER_INSET_X = 0.22;
const PAPER_INSET_Y = 0.16;

/** 生成一行排名（含阴影、卡片、名次徽章、头像、昵称与分数胶囊）。 */
export function createRankItem(entry: LeaderboardEntry, width: number, current: boolean,
  art: ArtRepository): Node {
  const row = createUiNode(`LeaderboardRow:${entry.rank}`, width, ROW_HEIGHT);

  const shadow = createUiNode(`LeaderboardRowShadow:${entry.rank}`, width - 2, ROW_HEIGHT - 2);
  drawRounded(shadow, width - 2, ROW_HEIGHT - 2, ROW_SHADOW, 28);
  shadow.setPosition(0, -3);
  row.addChild(shadow);

  const card = createUiNode(`LeaderboardRowCard:${entry.rank}`, width, ROW_HEIGHT);
  renderPaperSurface(card, width, ROW_HEIGHT, current, art);
  row.addChild(card);

  renderRankBadge(card, entry, width);
  renderAvatar(card, entry, width, current, art);
  renderPlayerInfo(card, entry, width);
  renderScorePill(card, entry, width, current);

  if (current) {
    const meBadge = createUiNode('MeBadge', 40, 26);
    drawRounded(meBadge, 40, 26, COLORS.coral, 13, { color: COLORS.white, width: 2 });
    const meText = createLabel('我', 15, COLORS.white, 34, 24, 'display');
    meBadge.addChild(meText.node);
    meBadge.setPosition(-width / 2 + 122, -26);
    card.addChild(meBadge);
  }
  return row;
}

/** 纸张风格表面（优先使用切图，缺失时回退到自绘圆角）。 */
export function renderPaperSurface(node: Node, width: number, height: number, highlight: boolean,
  art: ArtRepository): void {
  const frame = art.frame(GAME_CONFIG.art.collectionCardLight);
  if (!frame) {
    const bgColor = highlight
      ? new Color(255, 248, 235, 255)  // 高亮：温暖的奶黄色
      : new Color(255, 252, 248, 255); // 普通：纯净的白色
    const borderColor = highlight
      ? new Color(255, 152, 102, 255)  // 高亮：珊瑚橙边框
      : new Color(225, 215, 200, 255); // 普通：柔和米色边框
    drawRounded(node, width, height, bgColor, 28,
      { color: borderColor, width: highlight ? 3 : 2 });
    return;
  }

  const source = frame.originalSize;
  const horizontalInset = Math.min(
    Math.round(source.width * PAPER_INSET_X), Math.max(1, Math.floor(width / 2) - 2));
  const verticalInset = Math.min(
    Math.round(source.height * PAPER_INSET_Y), Math.max(1, Math.floor(height / 2) - 2));
  frame.insetLeft = horizontalInset;
  frame.insetRight = horizontalInset;
  frame.insetTop = verticalInset;
  frame.insetBottom = verticalInset;
  const surface = createSpriteNode(`${node.name}:PaperSurface`, frame, width, height);
  const sprite = surface.getComponent(Sprite);
  if (sprite) {
    sprite.type = Sprite.Type.SLICED;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  }
  node.addChild(surface);

  const borderColor = highlight
    ? new Color(255, 152, 102, 255)
    : new Color(225, 215, 200, 255);
  const outline = createUiNode(`${node.name}:PaperOutline`, width, height);
  drawRounded(outline, width, height, new Color(255, 255, 255, 0), 28,
    { color: borderColor, width: highlight ? 3 : 2 });
  node.addChild(outline);
}

function renderRankBadge(card: Node, entry: LeaderboardEntry, width: number): void {
  const rankNode = createUiNode(`RankBadge:${entry.rank}`, 48, 48);
  const medal = entry.rank >= 1 && entry.rank <= 3 ? MEDAL_COLORS[entry.rank - 1] : undefined;
  if (medal) {
    // 前三名：金银铜奖章，更大更醒目
    drawRounded(rankNode, 48, 48, medal, 24, { color: COLORS.white, width: 3 });
    const rankText = createLabel(String(entry.rank), 26, COLORS.white, 42, 42, 'display');
    rankText.isBold = true;
    rankNode.addChild(rankText.node);
  } else {
    // 其他排名：简洁圆角方块
    drawRounded(rankNode, 44, 44, new Color(248, 248, 250, 255), 14,
      { color: new Color(220, 215, 205, 255), width: 2 });
    const rankText = createLabel(String(entry.rank), 20, new Color(120, 110, 100, 255), 40, 40, 'display');
    rankNode.addChild(rankText.node);
  }
  rankNode.setPosition(-width / 2 + 35, 0);
  card.addChild(rankNode);
}

function renderAvatar(card: Node, entry: LeaderboardEntry, width: number, current: boolean, art: ArtRepository): void {
  const avatar = createUiNode(`LeaderboardAvatar:${entry.rank}`, 54, 54);
  drawRounded(avatar, 54, 54, new Color(255, 246, 235, 255), 27,
    { color: current ? COLORS.coral : new Color(156, 204, 204, 255), width: current ? 3 : 2 });

  // 使用猫咪头像作为默认头像
  const catFrame = art.frame(GAME_CONFIG.cats[0].asset);
  if (catFrame) {
    const catAvatar = createSpriteNode('AvatarCat', catFrame, 48, 48);
    catAvatar.name = 'AvatarFallback';
    catAvatar.setPosition(0, 0);
    avatar.addChild(catAvatar);
  } else {
    // 降级方案：显示首字母
    const initial = createLabel(initialOf(entry.nickname), 22, COLORS.teal, 50, 50, 'display');
    initial.node.name = 'AvatarFallback';
    avatar.addChild(initial.node);
  }

  avatar.setPosition(-width / 2 + 92, 0);
  card.addChild(avatar);
  loadAvatar(avatar, entry.avatarUrl);
}

function renderPlayerInfo(card: Node, entry: LeaderboardEntry, width: number): void {
  const nameWidth = width - 330;
  const name = createLabel(displayNameOf(entry.nickname, entry.playerId), 22, new Color(45, 45, 45, 255), nameWidth, 30);
  name.horizontalAlign = Label.HorizontalAlign.LEFT;
  name.isBold = true;
  name.node.setPosition(-width / 2 + 148 + nameWidth / 2, 16);
  card.addChild(name.node);

  const dateText = formatDateText(entry.achievedAt);
  if (dateText) {
    const date = createLabel(dateText, 16, new Color(156, 136, 126, 255), nameWidth, 26);
    date.horizontalAlign = Label.HorizontalAlign.LEFT;
    date.node.setPosition(-width / 2 + 148 + nameWidth / 2, -16);
    card.addChild(date.node);
  }
}

function renderScorePill(card: Node, entry: LeaderboardEntry, width: number, current: boolean): void {
  const scorePill = createUiNode(`ScorePill:${entry.rank}`, 160, 50);
  const pillBg = current
    ? new Color(255, 245, 235, 255)  // 高亮：温暖底色
    : new Color(252, 250, 245, 255); // 普通：米白底色
  const pillBorder = current
    ? new Color(255, 152, 102, 255)  // 高亮：珊瑚橙边框
    : new Color(220, 210, 195, 255); // 普通：柔和边框
  drawRounded(scorePill, 160, 50, pillBg, 25,
    { color: pillBorder, width: current ? 3 : 2 });

  const topTone = entry.rank <= 3
    ? new Color(255, 152, 0, 255)    // 前三名：橙金色
    : new Color(72, 179, 174, 255);  // 其他：青色
  const score = createLabel(formatScore(entry.score), 26, topTone, 140, 44, 'display', 'number');
  score.isBold = true;
  score.node.setPosition(0, 1);
  scorePill.addChild(score.node);
  scorePill.setPosition(width / 2 - 92, 0);
  card.addChild(scorePill);
}

function loadAvatar(parent: Node, avatarUrl: string | null): void {
  if (!avatarUrl) return;
  assetManager.loadRemote<ImageAsset>(avatarUrl, (error, image) => {
    if (error || !image || !parent.isValid) return;
    const texture2D = new Texture2D();
    texture2D.image = image;
    const frame = new SpriteFrame();
    frame.texture = texture2D;
    const sprite = parent.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    // 销毁降级方案（猫咪头像或首字母）
    parent.getChildByName('AvatarFallback')?.destroy();
  });
}
