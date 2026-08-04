import {
  BlockInputEvents,
  Color,
  Graphics,
  Node,
  SpriteFrame,
  UIOpacity,
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
  'cat-skin': '\u732b\u54aa\u76ae\u80a4',
  board: '\u68cb\u76d8\u80cc\u666f',
  effect: '\u5408\u6210\u7279\u6548',
  'button-theme': '\u6309\u94ae\u4e3b\u9898',
};

const CATEGORIES: readonly CosmeticCategory[] = ['cat-skin', 'board', 'effect', 'button-theme'];
const TAB_CONTENT_GAP = 24;
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

    const background = createUiNode('ShopBackground', model.uiWidth, model.uiHeight);
    drawRounded(background, model.uiWidth, model.uiHeight, new Color(249, 235, 206, 255), 0);
    parent.addChild(background);

    const headerY = model.uiHeight / 2 - model.topInset - 62;
    const back = createIconButton('ShopBack', this.art.frame(GAME_CONFIG.art.back), '\u2039', 72,
      () => actions.onBack());
    back.setPosition(-model.uiWidth / 2 + 58, headerY);
    parent.addChild(back);

    const title = createLabel('\u88c5\u9970\u5546\u5e97', 45, COLORS.coral, 300, 70, 'display');
    title.node.setPosition(-82, headerY + 8);
    parent.addChild(title.node);

    this.wallet = createButton(`\u91d1\u5e01 ${model.economy.coins}`, 205, 64, COLORS.mustard,
      () => actions.onDailyReward(), 22, this.art.frame(GAME_CONFIG.art.coin));
    this.wallet.setPosition(model.uiWidth / 2 - 130, headerY + 4);
    parent.addChild(this.wallet);

    const tabs = createUiNode('ShopTabs', model.uiWidth - 42, 68);
    tabs.setPosition(0, headerY - 78);
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

    this.content = createUiNode('ShopContent', model.uiWidth - 32, model.uiHeight - 310);
    this.content.setPosition(0, headerY - 360 - TAB_CONTENT_GAP);
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
    const cardWidth = Math.min(330, (model.uiWidth - 76) / 2);
    const cardHeight = 252;
    items.forEach((item, index) => {
      const card = this.createCard(item, model, actions, cardWidth, cardHeight);
      const col = index % 2;
      const row = Math.floor(index / 2);
      card.setPosition(-cardWidth / 2 - 10 + col * (cardWidth + 20),
        cardHeight / 2 - row * (cardHeight + 18));
      content.addChild(card);
    });

    if (items.length === 0) {
      const empty = createLabel('\u6682\u65e0\u5546\u54c1', 26, COLORS.ink, 360, 60, 'display');
      content.addChild(empty.node);
    }
  }

  private createCard(item: CosmeticDefinition, model: ShopViewModel, actions: ShopViewActions,
    width: number, height: number): Node {
    const card = createUiNode(`ShopCard:${item.id}`, width, height);
    drawRounded(card, width, height, COLORS.ivory, 24, { color: COLORS.ink, width: 4 });

    const previewFrame = item.previewAsset ? this.art.frame(item.previewAsset) : undefined;
    const isButtonTheme = item.category === 'button-theme';
    const previewWidth = isButtonTheme ? Math.min(220, width - 34) : 112;
    const previewHeight = isButtonTheme ? 72 : 112;
    const previewY = isButtonTheme ? 55 : 49;
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

    const name = createLabel(item.name, 22, COLORS.ink, width - 20, 38, 'display');
    name.node.setPosition(0, -31);
    card.addChild(name.node);

    const owned = model.economy.ownedItemIds.indexOf(item.id) >= 0;
    const equipped = this.isEquipped(item);
    const actionText = equipped ? '\u5df2\u88c5\u5907' : owned ? '\u88c5\u5907' : `\u8d2d\u4e70 ${item.price}`;
    const canBuy = owned || model.economy.coins >= item.price;
    const action = createButton(actionText, width - 38, 54,
      equipped ? COLORS.teal : canBuy ? COLORS.coral : new Color(156, 148, 136, 210),
      () => {
        if (!canBuy || equipped) return;
        if (owned) actions.onEquip(item.id);
        else actions.onPurchase(item.id);
      }, 20, owned ? undefined : this.art.frame(GAME_CONFIG.art.coin));
    action.setPosition(0, -91);
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
