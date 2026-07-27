import {
  Color,
  Graphics,
  Label,
  Layers,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  UITransform,
  Vec3,
} from 'cc';

export const COLORS = {
  ink: new Color(60, 48, 44, 255),
  ivory: new Color(255, 247, 225, 255),
  cream: new Color(248, 225, 181, 255),
  coral: new Color(239, 100, 83, 255),
  teal: new Color(39, 166, 151, 255),
  mustard: new Color(245, 180, 54, 255),
  overlay: new Color(39, 29, 35, 190),
  cell: new Color(255, 244, 213, 190),
  white: new Color(255, 255, 255, 255),
} as const;

export function createUiNode(name: string, width = 0, height = 0): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  node.addComponent(UITransform).setContentSize(width, height);
  return node;
}

export function drawRounded(node: Node, width: number, height: number, color: Color, radius = 24,
  stroke?: { color: Color; width: number }): Graphics {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = color;
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  if (stroke) {
    graphics.strokeColor = stroke.color;
    graphics.lineWidth = stroke.width;
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.stroke();
  }
  return graphics;
}

export function createLabel(text: string, fontSize: number, color = COLORS.ink,
  width = 500, height = fontSize * 1.5): Label {
  const node = createUiNode(`Label:${text}`, width, height);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.25);
  label.color = color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  return label;
}

export function createSpriteNode(name: string, frame: SpriteFrame, width: number, height: number): Node {
  const node = createUiNode(name, width, height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = frame;
  // Assigning a frame can restore its imported pixel dimensions. Reapply the
  // requested UI size so large source sprites do not overflow their layout.
  node.getComponent(UITransform)?.setContentSize(width, height);
  return node;
}

export function createButton(text: string, width: number, height: number, color: Color,
  onTap: () => void, fontSize = 34, icon?: SpriteFrame): Node {
  const node = createUiNode(`Button:${text}`, width, height);
  drawRounded(node, width, height, color, 24, { color: COLORS.ink, width: 5 });
  if (icon) {
    const iconNode = createSpriteNode(`Button:${text}:Icon`, icon, height * 0.64, height * 0.64);
    iconNode.setPosition(-width / 2 + height * 0.58, 0);
    node.addChild(iconNode);
  }
  const label = createLabel(text, fontSize, COLORS.white, icon ? width - height - 24 : width - 30, height - 12);
  if (icon) label.node.setPosition(height * 0.18, 0);
  node.addChild(label.node);
  node.on(Node.EventType.TOUCH_START, () => tween(node).to(0.05, { scale: new Vec3(0.96, 0.96, 1) }).start());
  node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
  node.on(Node.EventType.TOUCH_END, () => {
    tween(node).to(0.08, { scale: Vec3.ONE }).call(onTap).start();
  });
  return node;
}

export function createIconButton(name: string, frame: SpriteFrame | undefined, fallback: string,
  size: number, onTap: () => void): Node {
  const node = createUiNode(name, size, size);
  if (frame) {
    const icon = createSpriteNode(`${name}:Icon`, frame, size, size);
    node.addChild(icon);
  } else {
    drawRounded(node, size, size, new Color(255, 248, 226, 235), size / 2, { color: COLORS.ink, width: 4 });
    const label = createLabel(fallback, size * 0.5, COLORS.ink, size * 0.8, size * 0.8);
    node.addChild(label.node);
  }
  node.on(Node.EventType.TOUCH_START, () => tween(node).to(0.05, { scale: new Vec3(0.9, 0.9, 1) }).start());
  node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
  node.on(Node.EventType.TOUCH_END, () => {
    tween(node).to(0.08, { scale: Vec3.ONE }).call(onTap).start();
  });
  return node;
}
