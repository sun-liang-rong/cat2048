/**
 * 商店商品卡片组件（从 ShopView 拆出）。
 * 纯函数组件：接收商品定义与购买/装备回调，返回渲染好的卡片 Node。
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

export const TITLE_COLOR = new Color(20, 18, 24, 255);        // 深墨色标题
const CARD_BORDER = new Color(200, 166, 120, 255);             // 深金色边框
// Keep the card surface visibly lighter than the textured page background.
const CARD_COLOR = new Color(255, 252, 244, 255);
const CARD_COLOR_DISABLED = new Color(235, 228, 215, 255);     // 金币不足时的灰色底
const PREVIEW_PLATE_BG = new Color(250, 240, 225, 255);        // 浅驼色预览底
const PREVIEW_PLATE_SHADOW = new Color(150, 130, 100, 40);     // 预览区内阴影
const PRICE_TAG_BG = new Color(255, 200, 120, 255);            // 金黄色标签
const PRICE_TAG_GLOW = new Color(255, 180, 80, 50);            // 价格标签光晕
const PRICE_COLOR = new Color(120, 50, 10, 255);               // 深棕色文字
const CARD_SHADOW_OUTER = new Color(100, 70, 40, 35);          // 外层深阴影
const CARD_SHADOW_INNER = new Color(120, 90, 60, 20);          // 内层柔和阴影
const EQUIPPED_BADGE_BG = new Color(52, 211, 153, 255);        // 翡翠徽章
const EQUIPPED_BADGE_GLOW = new Color(16, 185, 129, 40);       // 徽章光晕
const BUTTON_BUY_COLOR = new Color(251, 146, 60, 255);         // 橙色
const BUTTON_EQUIP_COLOR = new Color(96, 165, 250, 255);       // 蓝色
const BUTTON_DISABLED_COLOR = new Color(210, 200, 185, 255);   // 灰色

export interface ShopCardOptions {
  readonly economy: EconomySnapshot;
  readonly width: number;
  readonly height: number;
  readonly art: ArtRepository;
  readonly isEquipped: (item: CosmeticDefinition) => boolean;
  readonly onPurchase: (itemId: string) => void;
  readonly onEquip: (itemId: string) => void;
}

/** 生成一张商品卡片（预览图、名称、价格、购买/装备按钮）。 */
export function createShopCard(item: CosmeticDefinition, options: ShopCardOptions, index = 0): Node {
  const { economy, width, height, art, isEquipped, onPurchase, onEquip } = options;
  const card = createUiNode(`ShopCard:${item.id}`, width, height);

  const owned = economy.ownedItemIds.indexOf(item.id) >= 0;
  const equipped = isEquipped(item);
  const canBuy = owned || economy.coins >= item.price;

  // 三层阴影 - 创造精致的深度感
  const shadowBase = createUiNode(`ShopCardShadowBase:${item.id}`, width + 8, height + 8);
  drawRounded(shadowBase, width + 8, height + 8, CARD_SHADOW_OUTER, 26);
  shadowBase.setPosition(0, -8);
  card.addChild(shadowBase);

  const shadowMid = createUiNode(`ShopCardShadowMid:${item.id}`, width + 3, height + 3);
  drawRounded(shadowMid, width + 3, height + 3, CARD_SHADOW_INNER, 23);
  shadowMid.setPosition(0, -4);
  card.addChild(shadowMid);

  const shadowSoft = createUiNode(`ShopCardShadowSoft:${item.id}`, width, height);
  drawRounded(shadowSoft, width, height, new Color(60, 45, 30, 8), 22);
  shadowSoft.setPosition(0, -1);
  card.addChild(shadowSoft);

  // 卡片主体 - 精致的边框和底色
  const cardBody = createUiNode(`ShopCardBody:${item.id}`, width, height);
  const cardBgColor = canBuy ? CARD_COLOR : CARD_COLOR_DISABLED;
  drawRounded(cardBody, width, height, cardBgColor, 22, { color: CARD_BORDER, width: 2 });
  card.addChild(cardBody);

  // 卡片内部微光（顶部高光）
  if (canBuy && !equipped) {
    const innerGlow = createUiNode(`ShopCardGlow:${item.id}`, width - 20, height / 3);
    const glowGraphics = innerGlow.addComponent(Graphics);
    glowGraphics.fillColor = new Color(255, 255, 255, 8);
    glowGraphics.roundRect(-width / 2 + 10, 0, width - 20, height / 3, 16);
    glowGraphics.fill();
    innerGlow.setPosition(0, height / 2 - height / 6);
    cardBody.addChild(innerGlow);
  }

  // 已装备徽章（右上角）- 精致的翡翠设计带光晕
  if (equipped) {
    // 光晕层
    const badgeGlow = createUiNode(`ShopEquippedBadgeGlow:${item.id}`, 106, 46);
    drawRounded(badgeGlow, 106, 46, EQUIPPED_BADGE_GLOW, 23);
    badgeGlow.setPosition(width / 2 - 58, height / 2 - 28);
    cardBody.addChild(badgeGlow);

    const badge = createUiNode(`ShopEquippedBadge:${item.id}`, 100, 38);
    drawRounded(badge, 100, 38, EQUIPPED_BADGE_BG, 19);
    const checkMark = createLabel('✓ 使用中', 15, new Color(255, 255, 255, 255), 92, 34, 'display');
    checkMark.isBold = true;
    badge.addChild(checkMark.node);
    badge.setPosition(width / 2 - 58, height / 2 - 28);
    cardBody.addChild(badge);
  }

  // 预览图区域 - 精致的内嵌设计
  const previewFrame = item.previewAsset ? art.frame(item.previewAsset) : undefined;
  const previewWidth = Math.min(170, width - 60);
  const previewHeight = previewWidth;
  // Lift the preview toward the card header so the upper surface does not feel empty.
  const previewY = 64;

  // 预览区内阴影（凹陷效果）
  const previewShadow = createUiNode(`ShopPreviewShadow:${item.id}`, previewWidth + 28, previewHeight + 28);
  drawRounded(previewShadow, previewWidth + 28, previewHeight + 28, PREVIEW_PLATE_SHADOW, 20);
  previewShadow.setPosition(0, previewY - 2);
  cardBody.addChild(previewShadow);

  const previewPlate = createUiNode(`ShopPreviewPlate:${item.id}`, previewWidth + 24, previewHeight + 24);
  drawRounded(previewPlate, previewWidth + 24, previewHeight + 24, PREVIEW_PLATE_BG, 18);
  previewPlate.setPosition(0, previewY);
  cardBody.addChild(previewPlate);

  if (previewFrame) {
    const preview = createSpriteNode(`ShopPreview:${item.id}`, previewFrame, previewWidth, previewHeight);
    preview.setPosition(0, previewY);
    cardBody.addChild(preview);
  } else {
    const preview = createUiNode(`ShopPreview:${item.id}`, previewWidth, previewHeight);
    addPreviewLoadingState(preview, item.id);
    preview.setPosition(0, previewY);
    cardBody.addChild(preview);
  }

  // 如果金币不足，在预览图上添加半透明遮罩
  if (!canBuy && !owned) {
    const overlay = createUiNode(`ShopPreviewOverlay:${item.id}`, previewWidth + 24, previewHeight + 24);
    drawRounded(overlay, previewWidth + 24, previewHeight + 24, new Color(40, 32, 24, 100), 18);
    overlay.setPosition(0, previewY);
    cardBody.addChild(overlay);
  }

  // 商品名称 - 更精致的排版
  const nameColor = canBuy ? TITLE_COLOR : new Color(140, 130, 115, 255);
  const name = createLabel(item.name, 24, nameColor, width - 36, 40, 'display');
  name.isBold = true;
  // Keep the name above the price row instead of crowding the preview plate.
  name.node.setPosition(0, -height / 2 + 150);
  cardBody.addChild(name.node);

  // 价格标签（仅在未拥有时显示）- 饱满的琥珀金设计带光晕
  if (!owned) {
    // 价格标签光晕
    if (canBuy) {
      const priceGlow = createUiNode(`ShopPriceTagGlow:${item.id}`, 146, 46);
      drawRounded(priceGlow, 146, 46, PRICE_TAG_GLOW, 23);
      // Add a little breathing room below the item name.
      priceGlow.setPosition(0, -height / 2 + 92);
      cardBody.addChild(priceGlow);
    }

    const priceTag = createUiNode(`ShopPriceTag:${item.id}`, 140, 40);
    const priceTagBg = canBuy ? PRICE_TAG_BG : new Color(235, 230, 220, 255);
    const priceTagBorder = canBuy ? new Color(240, 190, 90, 255) : new Color(210, 205, 195, 255);
    drawRounded(priceTag, 140, 40, priceTagBg, 20, { color: priceTagBorder, width: 2 });

    const coinIcon = art.frame(GAME_CONFIG.art.coin);
    if (coinIcon) {
      const coin = createSpriteNode(`ShopPriceCoin:${item.id}`, coinIcon, 28, 28);
      coin.setPosition(-44, 0);
      priceTag.addChild(coin);
      if (!canBuy) {
        const coinOpacity = coin.addComponent(UIOpacity);
        coinOpacity.opacity = 100;
      }
    }

    const priceTextColor = canBuy ? PRICE_COLOR : new Color(140, 130, 115, 255);
    const priceLabel = createLabel(String(item.price), 24, priceTextColor, 78, 34, 'display', 'number');
    priceLabel.isBold = true;
    priceLabel.node.setPosition(18, 0);
    priceTag.addChild(priceLabel.node);
    priceTag.setPosition(0, -height / 2 + 92);
    cardBody.addChild(priceTag);
  }

  // 操作按钮 - 更饱满的色彩
  let actionText: string;
  let buttonColor: Color;

  if (equipped) {
    actionText = '使用中';
    buttonColor = BUTTON_DISABLED_COLOR;
  } else if (owned) {
    actionText = '装备';
    buttonColor = BUTTON_EQUIP_COLOR;
  } else if (canBuy) {
    actionText = '购买';
    buttonColor = BUTTON_BUY_COLOR;
  } else {
    actionText = '金币不足';
    buttonColor = BUTTON_DISABLED_COLOR;
  }

  const action = createButton(actionText, width - 52, 52, buttonColor,
    () => {
      if (!canBuy || equipped) return;
      if (owned) onEquip(item.id);
      else onPurchase(item.id);
    }, 21);
  // Leave a visible breathing room between the button and the card border.
  action.setPosition(0, -height / 2 + 38);

  if (!canBuy || equipped) {
    const textColor = new Color(150, 145, 135, 255);
    const label = action.getComponentInChildren(Label);
    if (label) {
      label.color = textColor;
    }
  } else {
    // 为可操作按钮添加文字阴影效果
    const label = action.getComponentInChildren(Label);
    if (label) {
      label.enableShadow = true;
      label.shadowColor = new Color(0, 0, 0, 40);
      label.shadowOffset = new Vec3(0, -1, 0);
      label.shadowBlur = 2;
    }
  }

  cardBody.addChild(action);

  // 交错入场动画 - 为每张卡片添加延迟，创造流畅的波浪效果
  card.setScale(0.88, 0.88, 1);
  const delay = index * 0.045;
  tween(card).delay(delay).to(0.24, { scale: Vec3.ONE }, { easing: 'backOut' }).start();

  // 初始透明度动画
  const opacity = card.addComponent(UIOpacity);
  opacity.opacity = 0;
  tween(opacity).delay(delay).to(0.2, { opacity: 255 }).start();

  return card;
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
