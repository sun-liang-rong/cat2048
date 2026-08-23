import {
  Color,
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
  drawRounded,
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
}

const CATEGORY_LABELS: Readonly<Record<CosmeticCategory, string>> = {
  'cat-skin': '猫咪皮肤',
  board: '棋盘背景',
  effect: '合成特效',
};

const CATEGORIES: readonly CosmeticCategory[] = ['cat-skin', 'board', 'effect'];
const TAB_CONTENT_GAP = 25;
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
          if (this.category === category) return;
          this.category = category;
          this.refreshTabs();
          this.renderContent();
        }, 19);
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

  private refreshTabs(): void {
    if (!this.tabs) return;
    this.tabs.children.forEach((tab, index) => {
      const selected = CATEGORIES[index] === this.category;
      const background = tab.getChildByName('ButtonBackground');
      const size = tab.getComponent(UITransform)?.contentSize;
      if (!background || !size) return;
      drawRounded(background, size.width, size.height, selected ? COLORS.teal : COLORS.cream, 24,
        { color: COLORS.ink, width: 5 });
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
    const columnGap = 28;

    const rowCount = Math.ceil(items.length / 2);
    const rowsHeight = rowCount > 0
      ? rowCount * cardHeight + (rowCount - 1) * rowGap
      : cardHeight;
    const contentPadding = 24;
    // 内容高度不足一屏时撑满视口（保证可点击区域与居中），超出则自然滚动。
    // 注意 contentSize 挂在 UITransform 组件上，Node 上没有该属性。
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
      });
      const col = index % 2;
      const row = Math.floor(index / 2);
      card.setPosition(-cardWidth / 2 - columnGap / 2 + col * (cardWidth + columnGap),
        contentHeight / 2 - contentPadding - cardHeight / 2 - row * (cardHeight + rowGap));
      content.addChild(card);
    });

    if (items.length === 0) {
      const empty = createLabel('暂无商品', 26, COLORS.ink, 360, 60, 'display');
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
