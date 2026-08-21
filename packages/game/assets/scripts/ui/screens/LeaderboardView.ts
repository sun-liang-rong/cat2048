import {
  Color,
  ImageAsset,
  Label,
  Mask,
  Node,
  ScrollView,
  Sprite,
  SpriteFrame,
  Texture2D,
  assetManager,
} from 'cc';
import type { LeaderboardEntry, LeaderboardResponse } from '../../features/leaderboard/leaderboard';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import { addCoverBackground } from '../styles/background';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';
import { displayNameOf, formatDateText, formatScore, initialOf } from '../utils/format';

export type LeaderboardViewStatus = 'loading' | 'ready' | 'error';

export interface LeaderboardViewModel {
  readonly data: LeaderboardResponse | null;
  readonly status: LeaderboardViewStatus;
  readonly localHighScore: number;
  readonly uiWidth: number;
  readonly uiHeight: number;
  readonly topInset: number;
  readonly bottomInset: number;
}

export interface LeaderboardViewActions {
  readonly onBack: () => void;
  readonly onRetry: () => void;
}

const ROW_HEIGHT = 88;
const ROW_STEP = 100;
const HEADER_HEIGHT = 42;
const MEDAL_COLORS = [
  new Color(245, 180, 54, 255),
  new Color(182, 196, 205, 255),
  new Color(200, 138, 96, 255),
] as const;
const TITLE_COLOR = new Color(91, 49, 31, 255);
const PAPER_BORDER = new Color(105, 61, 40, 255);
const PAPER_FALLBACK = new Color(255, 248, 224, 250);
const CARD_HIGHLIGHT = new Color(255, 233, 205, 250);
const ROW_SHADOW = new Color(105, 61, 40, 70);
const CAPTION_COLOR = new Color(148, 118, 106, 255);
const PILL_BG = new Color(255, 247, 230, 255);
const PILL_BORDER = new Color(105, 61, 40, 150);
const PAPER_INSET_X = 0.22;
const PAPER_INSET_Y = 0.16;
// Keep 24px of clear space between the decorative border and the text area.
const MY_RANK_TEXT_HEIGHT = 74;
const MY_RANK_BORDER_PADDING = 24;
const MY_RANK_HEIGHT = MY_RANK_TEXT_HEIGHT + MY_RANK_BORDER_PADDING * 2;
const MY_RANK_CENTER_OFFSET = 90;
const LIST_TOP_GAP = 17;
const OFFLINE_STATE_HEIGHT = 238;
const OFFLINE_TOP_GAP = 50;

export class LeaderboardView {
  private parent: Node | null = null;
  private model: LeaderboardViewModel | null = null;
  private actions: LeaderboardViewActions | null = null;

  public constructor(private readonly art: ArtRepository) {}

  public build(parent: Node, model: LeaderboardViewModel, actions: LeaderboardViewActions): void {
    this.parent = parent;
    this.model = model;
    this.actions = actions;
    this.render();
  }

  public update(model: LeaderboardViewModel): void {
    this.model = model;
    this.render();
  }

  public clear(): void {
    this.parent = null;
    this.model = null;
    this.actions = null;
  }

  private render(): void {
    const parent = this.parent;
    const model = this.model;
    const actions = this.actions;
    if (!parent || !model || !actions) return;
    for (const child of [...parent.children]) child.destroy();

    addCoverBackground(
      parent,
      this.art,
      GAME_CONFIG.art.collectionBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(255, 246, 220, 255),
    );

    const headerY = this.headerY(model);
    const back = createIconButton(
      'LeaderboardBack',
      this.art.frame(GAME_CONFIG.art.collectionBackPaw),
      '‹',
      78,
      actions.onBack);
    back.setPosition(-model.uiWidth / 2 + 60, headerY);
    parent.addChild(back);

    const title = createLabel('排行榜', 50, TITLE_COLOR, 390, 72, 'display');
    title.node.setPosition(0, headerY + 2);
    parent.addChild(title.node);

    const width = Math.min(664, model.uiWidth - 56);
    this.renderMyRank(parent, model, width, headerY - MY_RANK_CENTER_OFFSET);

    if (model.status === 'loading') {
      this.renderLoadingState(parent, model);
      return;
    }

    if (model.status === 'error') {
      this.renderOfflineState(parent, model, actions);
      return;
    }

    const entries = model.data?.entries ?? [];
    if (entries.length === 0) {
      const empty = createLabel('暂无排名，成为第一个挑战者吧',
        26, COLORS.ink, Math.min(620, model.uiWidth - 50), 80, 'display');
      empty.node.setPosition(0, this.listRegion(model).center);
      parent.addChild(empty.node);
      return;
    }

    this.renderEntries(parent, model, entries);
  }

