import { Color, Node, tween, Tween, Vec3 } from 'cc';
import { COLORS, createButton, createLabel, createUiNode, drawRounded, withAlpha } from '../utils/uiFactory';
import { MODAL_FILL } from '../panels/ModalView';

export class TutorialView {
  private swipeOverlay: Node | null = null;
  private swipeArrow: Node | null = null;

  public showSwipe(parent: Node, uiWidth: number, uiHeight: number, boardY: number, boardSize: number,
    onSkip: () => void): void {
    this.dismissSwipe();
    const overlay = createUiNode('SwipeTutorial', uiWidth, uiHeight);
    this.swipeOverlay = overlay;
    parent.addChild(overlay);

    const shade = withAlpha(COLORS.overlay, 175);
    const topEdge = boardY + boardSize / 2;
    const bottomEdge = boardY - boardSize / 2;
    this.addShade(overlay, 'GuideShadeTop', uiWidth, Math.max(0, uiHeight / 2 - topEdge), 0,
      topEdge + Math.max(0, uiHeight / 2 - topEdge) / 2, shade);
    this.addShade(overlay, 'GuideShadeBottom', uiWidth, Math.max(0, bottomEdge + uiHeight / 2), 0,
      -uiHeight / 2 + Math.max(0, bottomEdge + uiHeight / 2) / 2, shade);
    const sideWidth = Math.max(0, (uiWidth - boardSize) / 2);
    this.addShade(overlay, 'GuideShadeLeft', sideWidth, boardSize,
      -uiWidth / 2 + sideWidth / 2, boardY, shade);
    this.addShade(overlay, 'GuideShadeRight', sideWidth, boardSize,
      uiWidth / 2 - sideWidth / 2, boardY, shade);

    const hint = createUiNode('SwipeGuideHint', 470, 118);
    drawRounded(hint, 470, 118, MODAL_FILL, 28, { color: COLORS.ink, width: 4 });
    hint.setPosition(0, boardSize < 620 ? topEdge - 72 : Math.min(uiHeight / 2 - 120, topEdge + 78));
    const title = createLabel('上下左右滑动猫咪', 28, COLORS.coral, 430, 46, 'display');
    title.node.setPosition(0, 20);
    hint.addChild(title.node);
    const body = createLabel('相同猫咪相遇会合成升级', 21, COLORS.ink, 420, 38);
    body.node.setPosition(0, -24);
    hint.addChild(body.node);
    overlay.addChild(hint);

    const arrow = createLabel('↑  ↓  ←  →', 44, COLORS.white, 340, 88, 'display');
    arrow.node.setPosition(0, boardY);
    this.swipeArrow = arrow.node;
    overlay.addChild(arrow.node);
    tween(arrow.node)
      .to(0.7, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'sineInOut' })
      .to(0.7, { scale: Vec3.ONE }, { easing: 'sineInOut' })
      .union().repeatForever().start();

    const skip = createButton('跳过', 150, 60, COLORS.teal, () => {
      this.dismissSwipe();
      onSkip();
    }, 22);
    skip.setPosition(Math.min(uiWidth / 2 - 100, boardSize / 2 - 90), bottomEdge + 42);
    overlay.addChild(skip);
  }

  public dismissSwipe(): void {
    if (!this.swipeOverlay) return;
    if (this.swipeArrow) Tween.stopAllByTarget(this.swipeArrow);
    this.swipeOverlay.destroy();
    this.swipeOverlay = null;
    this.swipeArrow = null;
  }

  private addShade(parent: Node, name: string, width: number, height: number, x: number, y: number,
    color: Color): void {
    if (width <= 0 || height <= 0) return;
    const shade = createUiNode(name, width, height);
    drawRounded(shade, width, height, color, 0);
    shade.setPosition(x, y);
    parent.addChild(shade);
  }
}
