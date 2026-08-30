import { Graphics, Node } from 'cc';
import type { DailyTaskItem, DailyTaskSnapshot } from '../../features/tasks/dailyTasks';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView } from './ModalView';
import {
  COLORS,
  createLabel,
  createUiNode,
} from '../utils/uiFactory';
import { createTaskRow, ROW_WIDTH, TASK_ACCENT } from '../components/tasks/TaskRow';

export interface TaskPanelViewActions {
  readonly onClaim: (taskId: string) => void;
  readonly onClose: () => void;
}

const PANEL_WIDTH = 680;
const PANEL_HEIGHT = 790;
const ROW_STEP = 130;
const ROW_START_Y = 150;

const MUTED_TEXT = COLORS.textMuted;

export class TaskPanelView {
  private rowsRoot: Node | null = null;
  private readonly modal: ModalView;

  public constructor(private readonly art: ArtRepository) {
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
    // 提示行整体居中：时钟图标在左，文案单标签居中，奖励信息已下沉到每行按钮
    const hint = createLabel('每天 00:00 刷新 · 完成任务领金币', 22, MUTED_TEXT, 400, 38, 'body');
    hint.node.setPosition(10, 240);
    panel.addChild(hint.node);

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
    clock.setPosition(-190, 240);
    panel.addChild(clock);
  }

  private renderRows(model: DailyTaskSnapshot, actions: TaskPanelViewActions): void {
    const rowsRoot = this.rowsRoot;
    if (!rowsRoot?.isValid) return;
    model.items.forEach((item, index) => {
      const row = createTaskRow(item, actions, this.art);
      row.setPosition(0, ROW_START_Y - index * ROW_STEP);
      rowsRoot.addChild(row);
    });
  }
}
