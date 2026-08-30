/**
 * 每日任务行组件（从 TaskPanelView 拆出）。
 * 纯函数组件：接收任务数据与回调，返回渲染好的行 Node。
 *
 * 行内布局：图标 | 任务名 + 进度条(含 0/3 计数) | 奖励/领取按钮。
 * 按钮三态：未完成露出金币奖励、可领取绿色脉冲、已领取置灰。
 */
import { Color, Label, Node, Sprite, tween, UIOpacity, Vec3 } from 'cc';
import type { DailyTaskItem } from '../../../features/tasks/dailyTasks';
import { GAME_CONFIG } from '../../../core/config/gameConfig';
import type { ArtRepository } from '../../utils/ArtRepository';
import { MODAL_CARD } from '../../panels/ModalView';
import {
  COLORS,
  bindTapFeedback,
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
const TASK_NAME_WIDTH = 320;
const TASK_NAME_CENTER_X = CONTENT_LEFT + TASK_NAME_WIDTH / 2;
const BAR_WIDTH = 260;
const BAR_HEIGHT = 16;
const BAR_CENTER_X = CONTENT_LEFT + BAR_WIDTH / 2;
const COUNT_WIDTH = 72;
const COUNT_CENTER_X = CONTENT_LEFT + BAR_WIDTH + 26 + COUNT_WIDTH / 2;
const BUTTON_WIDTH = 132;
const BUTTON_HEIGHT = 64;
const BUTTON_CENTER_X = ROW_WIDTH / 2 - 78;

const ROW_EDGE = new Color(246, 231, 204, 255);
const ROW_SHADOW = new Color(205, 184, 147, 48);
const TITLE_COLOR = new Color(91, 53, 39, 255);
const TASK_ACCENT_SOFT = new Color(219, 242, 233, 255);
const TASK_RING = new Color(113, 199, 178, 135);
const TRACK_COLOR = new Color(218, 211, 194, 220);
const BUTTON_REWARD_FILL = new Color(247, 233, 205, 255);
const BUTTON_REWARD_TEXT = new Color(176, 127, 52, 255);
const BUTTON_CLAIM = new Color(88, 171, 142, 255);
const BUTTON_CLAIMED = new Color(208, 204, 194, 255);
const BUTTON_EDGE = new Color(128, 121, 112, 210);
const BUTTON_SHADOW = new Color(96, 77, 62, 52);
const CLAIMED_ROW_OPACITY = 205;

const KIND_ICONS: Readonly<Record<DailyTaskItem['kind'], TaskIconKey>> = {
  'play-runs': 'play',
  'reach-lv5': 'star',
  'use-items': 'bolt',
  'share-once': 'share',
};

type TaskIconKey = 'play' | 'star' | 'bolt' | 'share' | 'check';

export interface TaskRowActions {
  readonly onClaim: (taskId: string) => void;
}

/** 生成一行任务（含阴影、进度条、奖励/领取按钮与图标）。 */
export function createTaskRow(item: DailyTaskItem, actions: TaskRowActions, art: ArtRepository): Node {
  const completed = item.progress >= item.target;
  const claimable = completed && !item.claimed;

  const row = createUiNode(`TaskRow:${item.id}`, ROW_WIDTH, ROW_HEIGHT);
  if (item.claimed) {
    // 已领取的行整体退后，把视觉重心让给待办任务
    row.addComponent(UIOpacity).opacity = CLAIMED_ROW_OPACITY;
  }
  const rowShadow = createUiNode(`TaskRowShadow:${item.id}`, ROW_WIDTH + 4, ROW_HEIGHT + 9);
  drawRounded(rowShadow, ROW_WIDTH + 4, ROW_HEIGHT + 9, ROW_SHADOW, 24);
  rowShadow.setPosition(0, -6);
  row.addChild(rowShadow);

  // 可领取的行用绿色描边高亮，与普通行区分
  const surface = createUiNode(`TaskRowSurface:${item.id}`, ROW_WIDTH, ROW_HEIGHT);
  drawRounded(surface, ROW_WIDTH, ROW_HEIGHT, MODAL_CARD, 22, {
    color: claimable ? TASK_ACCENT : ROW_EDGE,
    width: claimable ? 3 : 2,
  });
  row.addChild(surface);

  const icon = createUiNode(`TaskIcon:${item.id}`, ICON_SIZE, ICON_SIZE);
  drawRounded(icon, ICON_SIZE, ICON_SIZE,
    item.claimed ? new Color(236, 233, 226, 255) : TASK_ACCENT_SOFT,
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
  name.node.setPosition(TASK_NAME_CENTER_X, 24);
  row.addChild(name.node);

  // 进度条 + 「0/3」计数：合并展示，替代原先胶囊+细条双份信息
  const bar = createUiNode(`TaskBar:${item.id}`, BAR_WIDTH, BAR_HEIGHT);
  drawRounded(bar, BAR_WIDTH, BAR_HEIGHT, TRACK_COLOR, BAR_HEIGHT / 2);
  bar.setPosition(BAR_CENTER_X, -26);
  row.addChild(bar);
  const fillRatio = item.target > 0 ? Math.min(1, item.progress / item.target) : 0;
  const fillWidth = Math.max(BAR_WIDTH * fillRatio, fillRatio > 0 ? BAR_HEIGHT : 0);
  if (fillWidth > 0) {
    const fill = createUiNode(`TaskBarFill:${item.id}`, fillWidth, BAR_HEIGHT);
    drawRounded(fill, fillWidth, BAR_HEIGHT,
      item.claimed ? new Color(167, 166, 153, 230) : TASK_ACCENT,
      Math.min(BAR_HEIGHT / 2, fillWidth / 2));
    fill.setPosition(-BAR_WIDTH / 2 + fillWidth / 2, 0);
    bar.addChild(fill);
  }
  const countColor = item.claimed
    ? new Color(143, 137, 128, 255)
    : fillRatio >= 1 ? new Color(70, 157, 113, 255) : COLORS.textBody;
  const count = createLabel(`${item.progress}/${item.target}`, 20, countColor,
    COUNT_WIDTH, 30, 'display');
  count.node.setPosition(COUNT_CENTER_X, -26);
  row.addChild(count.node);

  const buttonShadow = createUiNode(`TaskButtonShadow:${item.id}`, BUTTON_WIDTH + 4, BUTTON_HEIGHT + 10);
  drawRounded(buttonShadow, BUTTON_WIDTH + 4, BUTTON_HEIGHT + 10, BUTTON_SHADOW, BUTTON_HEIGHT / 2 + 4);
  buttonShadow.setPosition(BUTTON_CENTER_X, -6);
  row.addChild(buttonShadow);

  const button = claimButton(item, actions, art);
  button.setPosition(BUTTON_CENTER_X, 0);
  row.addChild(button);

  if (claimable) {
    // 可领取时按钮轻微脉冲，引导点击
    tween(button)
      .to(0.7, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' })
      .to(0.7, { scale: Vec3.ONE }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
  }
  return row;
}

function claimButton(item: DailyTaskItem, actions: TaskRowActions, art: ArtRepository): Node {
  const claimed = item.claimed;
  const completed = item.progress >= item.target;
  const node = createUiNode(`TaskButton:${item.id}`, BUTTON_WIDTH, BUTTON_HEIGHT);

  if (claimed) {
    drawRounded(node, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_CLAIMED, BUTTON_HEIGHT / 2,
      { color: BUTTON_EDGE, width: 2 });
    const label = createLabel('已领取', 22, new Color(120, 115, 106, 255),
      BUTTON_WIDTH - 16, BUTTON_HEIGHT - 12, 'display');
    node.addChild(label.node);
    bindTapFeedback(node, () => undefined);
    return node;
  }

  if (completed) {
    drawRounded(node, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_CLAIM, BUTTON_HEIGHT / 2,
      { color: BUTTON_EDGE, width: 2 });
    const label = createLabel('领取', 26, COLORS.white, BUTTON_WIDTH - 16, BUTTON_HEIGHT - 12, 'display');
    node.addChild(label.node);
    bindTapFeedback(node, () => actions.onClaim(item.id));
    return node;
  }

  // 未完成：露出奖励金额（金币图标 + 数字），传达"做完能赚多少"
  drawRounded(node, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_REWARD_FILL, BUTTON_HEIGHT / 2,
    { color: BUTTON_EDGE, width: 2 });
  const coinFrame = art.frame(GAME_CONFIG.art.coin);
  if (coinFrame) {
    const coin = createSpriteNode(`TaskButton:${item.id}:Coin`, coinFrame, 40, 40);
    coin.setPosition(-32, 0);
    node.addChild(coin);
  }
  const label = createLabel(`+${item.rewardCoins}`, 24, BUTTON_REWARD_TEXT,
    BUTTON_WIDTH - 56, BUTTON_HEIGHT - 12, 'display');
  label.node.setPosition(coinFrame ? 14 : 0, 0);
  node.addChild(label.node);
  bindTapFeedback(node, () => undefined);
  return node;
}