  private headerY(model: LeaderboardViewModel): number {
    return model.uiHeight / 2 - model.topInset - 48;
  }

  private listRegion(model: LeaderboardViewModel): { top: number; bottom: number; center: number } {
    const top = this.myRankBottomY(model) - LIST_TOP_GAP;
    const bottom = -model.uiHeight / 2 + model.bottomInset + 24;
    return { top, bottom, center: (top + bottom) / 2 };
  }

  private myRankBottomY(model: LeaderboardViewModel): number {
    return this.headerY(model) - MY_RANK_CENTER_OFFSET - MY_RANK_HEIGHT / 2;
  }

  private renderMyRank(parent: Node, model: LeaderboardViewModel, width: number, centerY: number): void {
    const stripWidth = width;
    const strip = createUiNode('LeaderboardMyRank', stripWidth, MY_RANK_HEIGHT);
    this.renderPaperSurface(strip, stripWidth, MY_RANK_HEIGHT, false);
    strip.setPosition(0, centerY);
    parent.addChild(strip);

    const me = model.data?.me;
    if (me) {
      const leftPill = createUiNode('MyRankBadge', 168, 42);
      // 去掉边框，只保留背景色
      drawRounded(leftPill, 168, 42, COLORS.coral, 21);
      const leftText = createLabel('我的排名', 20, COLORS.white, 150, 38, 'display');
      leftText.node.setScale(0.92, 0.92, 1);
      leftPill.addChild(leftText.node);
      leftPill.setPosition(-stripWidth / 2 + 100, 0);
      strip.addChild(leftPill);

      const detailWidth = Math.max(1, stripWidth - 210);
      const rightText = createLabel(
        `第 ${me.rank} 名 · 最高分 ${formatScore(me.score)}`,
        21, COLORS.teal, detailWidth, 40, 'display');
      rightText.node.setPosition(stripWidth / 2 - detailWidth / 2, 0);
      strip.addChild(rightText.node);
    } else {
      const hint = createLabel(model.localHighScore > 0
        ? `本地最高分 ${formatScore(model.localHighScore)} · 完成同步后加入排行榜`
        : '完成一局后加入排行榜', 20, COLORS.teal, stripWidth - 72, MY_RANK_TEXT_HEIGHT, 'display');
      hint.node.setPosition(0, 0);
      strip.addChild(hint.node);
    }
  }

  private renderLoadingState(parent: Node, model: LeaderboardViewModel): void {
    const region = this.listRegion(model);
    const width = Math.min(664, model.uiWidth - 56);
    const hint = createLabel('正在同步好友成绩', 24, TITLE_COLOR, 420, 44, 'display');
    hint.node.setPosition(0, region.top - 30);
    parent.addChild(hint.node);
    for (let index = 0; index < 4; index += 1) {
      const row = createUiNode(`LeaderboardLoadingRow:${index}`, width - 12, ROW_HEIGHT);
      this.renderPaperSurface(row, width - 12, ROW_HEIGHT, false);
      row.setPosition(0, region.top - 92 - index * ROW_STEP);
      const rank = createUiNode(`LeaderboardLoadingRank:${index}`, 42, 42);
      drawRounded(rank, 42, 42, new Color(226, 214, 194, 255), 21,
        { color: PAPER_BORDER, width: 2 });
      rank.setPosition(-(width - 12) / 2 + 36, 0);
      row.addChild(rank);
      const name = createUiNode(`LeaderboardLoadingName:${index}`, 180, 16);
      drawRounded(name, 180, 16, new Color(226, 214, 194, 255), 8,
        { color: new Color(105, 61, 40, 50), width: 1 });
      name.setPosition(-80, 13);
      row.addChild(name);
      const detail = createUiNode(`LeaderboardLoadingDetail:${index}`, 112, 12);
      drawRounded(detail, 112, 12, new Color(236, 226, 208, 255), 6,
        { color: new Color(105, 61, 40, 40), width: 1 });
      detail.setPosition(-114, -18);
      row.addChild(detail);
      const score = createUiNode(`LeaderboardLoadingScore:${index}`, 116, 40);
      drawRounded(score, 116, 40, new Color(244, 235, 216, 255), 20,
        { color: new Color(105, 61, 40, 50), width: 1 });
      score.setPosition((width - 12) / 2 - 82, 0);
      row.addChild(score);
      parent.addChild(row);
    }
  }

