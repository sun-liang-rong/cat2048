import {
  BlockInputEvents,
  Graphics,
  Node,
  tween,
  Vec3,
} from 'cc';
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

export interface DialogActions {
  onConfirm: () => void;
  onCancel?: () => void;
}

export class DialogView {
  public constructor(
    private readonly art: ArtRepository,
    private readonly getSize: () => { width: number; height: number },
  ) {}

  public show(
    parent: Node,
    titleText: string,
    bodyText: string,
    cancelText: string,
    confirmText: string,
    actions: DialogActions,
  ): void {
    const { width, height } = this.getSize();
    const overlay = createUiNode('DialogOverlay', width, height);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = COLORS.overlay;
    dim.rect(-width / 2, -height / 2, width, height);
    dim.fill();
    parent.addChild(overlay);
    const panel = createUiNode('DialogPanel', 590, 430);
    drawRounded(panel, 590, 430, COLORS.ivory, 38, { color: COLORS.ink, width: 6 });
    overlay.addChild(panel);
    const closeFrame = this.art.frame(GAME_CONFIG.art.close);
    if (closeFrame) {
      const close = createIconButton('DialogClose', closeFrame, '×', 66, () => {
        overlay.destroy();
        actions.onCancel?.();
      });
      close.setPosition(258, 188);
      panel.addChild(close);
    }
    const title = createLabel(titleText, 46, COLORS.coral, 500, 70, 'display');
    title.node.setPosition(0, 125);
    panel.addChild(title.node);
    const body = createLabel(bodyText, 28, COLORS.ink, 490, 130);
    body.node.setPosition(0, 30);
    panel.addChild(body.node);
    const cancel = createButton(cancelText, 230, 78, COLORS.teal, () => {
      overlay.destroy();
      actions.onCancel?.();
    }, 28);
    cancel.setPosition(-135, -125);
    panel.addChild(cancel);
    const confirm = createButton(confirmText, 230, 78, COLORS.coral, () => {
      overlay.destroy();
      actions.onConfirm();
    }, 28);
    confirm.setPosition(135, -125);
    panel.addChild(confirm);
    panel.setScale(0.8, 0.8, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  }
}
