/**
 * 基础 UI 图形工具：节点创建与圆角矩形绘制。
 */
import { Color, Graphics, Layers, Node, UITransform } from 'cc';

/** 创建一个 UI 节点（默认 UI_2D 层级，设置内容尺寸）。 */
export function createUiNode(name: string, width = 0, height = 0): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  node.addComponent(UITransform).setContentSize(width, height);
  return node;
}

/** 在节点上绘制（可选带描边的）圆角矩形，返回 Graphics 组件。 */
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
