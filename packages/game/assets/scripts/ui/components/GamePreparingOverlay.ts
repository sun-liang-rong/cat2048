import { BlockInputEvents, Color, Graphics, Node } from 'cc';
import { COLORS, createLabel, createUiNode, drawRounded } from '../utils/uiFactory';

/**
 * 首页点击开始后、对局资源尚未完成时使用的轻量遮罩。
 * 不依赖任何远程纹理，避免等待层本身再次触发资源请求。
 */
export class GamePreparingOverlay {
  private root: Node | null = null;

  public show(parent: Node, width: number, height: number): () => void {
    this.close();

    const overlay = createUiNode('GamePreparingOverlay', width, height);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = new Color(39, 29, 35, 150);
    dim.rect(-width / 2, -height / 2, width, height);
    dim.fill();

    const panel = createUiNode('GamePreparingPanel', 390, 132);
    drawRounded(panel, 390, 132, COLORS.ink, 28);
    const label = createLabel('正在准备棋盘…', 28, COLORS.white, 340, 54, 'display');
    panel.addChild(label.node);
    overlay.addChild(panel);

    parent.addChild(overlay);
    this.root = overlay;
    return () => this.close();
  }

  public close(): void {
    if (this.root?.isValid) this.root.destroy();
    this.root = null;
  }
}
