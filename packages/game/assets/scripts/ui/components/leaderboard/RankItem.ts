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
  new Color(245, 180, 54, 255),
  new Color(182, 196, 205, 255),
  new Color(200, 138, 96, 255),
] as const;
export const PAPER_BORDER = COLORS.edgeBrown;
export const CAPTION_COLOR = COLORS.textMuted;
const PAPER_FALLBACK = COLORS.surfacePaper;
const CARD_HIGHLIGHT = new Color(255, 233, 205, 250);
const ROW_SHADOW = withAlpha(COLORS.edgeBrown, 70);
const PILL_BG = new Color(255, 247, 230, 255);
const PILL_BORDER = withAlpha(COLORS.edgeBrown, 150);
const PAPER_INSET_X = 0.22;
const PAPER_INSET_Y = 0.16;

/** 生成一行排名（含阴影、卡片、名次徽章、头像、昵称与分数胶囊）。 */
export function createRankItem(entry: LeaderboardEntry, width: number, current: boolean,
  art: ArtRepository): Node {
  const row = createUiNode(`LeaderboardRow:${entry.rank}`, width, ROW_HEIGHT);

  const shadow = createUiNode(`LeaderboardRowShadow:${entry.rank}`, width, ROW_HEIGHT);
  drawRounded(shadow, width, ROW_HEIGHT, ROW_SHADOW, 24);
  shadow.setPosition(0, -4);
  row.addChild(shadow);

  const card = createUiNode(`LeaderboardRowCard:${entry.rank}`, width, ROW_HEIGHT);
  renderPaperSurface(card, width, ROW_HEIGHT, current, art);
  row.addChild(card);

  renderRankBadge(card, entry, width);
  renderAvatar(card, entry, width, current);
  renderPlayerInfo(card, entry, width);
  renderScorePill(card, entry, width, current);

  if (current) {
    const meBadge = createUiNode('MeBadge', 36, 24);
    drawRounded(meBadge, 36, 24, COLORS.coral, 12, { color: COLORS.ink, width: 2 });
    const meText = createLabel('我', 14, COLORS.white, 30, 22, 'display');
    meBadge.addChild(meText.node);
    meBadge.setPosition(-width / 2 + 120, -25);
    card.addChild(meBadge);
  }
  return row;
}

/** 纸张风格表面（优先使用切图，缺失时回退到自绘圆角）。 */
export function renderPaperSurface(node: Node, width: number, height: number, highlight: boolean,
  art: ArtRepository): void {
  const frame = art.frame(GAME_CONFIG.art.collectionCardLight);
  if (!frame) {
    drawRounded(node, width, height, highlight ? CARD_HIGHLIGHT : PAPER_FALLBACK, 24,
      { color: highlight ? COLORS.coral : PAPER_BORDER, width: highlight ? 4 : 3 });
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

  const outline = createUiNode(`${node.name}:PaperOutline`, width, height);
  drawRounded(outline, width, height, new Color(255, 255, 255, 0), 24,
    { color: highlight ? COLORS.coral : PAPER_BORDER, width: highlight ? 4 : 3 });
  node.addChild(outline);
}

function renderRankBadge(card: Node, entry: LeaderboardEntry, width: number): void {
  const rankNode = createUiNode(`RankBadge:${entry.rank}`, 46, 46);
  const medal = entry.rank >= 1 && entry.rank <= 3 ? MEDAL_COLORS[entry.rank - 1] : undefined;
  if (medal) {
    drawRounded(rankNode, 46, 46, medal, 23, { color: COLORS.ink, width: 3 });
    const rankText = createLabel(String(entry.rank), 24, COLORS.white, 40, 40, 'display');
    rankNode.addChild(rankText.node);
  } else {
    drawRounded(rankNode, 42, 42, COLORS.ivory, 13, { color: PAPER_BORDER, width: 2 });
    const rankText = createLabel(String(entry.rank), 21, COLORS.ink, 38, 38, 'display');
    rankNode.addChild(rankText.node);
  }
  rankNode.setPosition(-width / 2 + 34, 0);
  card.addChild(rankNode);
}

function renderAvatar(card: Node, entry: LeaderboardEntry, width: number, current: boolean): void {
  const avatar = createUiNode(`LeaderboardAvatar:${entry.rank}`, 54, 54);
  drawRounded(avatar, 54, 54, new Color(255, 246, 222, 255), 27,
    { color: current ? COLORS.coral : COLORS.teal, width: current ? 3 : 2 });
  const initial = createLabel(initialOf(entry.nickname), 22, COLORS.teal, 50, 50, 'display');
  initial.node.name = 'AvatarInitial';
  avatar.addChild(initial.node);
  avatar.setPosition(-width / 2 + 92, 0);
  card.addChild(avatar);
  loadAvatar(avatar, entry.avatarUrl);
}

function renderPlayerInfo(card: Node, entry: LeaderboardEntry, width: number): void {
  const nameWidth = width - 330;
  const name = createLabel(displayNameOf(entry.nickname, entry.playerId), 21, COLORS.ink, nameWidth, 30);
  name.horizontalAlign = Label.HorizontalAlign.LEFT;
  name.node.setPosition(-width / 2 + 148 + nameWidth / 2, 16);
  card.addChild(name.node);

  const dateText = formatDateText(entry.achievedAt);
  if (dateText) {
    const date = createLabel(dateText, 15, CAPTION_COLOR, nameWidth, 26);
    date.horizontalAlign = Label.HorizontalAlign.LEFT;
    date.node.setPosition(-width / 2 + 148 + nameWidth / 2, -17);
    card.addChild(date.node);
  }
}

function renderScorePill(card: Node, entry: LeaderboardEntry, width: number, current: boolean): void {
  const scorePill = createUiNode(`ScorePill:${entry.rank}`, 156, 46);
  drawRounded(scorePill, 156, 46, PILL_BG, 23,
    { color: current ? COLORS.coral : PILL_BORDER, width: current ? 3 : 2 });
  const topTone = entry.rank <= 3 ? COLORS.mustard : COLORS.teal;
  const score = createLabel(formatScore(entry.score), 25, topTone, 136, 40, 'display', 'number');
  score.node.setPosition(0, 1);
  scorePill.addChild(score.node);
  scorePill.setPosition(width / 2 - 90, 0);
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
    parent.getChildByName('AvatarInitial')?.destroy();
  });
}