  private renderOfflineState(parent: Node, model: LeaderboardViewModel, actions: LeaderboardViewActions): void {
    const width = Math.min(590, model.uiWidth - 64);
    const state = createUiNode('LeaderboardOfflineState', width, OFFLINE_STATE_HEIGHT);
    this.renderPaperSurface(state, width, OFFLINE_STATE_HEIGHT, false);
    state.setPosition(0, this.myRankBottomY(model) - OFFLINE_TOP_GAP - OFFLINE_STATE_HEIGHT / 2);
    parent.addChild(state);

    const title = createLabel('排行榜暂时不可用', 29, TITLE_COLOR, width - 44, 52, 'display');
    title.node.setPosition(0, 72);
    state.addChild(title.node);
    const copy = createLabel('网络恢复后可重新同步好友成绩', 21, TITLE_COLOR, width - 52, 40, 'display');
    copy.node.setPosition(0, 22);
    state.addChild(copy.node);
    const local = createLabel(model.localHighScore > 0
      ? `本地最高分 ${formatScore(model.localHighScore)} 已保留`
      : '先完成一局，记录你的本地成绩', 20, CAPTION_COLOR, width - 52, 36);
    local.node.setPosition(0, -20);
    state.addChild(local.node);
    const retry = createButton('重新连接', 250, 64, COLORS.teal, actions.onRetry, 24);
    retry.setPosition(0, -80);
    state.addChild(retry);
  }

  private renderEntries(parent: Node, model: LeaderboardViewModel, entries: readonly LeaderboardEntry[]): void {
    const width = Math.min(664, model.uiWidth - 56);
    const region = this.listRegion(model);
    const listHeight = Math.max(360, region.top - region.bottom);
    const top = region.top;
    const scroll = createUiNode('LeaderboardScroll', width, listHeight);
    scroll.setPosition(0, top - listHeight / 2);
    parent.addChild(scroll);

    const header = createUiNode('LeaderboardColumnHeader', width, HEADER_HEIGHT);
    header.setPosition(0, listHeight / 2 - HEADER_HEIGHT / 2);
    scroll.addChild(header);
    this.renderColumnHeader(header, width);

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

    const currentRank = model.data?.me?.rank ?? null;
    entries.forEach((entry, index) => {
      const row = this.createEntryRow(entry, width - 12, entry.rank === currentRank);
      row.setPosition(0, contentHeight / 2 - 68 - index * ROW_STEP);
      content.addChild(row);
    });
  }

  private renderColumnHeader(header: Node, width: number): void {
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

  private createEntryRow(entry: LeaderboardEntry, width: number, current: boolean): Node {
    const row = createUiNode(`LeaderboardRow:${entry.rank}`, width, ROW_HEIGHT);

    const shadow = createUiNode(`LeaderboardRowShadow:${entry.rank}`, width, ROW_HEIGHT);
    drawRounded(shadow, width, ROW_HEIGHT, ROW_SHADOW, 24);
    shadow.setPosition(0, -4);
    row.addChild(shadow);

    const card = createUiNode(`LeaderboardRowCard:${entry.rank}`, width, ROW_HEIGHT);
    this.renderPaperSurface(card, width, ROW_HEIGHT, current);
    row.addChild(card);

    this.renderRankBadge(card, entry, width);
    this.renderAvatar(card, entry, width, current);
    this.renderPlayerInfo(card, entry, width);
    this.renderScorePill(card, entry, width, current);

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

  private renderPaperSurface(node: Node, width: number, height: number, highlight: boolean): void {
    const frame = this.art.frame(GAME_CONFIG.art.collectionCardLight);
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

  private renderRankBadge(card: Node, entry: LeaderboardEntry, width: number): void {
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

  private renderAvatar(card: Node, entry: LeaderboardEntry, width: number, current: boolean): void {
    const avatar = createUiNode(`LeaderboardAvatar:${entry.rank}`, 54, 54);
    drawRounded(avatar, 54, 54, new Color(255, 246, 222, 255), 27,
      { color: current ? COLORS.coral : COLORS.teal, width: current ? 3 : 2 });
    const initial = createLabel(initialOf(entry.nickname), 22, COLORS.teal, 50, 50, 'display');
    initial.node.name = 'AvatarInitial';
    avatar.addChild(initial.node);
    avatar.setPosition(-width / 2 + 92, 0);
    card.addChild(avatar);
    this.loadAvatar(avatar, entry.avatarUrl);
  }

  private renderPlayerInfo(card: Node, entry: LeaderboardEntry, width: number): void {
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

  private renderScorePill(card: Node, entry: LeaderboardEntry, width: number, current: boolean): void {
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

  private loadAvatar(parent: Node, avatarUrl: string | null): void {
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
}
