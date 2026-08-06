import {
  BlockInputEvents,
  Graphics,
  Node,
  tween,
  UIOpacity,
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
  auxiliary?: {
    readonly text: string;
    readonly onTap: () => void;
  };
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
    const panelHeight = actions.auxiliary ? 540 : 430;
    const panel = createUiNode('DialogPanel', 590, panelHeight);
    drawRounded(panel, 590, panelHeight, COLORS.ivory, 38, { color: COLORS.ink, width: 6 });
    overlay.addChild(panel);
    const closeFrame = this.art.frame(GAME_CONFIG.art.close);
    if (closeFrame) {
      const close = createIconButton('DialogClose', closeFrame, '×', 66, () => {
        overlay.destroy();
        actions.onCancel?.();
      });
      close.setPosition(258, panelHeight / 2 - 27);
      panel.addChild(close);
    }
    const title = createLabel(titleText, 46, COLORS.coral, 500, 70, 'display');
    title.node.setPosition(0, actions.auxiliary ? 180 : 125);
    panel.addChild(title.node);
    const body = createLabel(bodyText, 28, COLORS.ink, 490, 130);
    body.node.setPosition(0, actions.auxiliary ? 86 : 30);
    panel.addChild(body.node);
    if (actions.auxiliary) {
      const auxiliary = createButton(actions.auxiliary.text, 500, 78, COLORS.mustard,
        actions.auxiliary.onTap, 30, this.art.frame(GAME_CONFIG.art.share));
      auxiliary.setPosition(0, -58);
      panel.addChild(auxiliary);
    }
    const cancel = createButton(cancelText, 230, 78, COLORS.teal, () => {
      overlay.destroy();
      actions.onCancel?.();
    }, 28);
    cancel.setPosition(-135, actions.auxiliary ? -180 : -125);
    panel.addChild(cancel);
    const confirm = createButton(confirmText, 230, 78, COLORS.coral, () => {
      overlay.destroy();
      actions.onConfirm();
    }, 28);
    confirm.setPosition(135, actions.auxiliary ? -180 : -125);
    panel.addChild(confirm);
    panel.setScale(0.8, 0.8, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  }

  public showNotice(parent: Node | null, text: string): void {
    if (!parent) return;
    const { height } = this.getSize();
    const notice = createUiNode('ShareNotice', 500, 78);
    drawRounded(notice, 500, 78, COLORS.ink, 24);
    const label = createLabel(text, 24, COLORS.white, 450, 60);
    notice.addChild(label.node);
    notice.setPosition(0, -height / 2 + 132);
    const opacity = notice.addComponent(UIOpacity);
    opacity.opacity = 0;
    parent.addChild(notice);
    tween(opacity)
      .to(0.12, { opacity: 255 })
      .delay(1.8)
      .to(0.2, { opacity: 0 })
      .call(() => notice.destroy())
      .start();
  }
}
