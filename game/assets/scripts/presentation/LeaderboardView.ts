import {
  Color,
  ImageAsset,
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
    const back = createIconButton('LeaderboardBack', this.art.frame(GAME_CONFIG.art.back), '\u2039', 72,
      actions.onBack);
    back.setPosition(-model.uiWidth / 2 + 58, headerY);
    parent.addChild(back);

    const title = createLabel('\u6392\u884c\u699c', 45, COLORS.coral, 300, 70, 'display');
    title.node.setPosition(0, headerY + 8);
    parent.addChild(title.node);

    const meText = model.data?.me
      ? `\u6211\u7684\u6392\u540d  ${model.data.me.rank}  \u00b7  ${model.data.me.score}`
      : '\u5b8c\u6210\u4e00\u5c40\u540e\u52a0\u5165\u6392\u884c\u699c';
    const me = createLabel(meText, 22, COLORS.teal, Math.min(520, model.uiWidth - 80), 42, 'display');
    me.node.setPosition(0, headerY - 62);
    parent.addChild(me.node);

    if (model.status === 'loading') {
      const loading = createLabel('\u6b63\u5728\u52a0\u8f7d\u6392\u884c\u699c...', 28, COLORS.ink, 420, 60, 'display');
      loading.node.setPosition(0, 80);
      parent.addChild(loading.node);
      return;
    }

    if (model.status === 'error') {
      const error = createLabel('\u6392\u884c\u699c\u6682\u65f6\u4e0d\u53ef\u7528', 28, COLORS.ink, 460, 60, 'display');
      error.node.setPosition(0, 100);
      parent.addChild(error.node);
      const retry = createButton('\u91cd\u8bd5', 250, 72, COLORS.teal, actions.onRetry, 28);
      retry.setPosition(0, 8);
      parent.addChild(retry);
      return;
    }

    const entries = model.data?.entries ?? [];
    if (entries.length === 0) {
      const empty = createLabel('\u6682\u65e0\u6392\u540d\uff0c\u6210\u4e3a\u7b2c\u4e00\u4e2a\u6311\u6218\u8005\u5427',
        26, COLORS.ink, Math.min(620, model.uiWidth - 50), 80, 'display');
      empty.node.setPosition(0, 80);
      parent.addChild(empty.node);
      return;
    }

    this.renderEntries(parent, model, entries);
  }

  private renderEntries(parent: Node, model: LeaderboardViewModel, entries: readonly LeaderboardEntry[]): void {
    const width = Math.min(690, model.uiWidth - 36);
    const listHeight = Math.max(420, model.uiHeight - model.topInset - model.bottomInset - 260);
    const top = model.uiHeight / 2 - model.topInset - 142;
    const scroll = createUiNode('LeaderboardScroll', width, listHeight);
    scroll.setPosition(0, top - listHeight / 2);
    parent.addChild(scroll);

    const viewport = createUiNode('LeaderboardViewport', width, listHeight);
    viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    scroll.addChild(viewport);

    const contentHeight = Math.max(listHeight, entries.length * 94 + 24);
    const content = createUiNode('LeaderboardContent', width, contentHeight);
    content.setPosition(0, (listHeight - contentHeight) / 2);
    viewport.addChild(content);

    const scrollView = scroll.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.viewport = viewport;
    scrollView.content = content;

    const currentRank = model.data?.me?.rank ?? null;
    entries.forEach((entry, index) => {
      const row = this.createEntryRow(entry, width - 16, entry.rank === currentRank);
      row.setPosition(0, contentHeight / 2 - 50 - index * 94);
      content.addChild(row);
    });
  }

  private createEntryRow(entry: LeaderboardEntry, width: number, current: boolean): Node {
    const row = createUiNode(`LeaderboardRow:${entry.rank}`, width, 76);
    drawRounded(row, width, 76, current ? new Color(255, 234, 183, 255) : COLORS.ivory, 22,
      { color: current ? COLORS.coral : new Color(77, 61, 54, 120), width: current ? 4 : 2 });

    const rank = createLabel(String(entry.rank), 29, entry.rank <= 3 ? COLORS.coral : COLORS.ink, 58, 54, 'display');
    rank.node.setPosition(-width / 2 + 42, 0);
    row.addChild(rank.node);

    const avatar = createUiNode(`LeaderboardAvatar:${entry.rank}`, 52, 52);
    drawRounded(avatar, 52, 52, COLORS.cream, 26, { color: COLORS.teal, width: 2 });
    const initial = createLabel(this.initial(entry.nickname), 23, COLORS.teal, 48, 48, 'display');
    initial.node.name = 'AvatarInitial';
    avatar.addChild(initial.node);
    avatar.setPosition(-width / 2 + 104, 0);
    row.addChild(avatar);
    this.loadAvatar(avatar, entry.avatarUrl);

    const name = createLabel(this.displayName(entry), 22, COLORS.ink, width - 300, 36, 'display');
    name.node.setPosition(-width / 2 + 225, 14);
    row.addChild(name.node);
    const achieved = createLabel(this.scoreText(entry.score), 19, COLORS.teal, width - 300, 30, 'display', 'number');
    achieved.node.setPosition(-width / 2 + 225, -17);
    row.addChild(achieved.node);
    return row;
  }

  private loadAvatar(parent: Node, avatarUrl: string | null): void {
    if (!avatarUrl) return;
    assetManager.loadRemote<ImageAsset>(avatarUrl, (error, image) => {
      if (error || !image || !parent.isValid) return;
      const texture = new Texture2D();
      texture.image = image;
      const sprite = parent.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = new SpriteFrame({ texture });
      parent.getChildByName('AvatarInitial')?.destroy();
    });
  }

  private displayName(entry: LeaderboardEntry): string {
    return entry.nickname?.trim() || `\u73a9\u5bb6-${entry.playerId.slice(-4)}`;
  }

  private initial(nickname: string | null): string {
    return nickname?.trim().slice(0, 1) || '\u73a9';
  }

  private scoreText(score: number): string {
    return `\u6700\u9ad8\u5206  ${score}`;
  }
}
