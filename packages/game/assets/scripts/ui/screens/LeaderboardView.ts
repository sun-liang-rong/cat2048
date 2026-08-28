import {
  Color,
  Node,
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
  withAlpha,
} from '../utils/uiFactory';
import { formatScore } from '../utils/format';
import { CAPTION_COLOR, PAPER_BORDER, ROW_HEIGHT, renderPaperSurface } from '../components/leaderboard/RankItem';
import { createRankList } from '../components/leaderboard/RankList';

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

const TITLE_COLOR = new Color(45, 45, 45, 255);              // 深色标题
const SUMMARY_BACKGROUND = new Color(255, 250, 242, 255);     // 我的排名背景
const SUMMARY_BORDER = new Color(220, 210, 195, 255);         // 我的排名边框
const SUMMARY_SHADOW = new Color(0, 0, 0, 20);                // 自然阴影
const STATE_WELL_BACKGROUND = new Color(255, 248, 240, 255);  // 状态图标背景
const STATUS_PILL_BACKGROUND = new Color(255, 250, 245, 255); // 状态胶囊背景
const MY_RANK_HEIGHT = 86;
const MY_RANK_CENTER_OFFSET = 105;
const LIST_TOP_GAP = 28;
const EMPTY_STATE_HEIGHT = 430;
const OFFLINE_STATE_HEIGHT = 440;

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
      COLORS.pageCream,
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
      this.renderEmptyState(parent, model, actions);
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
    const strip = createUiNode('LeaderboardMyRank', width, MY_RANK_HEIGHT);
    strip.setPosition(0, centerY);
    parent.addChild(strip);

    const shadow = createUiNode('LeaderboardMyRankShadow', width - 4, MY_RANK_HEIGHT - 2);
    drawRounded(shadow, width - 4, MY_RANK_HEIGHT - 2, SUMMARY_SHADOW, 32);
    shadow.setPosition(0, -3);
    strip.addChild(shadow);

    const surface = createUiNode('LeaderboardMyRankSurface', width, MY_RANK_HEIGHT);
    drawRounded(surface, width, MY_RANK_HEIGHT, SUMMARY_BACKGROUND, 32,
      { color: SUMMARY_BORDER, width: 2 });
    strip.addChild(surface);

    const me = model.data?.me;
    const badgeText = me ? '我的排名' : model.localHighScore > 0 ? '本地成绩' : '参赛记录';
    const detailText = me
      ? `第 ${me.rank} 名 · 最高分 ${formatScore(me.score)}`
      : model.localHighScore > 0
        ? `${formatScore(model.localHighScore)} 分 · 等待同步`
        : '完成一局后加入排行榜';

    const badge = createUiNode('MyRankBadge', 160, 48);
    const badgeColor = me
      ? new Color(255, 152, 102, 255)   // 已上榜：珊瑚橙
      : new Color(255, 193, 7, 255);    // 未上榜：金黄色
    drawRounded(badge, 160, 48, badgeColor, 24);
    const badgeLabel = createLabel(badgeText, 21, COLORS.white, 140, 42, 'display');
    badgeLabel.isBold = true;
    badge.addChild(badgeLabel.node);
    badge.setPosition(-width / 2 + 98, 0);
    surface.addChild(badge);

    const detailWidth = Math.max(1, width - 210);
    const detail = createLabel(detailText, 22, new Color(72, 179, 174, 255), detailWidth, 44);
    detail.isBold = true;
    detail.node.setPosition(90, 0);
    surface.addChild(detail.node);
  }

  /** 无任何好友成绩时的空状态：猫咪插图 + 引导文案 + 刷新动作。 */
  private renderEmptyState(parent: Node, model: LeaderboardViewModel,
    actions: LeaderboardViewActions): void {
    const width = Math.min(590, model.uiWidth - 64);
    const state = createUiNode('LeaderboardEmptyState', width, EMPTY_STATE_HEIGHT);
    state.setPosition(0, this.listRegion(model).center);
    parent.addChild(state);

    this.renderStateCat(state, 'EmptyState', 128, COLORS.teal, false);

    const title = createLabel('还没有好友上榜', 30, TITLE_COLOR, width - 44, 52, 'display');
    title.node.setPosition(0, 18);
    state.addChild(title.node);

    const hint = createLabel(model.localHighScore > 0
      ? `用 ${formatScore(model.localHighScore)} 分的实力，拿下第一名吧！`
      : '完成一局，成为第一个上榜的挑战者吧！',
    20, CAPTION_COLOR, width - 52, 40);
    hint.node.setPosition(0, -30);
    state.addChild(hint.node);

    const retry = createButton('刷新榜单', 270, 68, COLORS.teal, actions.onRetry, 24);
    retry.setPosition(0, -112);
    state.addChild(retry);
  }

  private renderLoadingState(parent: Node, model: LeaderboardViewModel): void {
    const region = this.listRegion(model);
    const width = Math.min(664, model.uiWidth - 56);
    const hint = createLabel('正在同步好友成绩', 24, TITLE_COLOR, 420, 44, 'display');
    hint.node.setPosition(0, region.top - 30);
    parent.addChild(hint.node);
    for (let index = 0; index < 4; index += 1) {
      const row = createUiNode(`LeaderboardLoadingRow:${index}`, width - 12, ROW_HEIGHT);
      renderPaperSurface(row, width - 12, ROW_HEIGHT, false, this.art);
      row.setPosition(0, region.top - 92 - index * 100);
      const rank = createUiNode(`LeaderboardLoadingRank:${index}`, 42, 42);
      drawRounded(rank, 42, 42, COLORS.skeleton, 21,
        { color: PAPER_BORDER, width: 2 });
      rank.setPosition(-(width - 12) / 2 + 36, 0);
      row.addChild(rank);
      const name = createUiNode(`LeaderboardLoadingName:${index}`, 180, 16);
      drawRounded(name, 180, 16, COLORS.skeleton, 8,
        { color: withAlpha(COLORS.edgeBrown, 50), width: 1 });
      name.setPosition(-80, 13);
      row.addChild(name);
      const detail = createUiNode(`LeaderboardLoadingDetail:${index}`, 112, 12);
      drawRounded(detail, 112, 12, new Color(236, 226, 208, 255), 6,
        { color: withAlpha(COLORS.edgeBrown, 40), width: 1 });
      detail.setPosition(-114, -18);
      row.addChild(detail);
      const score = createUiNode(`LeaderboardLoadingScore:${index}`, 116, 40);
      drawRounded(score, 116, 40, new Color(244, 235, 216, 255), 20,
        { color: withAlpha(COLORS.edgeBrown, 50), width: 1 });
      score.setPosition((width - 12) / 2 - 82, 0);
      row.addChild(score);
      parent.addChild(row);
    }
  }

  private renderOfflineState(parent: Node, model: LeaderboardViewModel, actions: LeaderboardViewActions): void {
    const width = Math.min(590, model.uiWidth - 64);
    const state = createUiNode('LeaderboardOfflineState', width, OFFLINE_STATE_HEIGHT);
    state.setPosition(0, this.listRegion(model).center);
    parent.addChild(state);

    this.renderStateCat(state, 'OfflineState', 142, COLORS.coral, true);

    const title = createLabel('排行榜暂时不可用', 30, TITLE_COLOR, width - 44, 54, 'display');
    title.node.setPosition(0, 30);
    state.addChild(title.node);

    const copy = createLabel('网络恢复后，可重新同步好友成绩', 20, TITLE_COLOR, width - 52, 40);
    copy.node.setPosition(0, -18);
    state.addChild(copy.node);

    const status = createUiNode('LeaderboardLocalScoreStatus', 380, 42);
    drawRounded(status, 380, 42, STATUS_PILL_BACKGROUND, 21);
    const local = createLabel(model.localHighScore > 0
      ? `本地最高分 ${formatScore(model.localHighScore)} 已安全保留`
      : '完成一局后，本地成绩会自动保留', 18, CAPTION_COLOR, 350, 36);
    status.addChild(local.node);
    status.setPosition(0, -72);
    state.addChild(status);

    const retry = createButton('重新连接', 270, 68, COLORS.teal, actions.onRetry, 24);
    retry.setPosition(0, -146);
    state.addChild(retry);
  }

  private renderStateCat(parent: Node, name: string, centerY: number, accent: Color,
    showStatusBadge: boolean): void {
    const shadow = createUiNode(`${name}CatShadow`, 160, 160);
    drawRounded(shadow, 160, 160, new Color(0, 0, 0, 15), 80);
    shadow.setPosition(0, centerY - 4);
    parent.addChild(shadow);

    const catWell = createUiNode(`${name}CatWell`, 160, 160);
    drawRounded(catWell, 160, 160, STATE_WELL_BACKGROUND, 80,
      { color: accent, width: 3 });
    const catFrame = this.art.frame(GAME_CONFIG.cats[0].asset);
    if (catFrame) {
      const cat = createSpriteNode(`${name}Cat`, catFrame, 136, 136);
      cat.setPosition(0, 6);
      catWell.addChild(cat);
    }
    catWell.setPosition(0, centerY);
    parent.addChild(catWell);

    if (!showStatusBadge) return;
    const badge = createUiNode(`${name}Badge`, 46, 46);
    drawRounded(badge, 46, 46, COLORS.coral, 23,
      { color: COLORS.white, width: 3 });
    const mark = createLabel('!', 26, COLORS.white, 40, 40, 'display');
    mark.isBold = true;
    badge.addChild(mark.node);
    badge.setPosition(62, centerY + 58);
    parent.addChild(badge);
  }

  private renderEntries(parent: Node, model: LeaderboardViewModel, entries: readonly LeaderboardEntry[]): void {
    const width = Math.min(664, model.uiWidth - 56);
    const region = this.listRegion(model);
    createRankList(parent, {
      entries,
      currentRank: model.data?.me?.rank ?? null,
      width,
      top: region.top,
      bottom: region.bottom,
    }, this.art);
  }
}
