import { Color, Graphics, Node } from 'cc';
import type { ArtRepository } from '../utils/ArtRepository';
import { createSpriteNode, createUiNode } from '../utils/uiFactory';

/** Full-bleed cover background from art, or solid fallback if the frame is missing. */
export function addCoverBackground(
  root: Node,
  art: ArtRepository,
  path: string,
  uiWidth: number,
  uiHeight: number,
  fallback: Color,
): void {
  const frame = art.frame(path);
  if (frame) {
    const textureWidth = Math.max(1, frame.texture.width);
    const textureHeight = Math.max(1, frame.texture.height);
    const coverScale = Math.max(uiWidth / textureWidth, uiHeight / textureHeight);
    const background = createSpriteNode(
      'Background',
      frame,
      textureWidth * coverScale,
      textureHeight * coverScale,
    );
    root.addChild(background);
    background.setSiblingIndex(0);
    return;
  }

  const node = createUiNode('Background', uiWidth, uiHeight);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = fallback;
  graphics.rect(-uiWidth / 2, -uiHeight / 2, uiWidth, uiHeight);
  graphics.fill();
  root.addChild(node);
  node.setSiblingIndex(0);
}
