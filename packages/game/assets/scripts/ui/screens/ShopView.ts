import {
  Color,
  Label,
  Mask,
  Node,
  ScrollView,
  tween,
  UITransform,
  Vec3,
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
  bindTapFeedback,
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
  readonly onCategoryChange: (category: CosmeticCategory) => void;
}

const CATEGORY_LABELS: Readonly<Record<CosmeticCategory, string>> = {
  'cat-skin': '猫咪皮肤',
  board: '棋盘背景',
  effect: '合成特效',
};

const CATEGORIES: readonly CosmeticCategory[] = ['cat-skin', 'board', 'effect'];
// 分类标签：胶囊分段控件（暖橙滑动指示块），与全局暖色主题一致
const TAB_WIDTH = 166;
const TAB_HEIGHT = 56;
const TAB_GAP = 12;
const TAB_ROW_WIDTH = TAB_WIDTH * CATEGORIES.length + TAB_GAP * (CATEGORIES.length - 1);
const TAB_CONTAINER_WIDTH = TAB_ROW_WIDTH + 20;
const TAB_CONTAINER_HEIGHT = 68;
const TAB_ACTIVE_COLOR = new Color(255, 159, 74, 255);      // 暖橙激活段
const TAB_CONTAINER_COLOR = new Color(255, 248, 236, 255);  // 胶囊奶油底
const TAB_CONTAINER_STROKE = new Color(240, 228, 208, 255); // 胶囊细描边
const TAB_ACTIVE_TEXT = new Color(255, 255, 255, 255);      // 激活段白字
const TAB_INACTIVE_TEXT = new Color(138, 122, 106, 255);    // 未激活棕灰字

export class ShopView {
  private category: CosmeticCategory = 'cat-skin';
  private model: ShopViewModel | null = null;
  private actions: ShopViewActions | null = null;
  private parent: Node | null = null;
  private tabs: Node | null = null;
  private tabIndicator: Node | null = null;
  private segmentLabels: Label[] = [];
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

    const tabs = createUiNode('ShopTabs', TAB_CONTAINER_WIDTH, TAB_CONTAINER_HEIGHT);
    tabs.setPosition(0, headerY - 76);
    parent.addChild(tabs);
    this.tabs = tabs;

    // 胶囊底
    drawRounded(tabs, TAB_CONTAINER_WIDTH, TAB_CONTAINER_HEIGHT, TAB_CONTAINER_COLOR, 34,
      { color: TAB_CONTAINER_STROKE, width: 2 });

    // 滑动指示块（切换分类时平移过去）
    const indicator = createUiNode('ShopTabIndicator', TAB_WIDTH, TAB_HEIGHT);
    drawRounded(indicator, TAB_WIDTH, TAB_HEIGHT, TAB_ACTIVE_COLOR, 22);
    indicator.setPosition(this.tabX(this.category), 0);
    tabs.addChild(indicator);
    this.tabIndicator = indicator;

    // 透明分段：只提供点击与文字，视觉由指示块承担
    this.segmentLabels = [];
    CATEGORIES.forEach((category) => {
      const segment = createUiNode(`ShopTab:${category}`, TAB_WIDTH, TAB_HEIGHT);
      const label = createLabel(CATEGORY_LABELS[category], 20, TAB_INACTIVE_TEXT,
        TAB_WIDTH - 16, TAB_HEIGHT - 12, 'display');
      segment.addChild(label.node);
      bindTapFeedback(segment, () => this.switchTab(category), 0.96);
      segment.setPosition(this.tabX(category), 0);
      tabs.addChild(segment);
      this.segmentLabels.push(label);
    });
    this.highlightActiveTab();

    // 商品区改为 ScrollView：商品数量增长后可滚动浏览，不再依赖固定两行。
    const viewportTop = headerY - 74 - TAB_HEIGHT / 2 - 48;
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
    this.tabIndicator = null;
    this.segmentLabels = [];
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

  /** 切换分类：指示块平移 + 文字重着色，商品区增量刷新。 */
  private switchTab(category: CosmeticCategory): void {
    if (this.category === category) return;
    this.category = category;
    this.animateTabs();
    this.renderContent();
    if (this.actions) this.actions.onCategoryChange(category);
  }

  private tabX(category: CosmeticCategory): number {
    const index = CATEGORIES.indexOf(category);
    const startX = -TAB_ROW_WIDTH / 2 + TAB_WIDTH / 2;
    return startX + index * (TAB_WIDTH + TAB_GAP);
  }

  private highlightActiveTab(): void {
    this.segmentLabels.forEach((label, index) => {
      const isActive = CATEGORIES[index] === this.category;
      label.color = isActive ? TAB_ACTIVE_TEXT : TAB_INACTIVE_TEXT;
      label.isBold = isActive;
    });
  }

  private animateTabs(): void {
    if (this.tabIndicator) {
      tween(this.tabIndicator)
        .to(0.18, { position: new Vec3(this.tabX(this.category), 0, 0) },
          { easing: 'cubicOut' })
        .start();
    }
    this.highlightActiveTab();
  }

  private renderContent(): void {
    const content = this.content;
    const model = this.model;
    const actions = this.actions;
    if (!content || !model || !actions) return;
    for (const child of [...content.children]) child.destroy();

    const items = model.economy.catalog.filter((item) => item.category === this.category);
    const cardWidth = Math.min(300, (model.uiWidth - 100) / 2);
    // 紧凑比例：预览舞台 + 名称价格行 + 单按钮，一屏可见更多商品
    const cardHeight = Math.round(cardWidth * 1.26);
    const rowGap = 16;
    const columnGap = 24;

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
