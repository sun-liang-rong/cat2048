/**
 * 弹窗装饰绘制：标题两侧爪印/叶片、标题圆点、底部山丘与植物。
 * 纯绘制函数（从 ModalView 拆出），接收 panel 与比例参数，不持有状态。
 */
import { Color, Graphics, Node } from 'cc';
import { createUiNode } from '../utils/uiFactory';

const PAW_COLOR = new Color(246, 224, 196, 210);
const LEAF_COLOR = new Color(133, 168, 112, 235);
const LEAF_LIGHT = new Color(174, 194, 116, 220);
const HILL_COLOR = new Color(208, 216, 157, 190);
const DOT_COLOR = new Color(245, 218, 181, 190);
const PLANT_STEM = new Color(103, 145, 100, 220);
const PLANT_DARK = new Color(160, 184, 132, 210);
const FLOWER_PETAL = new Color(255, 251, 226, 255);
const FLOWER_CENTER = new Color(248, 190, 91, 255);

/** 标题两侧的爪印与叶片装饰。 */
export function addTopDecoration(panel: Node, sx: number, sy: number): void {
  const paw = createUiNode('ModalTitlePaw', 86, 72);
  const graphics = paw.addComponent(Graphics);
  graphics.fillColor = PAW_COLOR;
  graphics.ellipse(0, -8, 22, 17);
  graphics.fill();
  for (const [x, y, radius] of [[-27, 17, 9], [-10, 27, 10], [10, 25, 10], [27, 14, 8]] as const) {
    graphics.circle(x, y, radius);
    graphics.fill();
  }
  paw.setPosition(-245 * sx, 231 * sy);
  panel.addChild(paw);

  addLeaf(panel, 'ModalTitleLeafLeft', -114 * sx, 236 * sy, -42, LEAF_COLOR, 0.72);
  addLeaf(panel, 'ModalTitleLeafRight', 114 * sx, 236 * sy, 42, LEAF_COLOR, 0.72);
}

/** 标题下方的圆点装饰。 */
export function addTitleDots(panel: Node, sx: number, sy: number): void {
  const dots = createUiNode('ModalTitleDots', 230, 14);
  const graphics = dots.addComponent(Graphics);
  graphics.fillColor = DOT_COLOR;
  for (let index = 0; index < 11; index += 1) {
    graphics.circle(-72 + index * 14.4, 0, 2.5);
    graphics.fill();
  }
  dots.setPosition(0, 193 * sy);
  panel.addChild(dots);
}

/** 底部山丘与植物装饰。 */
export function addBottomDecoration(panel: Node, panelWidth: number, panelHeight: number): void {
  const band = Math.min(94, panelHeight * 0.14);
  const scale = band / 94;
  const baseY = -panelHeight / 2 + band / 2 - 3;

  const base = createUiNode('ModalBottomLandscape', panelWidth, 94);
  base.setScale(1, scale, 1);
  const graphics = base.addComponent(Graphics);
  graphics.fillColor = HILL_COLOR;
  const half = panelWidth / 2;
  graphics.moveTo(-half, -47);
  graphics.lineTo(-half, -24);
  graphics.bezierCurveTo(-230, -6, -174, -40, -105, -31);
  graphics.bezierCurveTo(-42, -22, -12, -5, 44, -28);
  graphics.bezierCurveTo(116, -52, 190, -11, half, -28);
  graphics.lineTo(half, -47);
  graphics.close();
  graphics.fill();
  base.setPosition(0, baseY);
  panel.addChild(base);

  addPlantCluster(panel, -panelWidth * 0.445, baseY - 2, 1);
  addPlantCluster(panel, panelWidth * 0.445, baseY - 2, -1);
  addLeaf(panel, 'ModalBottomLeafLeft', -panelWidth * 0.36, baseY - 2, -30, LEAF_LIGHT, 0.62);
  addLeaf(panel, 'ModalBottomLeafRight', panelWidth * 0.36, baseY - 2, 30, LEAF_LIGHT, 0.62);
}

function addPlantCluster(panel: Node, x: number, y: number, direction: number): void {
  const plant = createUiNode(`ModalPlant:${x}`, 112, 120);
  const graphics = plant.addComponent(Graphics);
  graphics.strokeColor = PLANT_STEM;
  graphics.lineWidth = 4;
  graphics.moveTo(0, -52);
  graphics.lineTo(-8 * direction, -6);
  graphics.moveTo(0, -52);
  graphics.lineTo(18 * direction, -18);
  graphics.stroke();

  addPlantLeaf(graphics, -24 * direction, -10, 17, 8, direction < 0);
  addPlantLeaf(graphics, 21 * direction, -28, 18, 9, direction > 0);
  addPlantLeaf(graphics, -4 * direction, -42, 16, 8, direction < 0);
  addFlower(graphics, 14 * direction, -57);
  plant.setPosition(x, y);
  panel.addChild(plant);
}

function addPlantLeaf(graphics: Graphics, x: number, y: number, rx: number, ry: number,
  flip: boolean): void {
  graphics.fillColor = LEAF_COLOR;
  graphics.ellipse(x, y, rx, ry);
  graphics.fill();
  if (flip) {
    graphics.fillColor = PLANT_DARK;
    graphics.ellipse(x + rx * 0.18, y + ry * 0.1, rx * 0.55, ry * 0.52);
    graphics.fill();
  }
}

function addFlower(graphics: Graphics, x: number, y: number): void {
  graphics.fillColor = FLOWER_PETAL;
  for (const [offsetX, offsetY] of [[-9, 0], [9, 0], [0, -9], [0, 9]] as const) {
    graphics.circle(x + offsetX, y + offsetY, 8);
    graphics.fill();
  }
  graphics.fillColor = FLOWER_CENTER;
  graphics.circle(x, y, 6);
  graphics.fill();
}

function addLeaf(panel: Node, name: string, x: number, y: number, angle: number,
  color: Color, scale: number): void {
  const leaf = createUiNode(name, 36, 24);
  const graphics = leaf.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.ellipse(0, 0, 18, 10);
  graphics.fill();
  leaf.angle = angle;
  leaf.setScale(scale, scale, 1);
  leaf.setPosition(x, y);
  panel.addChild(leaf);
}
