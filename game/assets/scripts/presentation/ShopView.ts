import {
  Color,
  Node,
  UIOpacity,
  UITransform,
  Vec3,
  tween,
} from 'cc';
import type {
  CosmeticCategory,
  CosmeticDefinition,
} from '../economy/catalog';
import type { EconomySnapshot } from '../economy/economy';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import type { CosmeticRuntime } from './CosmeticRuntime';
import { addCoverBackground } from './background';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  renderButtonBackground,
} from './uiFactory';

export interface ShopViewModel {
  readonly economy: EconomySnapshot;
  readonly uiWidth: number;
  readonly uiHeight: number;
  readonly topInset: number;
  readonly bottomInset: number;
}

export interface ShopViewActions {
  readonly onBack: () => void;
  readonly onDailyReward: () => void;
  readonly onPurchase: (itemId: string) => void;
  readonly onEquip: (itemId: string) => void;
}

const CATEGORY_LABELS: Readonly<Record<CosmeticCategory, string>> = {
  'cat-skin': '猫咪皮肤',
  board: '棋盘背景',
  effect: '合成特效',
  'button-theme': '按钮主题',
};

const CATEGORIES: readonly CosmeticCategory[] = ['cat-skin', 'board', 'effect', 'button-theme'];
const TITLE_COLOR = new Color(91, 49, 31, 255);
const PANEL_COLOR = new Color(255, 237, 202, 238);
const PANEL_BORDER = new Color(105, 61, 40, 255);
const CARD_COLOR = new Color(255, 249, 231, 250);
const TAB_CONTENT_GAP = 10;
const TAB_WIDTH = 166;
const TAB_HEIGHT = 58;
const TAB_GAP = 8;
const TAB_ROW_WIDTH = TAB_WIDTH * CATEGORIES.length + TAB_GAP * (CATEGORIES.length - 1);
const TAB_START_X = -TAB_ROW_WIDTH / 2 + TAB_WIDTH / 2;

export class ShopView {
  private category: CosmeticCategory = 'cat-skin';
  private model: ShopViewModel | null = null;
  private actions: ShopViewActions | null = null;
  private parent: Node | null = null;
  private tabs: Node | null = null;
  private content: Node | null = null;
  private wallet: Node | null = null;

  public constructor(
    private readonly art: ArtRepository,
    private readonly cosmetics: CosmeticRuntime,
  ) {}

  public build(parent: Node, model: ShopViewModel, actions: ShopViewActions): void {
    this.parent = parent;
    this.model = model;
    this.actions = actions;

    addCoverBackground(
      parent,
      this.art,
      GAME_CONFIG.art.collectionBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(255, 246, 220, 255),
    );

    const headerY = model.uiHeight / 2 - model.topInset - 62;
    const back = createIconButton('ShopBack', this.art.frame(GAME_CONFIG.art.collectionBackPaw), '‹', 78,
      () => actions.onBack());
    back.setPosition(-model.uiWidth / 2 + 58, headerY);
    parent.addChild(back);

    const title = createLabel('装饰商店', 50, TITLE_COLOR, 390, 72, 'display');
    title.node.setPosition(0, headerY + 2);
    parent.addChild(title.node);

    this.wallet = createButton(`金币 ${model.economy.coins}`, 205, 64, COLORS.mustard,
      () => actions.onDailyReward(), 22, this.art.frame(GAME_CONFIG.art.coin));
    this.wallet.setPosition(model.uiWidth / 2 - 130, headerY + 4);
    parent.addChild(this.wallet);

    const tabs = createUiNode('ShopTabs', model.uiWidth - 42, 68);
    tabs.setPosition(0, headerY - 74);
    parent.addChild(tabs);
    this.tabs = tabs;
    CATEGORIES.forEach((category, index) => {
      const tab = createButton(CATEGORY_LABELS[category], TAB_WIDTH, TAB_HEIGHT,
        category === this.category ? COLORS.teal : COLORS.cream,
        () => {
          this.category = category;
          this.refreshTabs();
          this.renderContent();
        }, 19);
      tab.setPosition(TAB_START_X + index * (TAB_WIDTH + TAB_GAP), 0);
      tabs.addChild(tab);
    });

    const contentTop = headerY - 74 - TAB_HEIGHT / 2 - TAB_CONTENT_GAP;
    const contentBottom = -model.uiHeight / 2 + model.bottomInset + 32;
    const contentHeight = Math.max(280, contentTop - contentBottom);
    const panel = createUiNode('ShopPanel', model.uiWidth - 42, contentHeight + 22);
    drawRounded(panel, model.uiWidth - 42, contentHeight + 22, PANEL_COLOR, 30,
      { color: PANEL_BORDER, width: 5 });
    panel.setPosition(0, (contentTop + contentBottom) / 2 - 2);
    parent.addChild(panel);

    this.content = createUiNode('ShopContent', model.uiWidth - 32, contentHeight);
    this.content.setPosition(0, (contentTop + contentBottom) / 2);
    parent.addChild(this.content);
    this.refreshTabs();
    this.renderContent();
  }

  public refresh(model: ShopViewModel): void {
    const parent = this.parent;
    const actions = this.actions;
    this.model = model;
    if (!parent || !actions) return;
    for (const child of [...parent.children]) child.destroy();
    this.content = null;
    this.wallet = null;
    this.build(parent, model, actions);
  }

