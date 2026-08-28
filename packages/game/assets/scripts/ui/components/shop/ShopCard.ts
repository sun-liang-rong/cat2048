/**
 * 商店商品卡片组件（从 ShopView 拆出）。
 * 纯函数组件：接收商品定义与购买/装备回调，返回渲染好的卡片 Node。
 *
 * 视觉规范（暖色游戏化风格）：
 * - 「使用中」= 翡翠描边 + 右上角标 + 深绿按钮，表达积极状态而非禁用
 * - 金币不足时预览保持彩色，按钮展示差额并保留点击（引导提示由上层给出）
 * - 高档商品（≥1500）带稀有度丝带：1500 稀有金、1800 传说绯红
 * - 预览图坐在圆形奶油舞台上，配椭圆投影，强化"展示台"氛围
 */
import { Color, Graphics, Label, Node, UIOpacity, Vec3, tween } from 'cc';
import type { CosmeticDefinition } from '../../../features/economy/catalog';
import type { EconomySnapshot } from '../../../features/economy/economy';
import { GAME_CONFIG } from '../../../core/config/gameConfig';
import type { ArtRepository } from '../../utils/ArtRepository';
import {
  createButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../../utils/uiFactory';

const NAME_COLOR = new Color(61, 46, 34, 255);            // 深墨棕名称
const MUTED_COLOR = new Color(163, 146, 126, 255);        // 弱化棕灰（金币不足）
const CARD_COLOR = new Color(255, 252, 244, 255);         // 卡片奶油白
const CARD_BORDER = new Color(233, 214, 185, 255);        // 常规暖沙描边
const CARD_SHADOW = new Color(110, 80, 45, 30);           // 单层柔和投影
const EQUIPPED_BORDER = new Color(52, 211, 153, 255);     // 使用中翡翠描边
const EQUIPPED_GLOW = new Color(52, 211, 153, 50);        // 使用中外圈光晕
const EQUIPPED_BUTTON = new Color(38, 178, 124, 255);     // 使用中深绿按钮
const STAGE_BG = new Color(251, 238, 214, 255);           // 预览舞台奶油底
const STAGE_STROKE = new Color(240, 223, 195, 255);       // 预览舞台描边
const STAGE_SHADOW = new Color(120, 90, 50, 55);          // 舞台椭圆投影
const PRICE_COLOR = new Color(176, 116, 42, 255);         // 价格深金棕
const BUTTON_BUY = new Color(255, 159, 74, 255);          // 购买暖橙（主 CTA）
const BUTTON_EQUIP_BG = new Color(255, 243, 220, 255);    // 装备奶油底
const BUTTON_EQUIP_TEXT = new Color(176, 116, 42, 255);   // 装备深金棕文字
const SHORTFALL_BG = new Color(255, 226, 188, 255);       // 差额按钮浅橙
const SHORTFALL_TEXT = new Color(198, 120, 44, 255);      // 差额文字
const RARE_BG = new Color(255, 185, 56, 255);             // 稀有·金
const RARE_TEXT = new Color(124, 74, 0, 255);
const LEGENDARY_BG = new Color(244, 92, 80, 255);         // 传说·绯红
const LEGENDARY_TEXT = new Color(255, 244, 240, 255);

const BUTTON_HEIGHT = 54;
const BUTTON_BOTTOM_MARGIN = 20;
const RIBBON_WIDTH = 96;
const RIBBON_HEIGHT = 34;

interface RarityStyle {
  readonly label: string;
  readonly bg: Color;
  readonly text: Color;
}

/** 按价格档位映射稀有度（仅高档商品展示丝带）。 */
function rarityOf(price: number): RarityStyle | null {
  if (price >= 1800) return { label: '传说', bg: LEGENDARY_BG, text: LEGENDARY_TEXT };
  if (price >= 1500) return { label: '稀有', bg: RARE_BG, text: RARE_TEXT };
  return null;
}

export interface ShopCardOptions {
  readonly economy: EconomySnapshot;
  readonly width: number;
  readonly height: number;
  readonly art: ArtRepository;
  readonly isEquipped: (item: CosmeticDefinition) => boolean;
  readonly onPurchase: (itemId: string) => void;
  readonly onEquip: (itemId: string) => void;
}

/** 生成一张商品卡片（舞台预览、名称+价格行、单一主操作按钮）。 */
export function createShopCard(item: CosmeticDefinition, options: ShopCardOptions, index = 0): Node {
  const { economy, width, height, art, isEquipped, onPurchase, onEquip } = options;
  const card = createUiNode(`ShopCard:${item.id}`, width, height);

  const owned = economy.ownedItemIds.indexOf(item.id) >= 0;
  const equipped = isEquipped(item);
  const canBuy = owned || economy.coins >= item.price;
  const rarity = rarityOf(item.price);

  // 单层柔和投影（替代旧三层阴影，避免边缘发灰）
  const shadow = createUiNode(`ShopCardShadow:${item.id}`, width + 6, height + 6);
  drawRounded(shadow, width + 6, height + 6, CARD_SHADOW, 24);
  shadow.setPosition(0, -4);
  card.addChild(shadow);

  // 使用中：卡片外圈翡翠光晕（入场后脉冲一次）
  let equippedGlow: Node | null = null;
  if (equipped) {
    equippedGlow = createUiNode(`ShopEquippedGlow:${item.id}`, width + 16, height + 16);
    drawRounded(equippedGlow, width + 16, height + 16, EQUIPPED_GLOW, 28);
    card.addChild(equippedGlow);
  }

  // 卡片主体（使用中 = 翡翠描边，其余 = 暖沙细描边）
  const body = createUiNode(`ShopCardBody:${item.id}`, width, height);
  drawRounded(body, width, height, CARD_COLOR, 22, equipped
    ? { color: EQUIPPED_BORDER, width: 4 }
    : { color: CARD_BORDER, width: 2 });
  card.addChild(body);

  // 稀有度丝带（左上角，已装备时让位给翡翠描边语义）
  if (rarity && !equipped) {
    const ribbon = createUiNode(`ShopRibbon:${item.id}`, RIBBON_WIDTH, RIBBON_HEIGHT);
    drawRounded(ribbon, RIBBON_WIDTH, RIBBON_HEIGHT, rarity.bg, 17);
    const ribbonLabel = createLabel(rarity.label, 16, rarity.text, RIBBON_WIDTH - 12,
      RIBBON_HEIGHT - 8, 'display');
    ribbonLabel.isBold = true;
    ribbon.addChild(ribbonLabel.node);
    ribbon.setPosition(-width / 2 + 56, height / 2 - 26);
    body.addChild(ribbon);
  }

  // 使用中角标（右上角，翡翠底白字）
  if (equipped) {
    const badge = createUiNode(`ShopEquippedBadge:${item.id}`, 108, RIBBON_HEIGHT);
    drawRounded(badge, 108, RIBBON_HEIGHT, EQUIPPED_BORDER, 17);
    const badgeLabel = createLabel('✓ 使用中', 15, new Color(255, 255, 255, 255), 96,
      RIBBON_HEIGHT - 8, 'display');
    badgeLabel.isBold = true;
    badge.addChild(badgeLabel.node);
    badge.setPosition(width / 2 - 62, height / 2 - 26);
    body.addChild(badge);
  }

  // ---- 预览舞台：圆形奶油底 + 椭圆投影，猫咪"坐"在展示台上 ----
  const previewSize = Math.min(200, width - 60, height - 168);
  const stageRadius = previewSize / 2 + 12;
  const stageY = height / 2 - 20 - stageRadius;

  // 椭圆投影（用缩放圆实现，避免 Graphics.ellipse 参数歧义）
  const stageShadow = createUiNode(`ShopStageShadow:${item.id}`, stageRadius * 1.4, 18);
  const stageShadowGraphics = stageShadow.addComponent(Graphics);
  stageShadowGraphics.fillColor = STAGE_SHADOW;
  stageShadowGraphics.circle(0, 0, 50);
  stageShadowGraphics.fill();
  stageShadow.setScale(stageRadius * 0.7 / 50, 9 / 50, 1);
  stageShadow.setPosition(0, stageY - stageRadius + 10);
  body.addChild(stageShadow);

  // 圆形舞台
  const stage = createUiNode(`ShopStage:${item.id}`, stageRadius * 2, stageRadius * 2);
  const stageGraphics = stage.addComponent(Graphics);
  stageGraphics.fillColor = STAGE_BG;
  stageGraphics.circle(0, 0, stageRadius);
  stageGraphics.fill();
  stageGraphics.strokeColor = STAGE_STROKE;
  stageGraphics.lineWidth = 2;
  stageGraphics.circle(0, 0, stageRadius);
  stageGraphics.stroke();
  stage.setPosition(0, stageY);
  body.addChild(stage);

  // 预览立绘（金币不足不上遮罩，保持色彩吸引力）
  const previewFrame = item.previewAsset ? art.frame(item.previewAsset) : undefined;
  if (previewFrame) {
    const preview = createSpriteNode(`ShopPreview:${item.id}`, previewFrame,
      previewSize, previewSize);
    preview.setPosition(0, stageY);
    body.addChild(preview);
  } else {
    const preview = createUiNode(`ShopPreview:${item.id}`, previewSize, previewSize);
    addPreviewLoadingState(preview, item.id);
    preview.setPosition(0, stageY);
    body.addChild(preview);
  }

  // ---- 名称 + 价格行：名称居左，金币价格居右 ----
  const rowY = stageY - stageRadius - 26;
  const nameColor = canBuy || owned ? NAME_COLOR : MUTED_COLOR;
  const name = createLabel(item.name, 22, nameColor, width - 190, 30, 'display');
  name.isBold = true;
  name.node.setPosition(-(190) / 2, rowY);
  body.addChild(name.node);

  if (!owned) {
    const priceNode = createUiNode(`ShopPrice:${item.id}`, 160, 30);
    const priceColor = canBuy ? PRICE_COLOR : MUTED_COLOR;
    const priceText = createLabel(String(item.price), 22, priceColor, 110, 30, 'display', 'number');
    priceText.isBold = true;
    priceText.node.setPosition(22, 0);
    priceNode.addChild(priceText.node);
    const coinFrame = art.frame(GAME_CONFIG.art.coin);
    if (coinFrame) {
      const coin = createSpriteNode(`ShopPriceCoin:${item.id}`, coinFrame, 26, 26);
      coin.setPosition(-48, 0);
      priceNode.addChild(coin);
    }
    priceNode.setPosition(width / 2 - 96, rowY);
    body.addChild(priceNode);
  }

  // ---- 操作按钮：单一主操作，状态用颜色与文案表达 ----
  const buttonY = -height / 2 + BUTTON_BOTTOM_MARGIN + BUTTON_HEIGHT / 2;
  let action: Node;
  if (equipped) {
    // 积极状态：深绿实心（非灰色禁用），二次点击无副作用
    action = createButton('使用中', width - 44, BUTTON_HEIGHT, EQUIPPED_BUTTON,
      () => undefined, 21);
  } else if (owned) {
    action = createButton('装备', width - 44, BUTTON_HEIGHT, BUTTON_EQUIP_BG,
      () => onEquip(item.id), 21);
    tintButtonLabel(action, BUTTON_EQUIP_TEXT, true);
  } else if (canBuy) {
    action = createButton('购买', width - 44, BUTTON_HEIGHT, BUTTON_BUY,
      () => onPurchase(item.id), 21);
  } else {
    // 金币不足：保留彩色预览，按钮展示差额，点击交给上层给出引导提示
    const shortfall = item.price - economy.coins;
    action = createButton(`还差 ${shortfall}`, width - 44, BUTTON_HEIGHT, SHORTFALL_BG,
      () => onPurchase(item.id), 20, art.frame(GAME_CONFIG.art.coin));
    tintButtonLabel(action, SHORTFALL_TEXT, true);
  }
  action.setPosition(0, buttonY);
  body.addChild(action);

  // 入场动画：波浪延迟 + 弹性缩放；使用中的卡片外圈光晕多一次呼吸脉冲
  card.setScale(0.88, 0.88, 1);
  const delay = index * 0.045;
  tween(card).delay(delay).to(0.24, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  const opacity = card.addComponent(UIOpacity);
  opacity.opacity = 0;
  tween(opacity).delay(delay).to(0.2, { opacity: 255 }).start();

  if (equippedGlow) {
    const glowOpacity = equippedGlow.addComponent(UIOpacity);
    tween(glowOpacity)
      .delay(delay + 0.3)
      .to(0.35, { opacity: 130 })
      .to(0.35, { opacity: 255 })
      .start();
  }

  return card;
}

/** 覆盖按钮文字颜色（createButton 默认白色文字）。 */
function tintButtonLabel(button: Node, color: Color, bold: boolean): void {
  const label = button.getComponentInChildren(Label);
  if (!label) return;
  label.color = color;
  label.isBold = bold;
}

function addPreviewLoadingState(preview: Node, itemId: string): void {
  const spinner = createUiNode(`ShopPreviewLoading:${itemId}`, 58, 58);
  const graphics = spinner.addComponent(Graphics);
  graphics.strokeColor = new Color(156, 163, 175, 255); // 中性灰色加载圈
  graphics.lineWidth = 5;
  graphics.arc(0, 0, 20, Math.PI * 0.2, Math.PI * 1.75, false);
  graphics.stroke();
  spinner.setPosition(0, 10);
  preview.addChild(spinner);

  const label = createLabel('加载中', 16, new Color(100, 116, 139, 255), 110, 28, 'display');
  label.node.setPosition(0, -30);
  preview.addChild(label.node);
  tween(spinner).by(0.9, { angle: 360 }).repeatForever().start();
}
