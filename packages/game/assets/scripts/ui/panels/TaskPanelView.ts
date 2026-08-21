import { Color, Graphics, Label, Node } from 'cc';
import type { DailyTaskItem, DailyTaskSnapshot, DailyTaskKind } from '../../features/tasks/dailyTasks';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView, MODAL_CARD } from './ModalView';
import {
  createButton,
  createLabel,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';

export interface TaskPanelViewActions {
  readonly onClaim: (taskId: string) => void;
  readonly onClose: () => void;
}

const PANEL_WIDTH = 680;
const PANEL_HEIGHT = 790;
const ROW_WIDTH = 620;
const ROW_HEIGHT = 116;
const ROW_STEP = 130;
const ROW_START_Y = 150;
const ICON_SIZE = 82;
const ICON_CENTER_X = -ROW_WIDTH / 2 + 58;
const CONTENT_LEFT = -ROW_WIDTH / 2 + 118;
const TASK_NAME_WIDTH = 238;
const TASK_NAME_CENTER_X = CONTENT_LEFT + TASK_NAME_WIDTH / 2;
const PROGRESS_CENTER_X = CONTENT_LEFT + 287;
const PROGRESS_WIDTH = 80;
const PROGRESS_HEIGHT = 38;
const BAR_WIDTH = 270;
const BAR_HEIGHT = 14;
const BUTTON_WIDTH = 132;
const BUTTON_HEIGHT = 64;
const BUTTON_CENTER_X = ROW_WIDTH / 2 - 78;

const ROW_EDGE = new Color(246, 231, 204, 255);
const ROW_SHADOW = new Color(205, 184, 147, 48);
const TITLE_COLOR = new Color(91, 53, 39, 255);
const MUTED_TEXT = new Color(104, 91, 82, 255);
const TASK_ACCENT = new Color(82, 181, 159, 255);
const TASK_ACCENT_SOFT = new Color(219, 242, 233, 255);
const TASK_RING = new Color(113, 199, 178, 135);
const TRACK_COLOR = new Color(218, 211, 194, 220);
const BUTTON_DISABLED = new Color(178, 175, 170, 255);
const BUTTON_CLAIM = new Color(88, 171, 142, 255);
const BUTTON_CLAIMED = new Color(201, 197, 187, 255);
const BUTTON_EDGE = new Color(128, 121, 112, 210);
const BUTTON_SHADOW = new Color(96, 77, 62, 52);

const KIND_GLYPHS: Readonly<Record<DailyTaskKind, string>> = {
  'play-runs': 'play',
  'reach-lv5': 'star',
  'use-items': 'bolt',
  'share-once': 'share',
};

export class TaskPanelView {
  private rowsRoot: Node | null = null;
  private readonly modal: ModalView;

  public constructor(art: ArtRepository) {
    this.modal = new ModalView(art, () => ({ width: 0, height: 0 }));
  }

  public show(parent: Node, model: DailyTaskSnapshot, width: number, height: number,
    actions: TaskPanelViewActions): Node {
    const { overlay, panel } = this.modal.open(parent, {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      overlayWidth: width,
      overlayHeight: height,
      title: '每日任务',
      // 头部有“每天 00:00 刷新”提示文案，省略标题下方的圆点装饰。
      titleDots: false,
      onClose: actions.onClose,
    });

    this.addHeader(panel);

    this.rowsRoot = createUiNode('TaskRows', ROW_WIDTH, 540);
    // 整体上移 8px，给底部山丘装饰留出间隙。
    this.rowsRoot.setPosition(0, 8);
    panel.addChild(this.rowsRoot);
    this.renderRows(model, actions);
    return overlay;
  }

  public refresh(model: DailyTaskSnapshot, actions: TaskPanelViewActions): void {
    const rowsRoot = this.rowsRoot;
    if (!rowsRoot?.isValid) return;
    for (const child of [...rowsRoot.children]) child.destroy();
    this.renderRows(model, actions);
  }

  private addHeader(panel: Node): void {
    const header = createUiNode('TaskHeaderHint', 520, 44);
    const clock = createUiNode('TaskHeaderClock', 28, 28);
    const clockGraphics = clock.addComponent(Graphics);
    clockGraphics.strokeColor = TASK_ACCENT;
    clockGraphics.lineWidth = 3;
    clockGraphics.circle(0, 0, 10);
    clockGraphics.stroke();
    clockGraphics.moveTo(0, 0);
    clockGraphics.lineTo(0, 6);
    clockGraphics.moveTo(0, 0);
    clockGraphics.lineTo(5, -3);
    clockGraphics.stroke();
    clock.setPosition(-245, 240);
    header.addChild(clock);

    const refresh = createLabel('每天 00:00 刷新 ·', 22, MUTED_TEXT, 230, 38, 'body');
    refresh.horizontalAlign = Label.HorizontalAlign.LEFT;
    refresh.node.setPosition(-106, 240);
    header.addChild(refresh.node);

    const reward = createLabel('完成任务领金币', 22, new Color(61, 154, 123, 255), 190, 38, 'body');
    reward.horizontalAlign = Label.HorizontalAlign.LEFT;
    reward.node.setPosition(100, 240);
    header.addChild(reward.node);
    panel.addChild(header);
  }

  private renderRows(model: DailyTaskSnapshot, actions: TaskPanelViewActions): void {
    const rowsRoot = this.rowsRoot;
    if (!rowsRoot?.isValid) return;
    model.items.forEach((item, index) => {
      const row = this.createRow(item, actions);
      row.setPosition(0, ROW_START_Y - index * ROW_STEP);
      rowsRoot.addChild(row);
    });
  }

  private createRow(item: DailyTaskItem, actions: TaskPanelViewActions): Node {
    const row = createUiNode(`TaskRow:${item.id}`, ROW_WIDTH, ROW_HEIGHT);
    const rowShadow = createUiNode(`TaskRowShadow:${item.id}`, ROW_WIDTH + 4, ROW_HEIGHT + 9);
    drawRounded(rowShadow, ROW_WIDTH + 4, ROW_HEIGHT + 9, ROW_SHADOW, 24);
    rowShadow.setPosition(0, -6);
    row.addChild(rowShadow);

    const surface = createUiNode(`TaskRowSurface:${item.id}`, ROW_WIDTH, ROW_HEIGHT);
    drawRounded(surface, ROW_WIDTH, ROW_HEIGHT, MODAL_CARD, 22,
      { color: ROW_EDGE, width: 2 });
    row.addChild(surface);

    const completed = item.progress >= item.target;
    const icon = createUiNode(`TaskIcon:${item.id}`, ICON_SIZE, ICON_SIZE);
    const iconGraphics = drawRounded(icon, ICON_SIZE, ICON_SIZE, new Color(255, 253, 245, 255),
      ICON_SIZE / 2, { color: item.claimed ? new Color(178, 174, 164, 150) : TASK_RING, width: 2 });
    this.drawTaskGlyph(iconGraphics, item.claimed ? 'check' : KIND_GLYPHS[item.kind],
      item.claimed ? new Color(154, 150, 141, 255) : TASK_ACCENT);
    icon.setPosition(ICON_CENTER_X, 0);
    row.addChild(icon);

    const name = createLabel(item.name, 24, TITLE_COLOR, TASK_NAME_WIDTH, 38, 'body');
    name.horizontalAlign = Label.HorizontalAlign.LEFT;
    name.node.setPosition(TASK_NAME_CENTER_X, 22);
    row.addChild(name.node);

    const progressPill = createUiNode(`TaskProgress:${item.id}`, PROGRESS_WIDTH, PROGRESS_HEIGHT);
    const progressColor = item.claimed
      ? new Color(232, 228, 218, 255)
      : completed ? new Color(228, 242, 218, 255) : TASK_ACCENT_SOFT;
    drawRounded(progressPill, PROGRESS_WIDTH, PROGRESS_HEIGHT, progressColor, PROGRESS_HEIGHT / 2);
    progressPill.setPosition(PROGRESS_CENTER_X, 22);
    const progress = createLabel(`${item.progress}/${item.target}`, 21,
      item.claimed ? new Color(143, 137, 128, 255) : completed ? new Color(70, 157, 113, 255) : TASK_ACCENT,
      PROGRESS_WIDTH - 8, PROGRESS_HEIGHT - 6, 'body');
    progressPill.addChild(progress.node);
    row.addChild(progressPill);

    const bar = createUiNode(`TaskBar:${item.id}`, BAR_WIDTH, BAR_HEIGHT);
    drawRounded(bar, BAR_WIDTH, BAR_HEIGHT, TRACK_COLOR, BAR_HEIGHT / 2);
    bar.setPosition(CONTENT_LEFT + BAR_WIDTH / 2, -27);
    row.addChild(bar);
    const fillRatio = item.target > 0 ? Math.min(1, item.progress / item.target) : 0;
    const fillWidth = BAR_WIDTH * fillRatio;
    if (fillWidth > 0) {
      const fill = createUiNode(`TaskBarFill:${item.id}`, fillWidth, BAR_HEIGHT);
      drawRounded(fill, fillWidth, BAR_HEIGHT, item.claimed ? new Color(167, 166, 153, 230) : TASK_ACCENT,
        Math.min(BAR_HEIGHT / 2, fillWidth / 2));
      fill.setPosition(-BAR_WIDTH / 2 + fillWidth / 2, 0);
      bar.addChild(fill);
    }

    const buttonShadow = createUiNode(`TaskButtonShadow:${item.id}`, BUTTON_WIDTH + 4, BUTTON_HEIGHT + 10);
    drawRounded(buttonShadow, BUTTON_WIDTH + 4, BUTTON_HEIGHT + 10, BUTTON_SHADOW, BUTTON_HEIGHT / 2 + 4);
    buttonShadow.setPosition(BUTTON_CENTER_X, -6);
    row.addChild(buttonShadow);

    const button = this.claimButton(item, actions);
    button.setPosition(BUTTON_CENTER_X, 0);
    row.addChild(button);
    return row;
  }

  private claimButton(item: DailyTaskItem, actions: TaskPanelViewActions): Node {
    const claimed = item.claimed;
    const completed = item.progress >= item.target;
    const text = claimed ? '已领取' : completed ? `领取 +${item.rewardCoins}` : '未完成';
    const color = claimed ? BUTTON_CLAIMED : completed ? BUTTON_CLAIM : BUTTON_DISABLED;
    const button = createButton(text, BUTTON_WIDTH, BUTTON_HEIGHT, color,
      completed && !claimed ? () => actions.onClaim(item.id) : () => undefined, 22);
    drawRounded(button, BUTTON_WIDTH, BUTTON_HEIGHT, color, BUTTON_HEIGHT / 2,
      { color: BUTTON_EDGE, width: 2 });
    return button;
  }

  private drawTaskGlyph(graphics: Graphics, glyph: string, color: Color): void {
    graphics.fillColor = color;
    graphics.strokeColor = color;
    graphics.lineWidth = 5;
    if (glyph === 'play') {
      graphics.moveTo(-12, -18);
      graphics.lineTo(18, 0);
      graphics.lineTo(-12, 18);
      graphics.close();
      graphics.fill();
      return;
    }
    if (glyph === 'star') {
      const points: Array<[number, number]> = [];
      for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        const radius = index % 2 === 0 ? 20 : 8;
        points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
      graphics.moveTo(points[0][0], points[0][1]);
      for (const [x, y] of points.slice(1)) graphics.lineTo(x, y);
      graphics.close();
      graphics.fill();
      return;
    }
    if (glyph === 'bolt') {
      graphics.moveTo(5, 21);
      graphics.lineTo(-14, -1);
      graphics.lineTo(-2, -1);
      graphics.lineTo(-6, -21);
      graphics.lineTo(14, 2);
      graphics.lineTo(3, 2);
      graphics.close();
      graphics.fill();
      return;
    }
    if (glyph === 'share') {
      graphics.moveTo(-13, -14);
      graphics.lineTo(14, 16);
      graphics.stroke();
      graphics.moveTo(1, 16);
      graphics.lineTo(14, 16);
      graphics.lineTo(14, 3);
      graphics.stroke();
      return;
    }
    graphics.moveTo(-15, 0);
    graphics.lineTo(-5, -10);
    graphics.lineTo(15, 11);
    graphics.moveTo(15, 11);
    graphics.lineTo(2, 11);
    graphics.moveTo(15, 11);
    graphics.lineTo(15, -2);
    graphics.stroke();
  }
}
