import {
  Color,
  Label,
  Mask,
  Node,
  ScrollView,
  UITransform,
} from 'cc';
import type {
  CosmeticCategory,
  CosmeticDefinition,
} from '../../features/economy/catalog';
import type { EconomySnapshot } from '../../features/economy/economy';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import type { CosmeticRuntime } from '../components/CosmeticRuntime';
import { addCoverBackground } from '../styles/background';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createUiNode,
} from '../utils/uiFactory';
import { createShopCard } from '../components/shop/ShopCard';

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
  readonly onCategoryChange: (category: CosmeticCategory) => void;
}

const CATEGORY_LABELS: Readonly<Record<CosmeticCategory, string>> = {
  'cat-skin': '猫咪皮肤',
  board: '棋盘背景',
  effect: '合成特效',
};

const CATEGORIES: readonly CosmeticCategory[] = ['cat-skin', 'board', 'effect'];
const TAB_CONTENT_GAP = 48;
const TAB_WIDTH = 166;
const TAB_HEIGHT = 58;
const TAB_GAP = 12;
const TAB_ROW_WIDTH = TAB_WIDTH * CATEGORIES.length + TAB_GAP * (CATEGORIES.length - 1);
const TAB_START_X = -TAB_ROW_WIDTH / 2 + TAB_WIDTH / 2;
const TAB_ACTIVE_COLOR = new Color(59, 130, 246, 255);      // 蓝色激活标签
const TAB_ACTIVE_SHADOW = new Color(29, 78, 216, 40);       // 激活标签光晕
const TAB_INACTIVE_COLOR = new Color(248, 246, 242, 255);   // 暖白未激活标签

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
      COLORS.pageCream,
    );

    const headerY = model.uiHeight / 2 - model.topInset - 48;
    const back = createIconButton(
      'ShopBack',
      this.art.frame(GAME_CONFIG.art.collectionBackPaw),
      '‹',
      78,
      actions.onBack,
    );
    back.setPosition(-model.uiWidth / 2 + 60, headerY);
    parent.addChild(back);

    const title = createLabel('装饰商店', 50, COLORS.title, 390, 72, 'display');
    title.node.setPosition(0, headerY + 2);
    parent.addChild(title.node);

    this.wallet = createButton(`金币 ${model.economy.coins}`, 220, 64, COLORS.mustard,
      () => actions.onDailyReward(), 22, this.art.frame(GAME_CONFIG.art.coin));
    this.wallet.setPosition(model.uiWidth / 2 - 137, headerY + 4);
    parent.addChild(this.wallet);

    const tabs = createUiNode('ShopTabs', model.uiWidth - 42, 72);
    tabs.setPosition(0, headerY - 76);
    parent.addChild(tabs);
    this.tabs = tabs;
    CATEGORIES.forEach((category, index) => {
      const isActive = category === this.category;

      // 为激活标签添加光晕
      if (isActive) {
        const glow = createButton('', TAB_WIDTH + 8, TAB_HEIGHT + 8, TAB_ACTIVE_SHADOW,
          () => {}, 19);
        glow.setPosition(TAB_START_X + index * (TAB_WIDTH + TAB_GAP), 0);
        tabs.addChild(glow);
      }

      const tab = createButton(CATEGORY_LABELS[category], TAB_WIDTH, TAB_HEIGHT,
        isActive ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR,
        () => {
          if (this.category === category) return;
          this.category = category;
          this.refreshTabs();
          this.renderContent();
          actions.onCategoryChange(category);
        }, 20);

      // 激活标签的文字用白色，未激活用深灰色
      const textColor = isActive ? new Color(255, 255, 255, 255) : new Color(75, 85, 99, 255);
      const label = tab.getComponentInChildren(Label);
      if (label) {
        label.color = textColor;
        label.isBold = isActive;
      }

      tab.setPosition(TAB_START_X + index * (TAB_WIDTH + TAB_GAP), 0);
      tabs.addChild(tab);
    });

    // 商品区改为 ScrollView：商品数量增长后可滚动浏览，不再依赖固定两行。
    const viewportTop = headerY - 74 - TAB_HEIGHT / 2 - TAB_CONTENT_GAP;
    const viewportBottom = -model.uiHeight / 2 + model.bottomInset + 32;
    const viewportHeight = Math.max(280, viewportTop - viewportBottom);

    const scroll = createUiNode('ShopScroll', model.uiWidth - 42, viewportHeight);
    scroll.setPosition(0, (viewportTop + viewportBottom) / 2);
    parent.addChild(scroll);
    // Keep the tab row above the scroll content if a rounded card reaches the viewport edge.
    tabs.setSiblingIndex(parent.children.length - 1);

    const viewport = createUiNode('ShopViewport', model.uiWidth - 42, viewportHeight);
    viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    scroll.addChild(viewport);

    this.content = createUiNode('ShopContent', model.uiWidth - 42, viewportHeight);
    this.content.setPosition(0, 0);
    viewport.addChild(this.content);

    const scrollView = scroll.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.content = this.content;

    this.refreshTabs();
    this.renderContent();
  }

  public refresh(model: ShopViewModel): void {
    const previousCategory = this.category;
    const parent = this.parent;
    const actions = this.actions;
    this.model = model;
    if (!parent || !actions) return;
    for (const child of [...parent.children]) child.destroy();
    this.content = null;
    this.wallet = null;
    this.category = previousCategory;
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

  public get selectedCategory(): CosmeticCategory {
    return this.category;
  }

  /** 新一批预览图完成后只刷新商品区，保留页头、分类和滚动容器。 */
  public refreshContent(): void {
    this.renderContent();
  }

  private refreshTabs(): void {
    if (!this.tabs) return;
    // 清空并重建标签，以正确显示光晕效果
    for (const child of [...this.tabs.children]) child.destroy();

    CATEGORIES.forEach((category, index) => {
      const isActive = category === this.category;

      // 为激活标签添加光晕
      if (isActive) {
        const glow = createButton('', TAB_WIDTH + 8, TAB_HEIGHT + 8, TAB_ACTIVE_SHADOW,
          () => {}, 20);
        glow.setPosition(TAB_START_X + index * (TAB_WIDTH + TAB_GAP), 0);
        this.tabs.addChild(glow);
      }

      const tab = createButton(CATEGORY_LABELS[category], TAB_WIDTH, TAB_HEIGHT,
        isActive ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR,
        () => {
          if (this.category === category) return;
          this.category = category;
          this.refreshTabs();
          this.renderContent();
          if (this.actions) this.actions.onCategoryChange(category);
        }, 20);

      const label = tab.getComponentInChildren(Label);
      if (label) {
        label.color = isActive
          ? new Color(255, 255, 255, 255)
          : new Color(75, 85, 99, 255);
        label.isBold = isActive;
      }

      tab.setPosition(TAB_START_X + index * (TAB_WIDTH + TAB_GAP), 0);
      this.tabs.addChild(tab);
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
    // Reserve enough vertical room for the price row and the button margin.
    const cardHeight = Math.round(cardWidth * 1.43);
    const rowGap = 22;
    const columnGap = 28;

    const rowCount = Math.ceil(items.length / 2);
    const rowsHeight = rowCount > 0
      ? rowCount * cardHeight + (rowCount - 1) * rowGap
      : cardHeight;
    const contentPadding = 28;
    const contentTransform = content.getComponent(UITransform)!;
    const viewportHeight = contentTransform.contentSize.height || rowsHeight;
    contentTransform.setContentSize(contentTransform.width,
      Math.max(viewportHeight, rowsHeight + contentPadding * 2));
    const contentHeight = contentTransform.contentSize.height;

    items.forEach((item, index) => {
      const card = createShopCard(item, {
        economy: model.economy,
        width: cardWidth,
        height: cardHeight,
        art: this.art,
        isEquipped: (candidate) => this.isEquipped(candidate),
        onPurchase: actions.onPurchase,
        onEquip: actions.onEquip,
      }, index);
      const col = index % 2;
      const row = Math.floor(index / 2);
      card.setPosition(-cardWidth / 2 - columnGap / 2 + col * (cardWidth + columnGap),
        contentHeight / 2 - contentPadding - cardHeight / 2 - row * (cardHeight + rowGap));
      content.addChild(card);
    });

    if (items.length === 0) {
      const empty = createLabel('暂无商品', 26, new Color(100, 116, 139, 255), 360, 60, 'display');
      content.addChild(empty.node);
    }
  }

  private isEquipped(item: CosmeticDefinition): boolean {
    const equipped = this.cosmetics.state;
    if (item.category === 'cat-skin') return equipped.catSkin === item.id;
    if (item.category === 'board') return equipped.board === item.id;
    return equipped.effect === item.id;
  }
}
