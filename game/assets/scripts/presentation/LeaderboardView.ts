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
import type { LeaderboardEntry, LeaderboardResponse } from '../infrastructure/leaderboard';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import { addCoverBackground } from './background';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createUiNode,
  drawRounded,
} from './uiFactory';

export type LeaderboardViewStatus = 'loading' | 'ready' | 'error';

export interface LeaderboardViewModel {
  readonly data: LeaderboardResponse | null;
  readonly status: LeaderboardViewStatus;
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
const CARD_IVORY = new Color(255, 249, 230, 250);
const CARD_HIGHLIGHT = new Color(255, 233, 205, 250);
const ROW_SHADOW = new Color(110, 64, 44, 108);
const CAPTION_COLOR = new Color(148, 118, 106, 255);
const PILL_BG = new Color(255, 247, 230, 255);
const PILL_BORDER = new Color(77, 61, 54, 150);

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
      GAME_CONFIG.art.pageBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(249, 235, 206, 255),
    );

    const headerY = model.uiHeight / 2 - model.topInset - 62;
    const back = createIconButton('LeaderboardBack', this.art.frame(GAME_CONFIG.art.back), '‹', 72,
      actions.onBack);
    back.setPosition(-model.uiWidth / 2 + 58, headerY);
    parent.addChild(back);

    const title = createLabel('排行榜', 45, COLORS.coral, 300, 70, 'display');
    title.node.setPosition(0, headerY + 8);
    parent.addChild(title.node);

    const width = Math.min(690, model.uiWidth - 36);
    this.renderMyRank(parent, model, width, headerY - 70);

    if (model.status === 'loading') {
      const loading = createLabel('正在加载排行榜...', 28, COLORS.ink, 420, 60, 'display');
      loading.node.setPosition(0, this.listRegion(model).center + 26);
      parent.addChild(loading.node);
      return;
    }

    if (model.status === 'error') {
      const error = createLabel('排行榜暂时不可用', 28, COLORS.ink, 460, 60, 'display');
      error.node.setPosition(0, this.listRegion(model).center + 42);
      parent.addChild(error.node);
      const retry = createButton('重试', 250, 72, COLORS.teal, actions.onRetry, 28);
      retry.setPosition(0, this.listRegion(model).center - 32);
      parent.addChild(retry);
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

  private listRegion(model: LeaderboardViewModel): { top: number; bottom: number; center: number } {
    const headerY = model.uiHeight / 2 - model.topInset - 62;
    const top = headerY - 126;
    const bottom = -model.uiHeight / 2 + model.bottomInset + 118;
    return { top, bottom, center: (top + bottom) / 2 };
  }

  private renderMyRank(parent: Node, model: LeaderboardViewModel, width: number, centerY: number): void {
    const actions = this.actions;
    if (!actions) return;
    const stripWidth = width;
    const strip = createUiNode('LeaderboardMyRank', stripWidth, 66);
    drawRounded(strip, stripWidth, 66, new Color(255, 243, 214, 250), 24,
      { color: new Color(77, 61, 54, 170), width: 2 });
    strip.setPosition(0, centerY);
    parent.addChild(strip);

    const me = model.data?.me;
    if (me) {
      const leftPill = createUiNode('MyRankBadge', 168, 42);
      drawRounded(leftPill, 168, 42, COLORS.coral, 21, { color: COLORS.ink, width: 3 });
      const leftText = createLabel('我的排名', 20, COLORS.white, 150, 38, 'display');
      leftText.node.setScale(0.92, 0.92, 1);
      leftPill.addChild(leftText.node);
      leftPill.setPosition(-stripWidth / 2 + 100, 0);
      strip.addChild(leftPill);

      const rightText = createLabel(
        `第 ${me.rank} 名 · 最高分 ${this.formatScore(me.score)}`,
        21, COLORS.teal, stripWidth - 100, 40, 'display');
      rightText.node.setPosition(0, 0);
      strip.addChild(rightText.node);
    } else {
      const hint = createLabel('完成一局后加入排行榜', 21, COLORS.teal, stripWidth - 100, 42, 'display');
      hint.node.setPosition(0, 0);
      strip.addChild(hint.node);
    }
  }

  private renderEntries(parent: Node, model: LeaderboardViewModel, entries: readonly LeaderboardEntry[]): void {
    const width = Math.min(690, model.uiWidth - 36);
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
    drawRounded(rule, width - 40, 2, new Color(77, 61, 54, 60), 1);
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
    drawRounded(card, width, ROW_HEIGHT, current ? CARD_HIGHLIGHT : CARD_IVORY, 24,
      { color: current ? COLORS.coral : new Color(77, 61, 54, 200), width: current ? 4 : 2 });
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

  private renderRankBadge(card: Node, entry: LeaderboardEntry, width: number): void {
    const rankNode = createUiNode(`RankBadge:${entry.rank}`, 46, 46);
    const medal = entry.rank >= 1 && entry.rank <= 3 ? MEDAL_COLORS[entry.rank - 1] : undefined;
    if (medal) {
      drawRounded(rankNode, 46, 46, medal, 23, { color: COLORS.ink, width: 3 });
      const rankText = createLabel(String(entry.rank), 24, COLORS.white, 40, 40, 'display');
      rankNode.addChild(rankText.node);
    } else {
      drawRounded(rankNode, 42, 42, COLORS.ivory, 13, { color: COLORS.ink, width: 2 });
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
    const initial = createLabel(this.initial(entry.nickname), 22, COLORS.teal, 50, 50, 'display');
    initial.node.name = 'AvatarInitial';
    avatar.addChild(initial.node);
    avatar.setPosition(-width / 2 + 92, 0);
    card.addChild(avatar);
    this.loadAvatar(avatar, entry.avatarUrl);
  }

  private renderPlayerInfo(card: Node, entry: LeaderboardEntry, width: number): void {
    const nameWidth = width - 330;
    const name = createLabel(this.displayName(entry), 21, COLORS.ink, nameWidth, 30);
    name.horizontalAlign = Label.HorizontalAlign.LEFT;
    name.node.setPosition(-width / 2 + 148 + nameWidth / 2, 16);
    card.addChild(name.node);

    const dateText = this.dateText(entry.achievedAt);
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
    const score = createLabel(this.formatScore(entry.score), 25, topTone, 136, 40, 'display', 'number');
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

  private displayName(entry: LeaderboardEntry): string {
    return entry.nickname?.trim() || `玩家-${entry.playerId.slice(-4)}`;
  }

  private initial(nickname: string | null): string {
    return nickname?.trim().slice(0, 1) || '玩';
  }

  private formatScore(score: number): string {
    return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  private dateText(achievedAt: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(achievedAt);
    if (!match) return '';
    return `${Number(match[2])}月${Number(match[3])}日`;
  }
}
