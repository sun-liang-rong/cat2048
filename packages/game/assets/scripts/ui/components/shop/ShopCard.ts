/**
 * 商店商品卡片组件（从 ShopView 拆出）。
 * 纯函数组件：接收商品定义与购买/装备回调，返回渲染好的卡片 Node。
 */
import { Color, Node, UIOpacity, Vec3, tween } from 'cc';
import type { CosmeticCategory, CosmeticDefinition } from '../../../features/economy/catalog';
import type { EconomySnapshot } from '../../../features/economy/economy';
import { GAME_CONFIG } from '../../../core/config/gameConfig';
import type { ArtRepository } from '../../utils/ArtRepository';
import {
  COLORS,
  createButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../../utils/uiFactory';

export const TITLE_COLOR = COLORS.title;
const PANEL_BORDER = COLORS.edgeBrown;
const CARD_COLOR = new Color(255, 249, 231, 250); // 商品卡底色，比纸面偏黄

export interface ShopCardOptions {
  readonly economy: EconomySnapshot;
  readonly width: number;
  readonly height: number;
  readonly art: ArtRepository;
  readonly isEquipped: (item: CosmeticDefinition) => boolean;
  readonly onPurchase: (itemId: string) => void;
  readonly onEquip: (itemId: string) => void;
}

/** 生成一张商品卡片（预览图、名称、购买/装备按钮）。 */
export function createShopCard(item: CosmeticDefinition, options: ShopCardOptions): Node {
  const { economy, width, height, art, isEquipped, onPurchase, onEquip } = options;
  const card = createUiNode(`ShopCard:${item.id}`, width, height);
  drawRounded(card, width, height, CARD_COLOR, 28, { color: PANEL_BORDER, width: 5 });

  const previewFrame = item.previewAsset ? art.frame(item.previewAsset) : undefined;
  const previewWidth = Math.min(190, width - 48);
  const previewHeight = previewWidth;
  const previewY = -10;
  const previewPlate = createUiNode(`ShopPreviewPlate:${item.id}`, previewWidth + 18,
    previewHeight + 18);
  drawRounded(previewPlate, previewWidth + 18, previewHeight + 18,
    new Color(255, 231, 195, 255), 30,
    { color: new Color(163, 102, 69, 115), width: 2 });
  previewPlate.setPosition(0, previewY);
  card.addChild(previewPlate);
  if (previewFrame) {
    const preview = createSpriteNode(`ShopPreview:${item.id}`, previewFrame, previewWidth, previewHeight);
    preview.setPosition(0, previewY);
    card.addChild(preview);
  } else {
    const preview = createUiNode(`ShopPreview:${item.id}`, previewWidth, previewHeight);
    drawRounded(preview, previewWidth, previewHeight, previewColor(item.category), 28,
      { color: COLORS.ink, width: 3 });
    preview.setPosition(0, previewY);
    card.addChild(preview);
  }

  const name = createLabel(item.name, 25, TITLE_COLOR, width - 24, 42, 'display');
  name.node.setPosition(0, height / 2 - 44);
  card.addChild(name.node);

  const owned = economy.ownedItemIds.indexOf(item.id) >= 0;
  const equipped = isEquipped(item);
  const actionText = equipped ? '已装备' : owned ? '装备' : `购买 ${item.price}`;
  const canBuy = owned || economy.coins >= item.price;
  const action = createButton(actionText, width - 38, 54,
    equipped ? COLORS.teal : canBuy ? COLORS.coral : COLORS.disabledSurface,
    () => {
      if (!canBuy || equipped) return;
      if (owned) onEquip(item.id);
      else onPurchase(item.id);
    }, 20, owned ? undefined : art.frame(GAME_CONFIG.art.coin));
  action.setPosition(0, -height / 2 + 40);
  if (!canBuy) action.addComponent(UIOpacity).opacity = 170;
  card.addChild(action);

  card.setScale(0.96, 0.96, 1);
  tween(card).to(0.16, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  return card;
}

function previewColor(category: CosmeticCategory): Color {
  if (category === 'cat-skin') return new Color(239, 100, 83, 255);
  if (category === 'board') return new Color(196, 148, 91, 255);
  if (category === 'effect') return new Color(121, 82, 190, 255);
  return new Color(39, 166, 151, 255);
}
