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
  createUiNode,
  drawRounded,
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

const TITLE_COLOR = new Color(91, 49, 31, 255);
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
    renderPaperSurface(strip, stripWidth, MY_RANK_HEIGHT, false, this.art);
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
      renderPaperSurface(row, width - 12, ROW_HEIGHT, false, this.art);
      row.setPosition(0, region.top - 92 - index * 100);
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
    renderPaperSurface(state, width, OFFLINE_STATE_HEIGHT, false, this.art);
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
    createRankList(parent, {
      entries,
      currentRank: model.data?.me?.rank ?? null,
      width,
      top: region.top,
      bottom: region.bottom,
    }, this.art);
  }
}
