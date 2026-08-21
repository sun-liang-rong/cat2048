/**
 * 每日任务行组件（从 TaskPanelView 拆出）。
 * 纯函数组件：接收任务数据与回调，返回渲染好的行 Node。
 */
import { Color, Label, Node, Sprite } from 'cc';
import type { DailyTaskItem, DailyTaskKind } from '../../../features/tasks/dailyTasks';
import { GAME_CONFIG } from '../../../core/config/gameConfig';
import type { ArtRepository } from '../../utils/ArtRepository';
import { MODAL_CARD } from '../../panels/ModalView';
import {
  createButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../../utils/uiFactory';

export const ROW_WIDTH = 620;
export const ROW_HEIGHT = 116;
export const TASK_ACCENT = new Color(82, 181, 159, 255);

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
const TASK_ACCENT_SOFT = new Color(219, 242, 233, 255);
const TASK_RING = new Color(113, 199, 178, 135);
const TRACK_COLOR = new Color(218, 211, 194, 220);
const BUTTON_DISABLED = new Color(178, 175, 170, 255);
const BUTTON_CLAIM = new Color(88, 171, 142, 255);
const BUTTON_CLAIMED = new Color(201, 197, 187, 255);
const BUTTON_EDGE = new Color(128, 121, 112, 210);
const BUTTON_SHADOW = new Color(96, 77, 62, 52);

const KIND_ICONS: Readonly<Record<DailyTaskKind, TaskIconKey>> = {
  'play-runs': 'play',
  'reach-lv5': 'star',
  'use-items': 'bolt',
  'share-once': 'share',
};

type TaskIconKey = 'play' | 'star' | 'bolt' | 'share' | 'check';

export interface TaskRowActions {
  readonly onClaim: (taskId: string) => void;
}

/** 生成一行任务（含阴影、进度条、领取按钮与图标）。 */
export function createTaskRow(item: DailyTaskItem, actions: TaskRowActions, art: ArtRepository): Node {
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
  drawRounded(icon, ICON_SIZE, ICON_SIZE, new Color(255, 253, 245, 255),
    ICON_SIZE / 2, { color: item.claimed ? new Color(178, 174, 164, 150) : TASK_RING, width: 2 });
  // 图标字形：Remix Icon 字体渲染的白色 PNG，运行时按状态着色。
  const iconKey = item.claimed ? 'check' : KIND_ICONS[item.kind];
  const iconFrame = art.frame(GAME_CONFIG.art.taskIcons[iconKey]);
  if (iconFrame) {
    const glyph = createSpriteNode(`TaskGlyph:${item.id}`, iconFrame, 52, 52);
    const glyphSprite = glyph.getComponent(Sprite);
    if (glyphSprite) glyphSprite.color = item.claimed ? new Color(154, 150, 141, 255) : TASK_ACCENT;
    icon.addChild(glyph);
  }
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

  const button = claimButton(item, actions);
  button.setPosition(BUTTON_CENTER_X, 0);
  row.addChild(button);
  return row;
}

function claimButton(item: DailyTaskItem, actions: TaskRowActions): Node {
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
