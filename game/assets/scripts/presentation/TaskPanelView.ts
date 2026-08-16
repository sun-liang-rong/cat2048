import { BlockInputEvents, Color, Graphics, Node, Vec3, tween } from 'cc';
import type { DailyTaskItem, DailyTaskSnapshot, DailyTaskKind } from '../infrastructure/dailyTasks';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createUiNode,
  drawRounded,
} from './uiFactory';

export interface TaskPanelViewActions {
  readonly onClaim: (taskId: string) => void;
  readonly onClose: () => void;
}

const ROW_WIDTH = 500;
const ROW_HEIGHT = 100;
const ROW_STEP = 108;
const ICON_CENTER_X = -ROW_WIDTH / 2 + 44;
const MIDDLE_LEFT = -ROW_WIDTH / 2 + 82;
const MIDDLE_WIDTH = 206;
const BUTTON_CENTER_X = ROW_WIDTH / 2 - 76;
const DONE_COLOR = new Color(157, 148, 135, 210);
const KIND_GLYPHS: Readonly<Record<DailyTaskKind, string>> = {
  'play-runs': '▶',
  'reach-lv5': '★',
  'use-items': '⚡',
  'share-once': '↗',
};

export class TaskPanelView {
  private rowsRoot: Node | null = null;

  public constructor(private readonly art: ArtRepository) {}

  public show(parent: Node, model: DailyTaskSnapshot, width: number, height: number,
    actions: TaskPanelViewActions): Node {
    const overlay = createUiNode('TaskPanelOverlay', width, height);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = COLORS.overlay;
    dim.rect(-width / 2, -height / 2, width, height);
    dim.fill();
    parent.addChild(overlay);

    const panel = createUiNode('TaskPanel', 540, 640);
    drawRounded(panel, 540, 640, COLORS.ivory, 34, { color: COLORS.ink, width: 5 });
    overlay.addChild(panel);

    const close = createIconButton('TaskPanelClose', this.art.frame(GAME_CONFIG.art.close), '×', 60,
      actions.onClose);
    close.setPosition(232, 272);
    panel.addChild(close);

    const title = createLabel('每日任务', 42, COLORS.coral, 400, 64, 'display');
    title.node.setPosition(0, 232);
    panel.addChild(title.node);

    const subtitle = createLabel('每天 00:00 刷新 · 完成任务领金币', 20, COLORS.teal, 420, 40, 'display');
    subtitle.node.setScale(0.94, 0.94, 1);
    subtitle.node.setPosition(0, 178);
    panel.addChild(subtitle.node);

    this.rowsRoot = createUiNode('TaskRows', ROW_WIDTH, 452);
    this.rowsRoot.setPosition(0, -62);
    panel.addChild(this.rowsRoot);
    this.renderRows(model, actions);

    panel.setScale(0.82, 0.82, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    return overlay;
  }

  public refresh(model: DailyTaskSnapshot, actions: TaskPanelViewActions): void {
    const rowsRoot = this.rowsRoot;
    if (!rowsRoot?.isValid) return;
    for (const child of [...rowsRoot.children]) child.destroy();
    this.renderRows(model, actions);
  }

  private renderRows(model: DailyTaskSnapshot, actions: TaskPanelViewActions): void {
    const rowsRoot = this.rowsRoot;
    if (!rowsRoot?.isValid) return;
    const startY = 232 - ROW_HEIGHT / 2;
    model.items.forEach((item, index) => {
      const row = this.createRow(item, actions);
      row.setPosition(0, startY - index * ROW_STEP);
      rowsRoot.addChild(row);
    });
  }

  private createRow(item: DailyTaskItem, actions: TaskPanelViewActions): Node {
    const row = createUiNode(`TaskRow:${item.id}`, ROW_WIDTH, ROW_HEIGHT);
    drawRounded(row, ROW_WIDTH, ROW_HEIGHT, new Color(255, 249, 230, 250), 22,
      { color: new Color(77, 61, 54, 150), width: 2 });

    const icon = createUiNode(`TaskIcon:${item.id}`, 52, 52);
    drawRounded(icon, 52, 52, new Color(255, 246, 222, 255), 26,
      { color: item.claimed ? DONE_COLOR : COLORS.teal, width: 3 });
    const glyph = createLabel(item.claimed ? '✓' : KIND_GLYPHS[item.kind], 26, item.claimed ? DONE_COLOR : COLORS.teal,
      46, 46, 'display');
    icon.addChild(glyph.node);
    icon.setPosition(ICON_CENTER_X, 0);
    row.addChild(icon);

    const name = createLabel(item.name, 20, COLORS.ink, 150, 30, 'display');
    name.horizontalAlign = Label.HorizontalAlign.LEFT;
    name.node.setPosition(MIDDLE_LEFT + 75, 22);
    row.addChild(name.node);

    const completed = item.progress >= item.target;
    const progressPill = createUiNode(`TaskProgress:${item.id}`, 70, 30);
    drawRounded(progressPill, 70, 30, item.claimed ? new Color(229, 222, 210, 255)
      : completed ? new Color(255, 236, 190, 255) : new Color(224, 244, 238, 255), 15);
    progressPill.setPosition(MIDDLE_LEFT + MIDDLE_WIDTH - 35, 22);
    const progress = createLabel(`${item.progress}/${item.target}`, 19,
      item.claimed ? DONE_COLOR : completed ? COLORS.coral : COLORS.teal, 64, 26, 'display');
    progressPill.addChild(progress.node);
    row.addChild(progressPill);

    const barWidth = MIDDLE_WIDTH;
    const bar = createUiNode(`TaskBar:${item.id}`, barWidth, 12);
    drawRounded(bar, barWidth, 12, new Color(77, 61, 54, 70), 6);
    bar.setPosition(MIDDLE_LEFT + barWidth / 2, -24);
    row.addChild(bar);
    const fillRatio = item.target > 0 ? Math.min(1, item.progress / item.target) : 0;
    const fillWidth = barWidth * fillRatio;
    if (fillWidth > 0) {
      const fillColor = item.claimed ? DONE_COLOR : completed ? COLORS.mustard : COLORS.teal;
      const fill = createUiNode(`TaskBarFill:${item.id}`, fillWidth, 12);
      drawRounded(fill, fillWidth, 12, fillColor, Math.min(6, fillWidth / 2));
      fill.setPosition(-barWidth / 2 + fillWidth / 2, 0);
      bar.addChild(fill);
    }

    const button = this.claimButton(item, actions);
    button.setPosition(BUTTON_CENTER_X, 0);
    row.addChild(button);
    return row;
  }

  private claimButton(item: DailyTaskItem, actions: TaskPanelViewActions): Node {
    if (item.claimed) {
      return createButton('已领取', 128, 52, DONE_COLOR, () => undefined, 19);
    }
    if (item.progress >= item.target) {
      return createButton(`领取 +${item.rewardCoins}`, 128, 52, COLORS.coral,
        () => actions.onClaim(item.id), 19);
    }
    return createButton('未完成', 128, 52, new Color(157, 148, 135, 210), () => undefined, 19);
  }
}