  public clear(): void {
    this.model = null;
    this.actions = null;
    this.parent = null;
    this.tabs = null;
    this.content = null;
    this.wallet = null;
  }

  private refreshTabs(): void {
    if (!this.tabs) return;
    this.tabs.children.forEach((tab, index) => {
      const selected = CATEGORIES[index] === this.category;
      renderButtonBackground(tab, TAB_WIDTH, TAB_HEIGHT, selected ? COLORS.teal : COLORS.cream);
    });
  }

  private renderContent(): void {
    const content = this.content;
    const model = this.model;
    const actions = this.actions;
    if (!content || !model || !actions) return;
    for (const child of [...content.children]) child.destroy();

    const items = model.economy.catalog.filter((item) => item.category === this.category);
    const cardWidth = Math.min(300, (model.uiWidth - 104) / 2);
    const cardHeight = Math.round(cardWidth * 1.3);
    const rowGap = 18;
    const contentHeight = content.getComponent(UITransform)?.contentSize.height ?? cardHeight;
    items.forEach((item, index) => {
      const card = this.createCard(item, model, actions, cardWidth, cardHeight);
      const col = index % 2;
      const row = Math.floor(index / 2);
      card.setPosition(-cardWidth / 2 - 14 + col * (cardWidth + 28),
        contentHeight / 2 - 12 - cardHeight / 2 - row * (cardHeight + rowGap));
      content.addChild(card);
    });

    if (items.length === 0) {
      const empty = createLabel('暂无商品', 26, COLORS.ink, 360, 60, 'display');
      content.addChild(empty.node);
    }
  }

  private createCard(item: CosmeticDefinition, model: ShopViewModel, actions: ShopViewActions,
    width: number, height: number): Node {
    const card = createUiNode(`ShopCard:${item.id}`, width, height);
    drawRounded(card, width, height, CARD_COLOR, 28, { color: PANEL_BORDER, width: 5 });

    const previewFrame = item.previewAsset ? this.art.frame(item.previewAsset) : undefined;
    const isButtonTheme = item.category === 'button-theme';
    const previewWidth = isButtonTheme ? Math.min(220, width - 34) : Math.min(190, width - 48);
    const previewHeight = isButtonTheme ? 72 : previewWidth;
    const previewY = isButtonTheme ? 45 : 2;
    const previewPlate = createUiNode(`ShopPreviewPlate:${item.id}`, previewWidth + (isButtonTheme ? 12 : 18),
      previewHeight + (isButtonTheme ? 12 : 18));
    drawRounded(previewPlate, previewWidth + (isButtonTheme ? 12 : 18),
      previewHeight + (isButtonTheme ? 12 : 18),
      isButtonTheme ? new Color(255, 236, 207, 255) : new Color(255, 231, 195, 255),
      isButtonTheme ? 18 : 30,
      { color: new Color(163, 102, 69, 115), width: 2 });
    previewPlate.setPosition(0, previewY);
    card.addChild(previewPlate);
    if (previewFrame) {
      const preview = createSpriteNode(`ShopPreview:${item.id}`, previewFrame, previewWidth, previewHeight);
      preview.setPosition(0, previewY);
      card.addChild(preview);
    } else {
      const preview = createUiNode(`ShopPreview:${item.id}`, previewWidth, previewHeight);
      drawRounded(preview, previewWidth, previewHeight, this.previewColor(item.category), isButtonTheme ? 18 : 28,
        { color: COLORS.ink, width: 3 });
      preview.setPosition(0, previewY);
      card.addChild(preview);
    }

    const name = createLabel(item.name, 25, TITLE_COLOR, width - 24, 42, 'display');
    name.node.setPosition(0, height / 2 - 44);
    card.addChild(name.node);

    const owned = model.economy.ownedItemIds.indexOf(item.id) >= 0;
    const equipped = this.isEquipped(item);
    const actionText = equipped ? '已装备' : owned ? '装备' : `购买 ${item.price}`;
    const canBuy = owned || model.economy.coins >= item.price;
    const action = createButton(actionText, width - 38, 54,
      equipped ? COLORS.teal : canBuy ? COLORS.coral : new Color(156, 148, 136, 210),
      () => {
        if (!canBuy || equipped) return;
        if (owned) actions.onEquip(item.id);
        else actions.onPurchase(item.id);
      }, 20, owned ? undefined : this.art.frame(GAME_CONFIG.art.coin));
    action.setPosition(0, -height / 2 + 40);
    if (!canBuy) action.addComponent(UIOpacity).opacity = 170;
    card.addChild(action);

    card.setScale(0.96, 0.96, 1);
    tween(card).to(0.16, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    return card;
  }

  private isEquipped(item: CosmeticDefinition): boolean {
    const equipped = this.cosmetics.state;
    if (item.category === 'cat-skin') return equipped.catSkin === item.id;
    if (item.category === 'board') return equipped.board === item.id;
    if (item.category === 'effect') return equipped.effect === item.id;
    return equipped.buttonTheme === item.id;
  }

  private previewColor(category: CosmeticCategory): Color {
    if (category === 'cat-skin') return new Color(239, 100, 83, 255);
    if (category === 'board') return new Color(196, 148, 91, 255);
    if (category === 'effect') return new Color(121, 82, 190, 255);
    return new Color(39, 166, 151, 255);
  }
}
