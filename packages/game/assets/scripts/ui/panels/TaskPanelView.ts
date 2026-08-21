import { Color, Graphics, Label, Node } from 'cc';
import type { DailyTaskItem, DailyTaskSnapshot } from '../../features/tasks/dailyTasks';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView } from './ModalView';
import {
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

const MUTED_TEXT = new Color(104, 91, 82, 255);

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
      const row = createTaskRow(item, actions);
      row.setPosition(0, ROW_START_Y - index * ROW_STEP);
      rowsRoot.addChild(row);
    });
  }
}
