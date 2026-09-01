import {
  Color,
  Label,
  Mask,
  Node,
  ScrollView,
  UITransform,
} from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import type { CosmeticRuntime } from '../components/CosmeticRuntime';
import { addCoverBackground } from '../styles/background';
import { collectionLayout } from '../styles/collectionLayout';
import {
  COLORS,
  bindTapFeedback,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';

export type CollectionOrigin = 'home' | 'game';

export interface CollectionViewModel {
  readonly unlockedLevels: readonly number[];
  readonly uiWidth: number;
  readonly uiHeight: number;
  readonly topInset: number;
  readonly bottomInset: number;
}

export interface CollectionActions {
  readonly onBack: () => void;
  /** 用户点击某张猫咪卡片时回调；用于弹出详情弹窗。 */
  readonly onCardTap: (cat: CatDefinition, unlocked: boolean) => void;
}

type CatDefinition = (typeof GAME_CONFIG.cats)[number];

const LOCKED_TEXT_COLOR = COLORS.textLocked;
const PROGRESS_TRACK_COLOR = new Color(241, 224, 191, 245);
const PROGRESS_BORDER_COLOR = COLORS.edgeBrown;

// The generated card textures include transparent padding around the painted
// frame. Keep the content inside that painted area instead of positioning it
// against the node's full rectangular bounds.
const CARD_IMAGE_SIZE_INSET = 54;
// Cocos UI uses a positive-up Y axis, so lowering these values moves the cats
// down inside the card and leaves more breathing room above them.
const CARD_IMAGE_Y = 14;
const CARD_LOCKED_IMAGE_Y = 32;
const CARD_LABEL_WIDTH_INSET = 28;
const CARD_LEVEL_Y_OFFSET = 64;
const CARD_NAME_Y_OFFSET = 42;
const CARD_LEVEL_HEIGHT = 22;
const CARD_NAME_HEIGHT = 22;

export class CollectionView {
  private content: Node | null = null;
  private model: CollectionViewModel | null = null;
  private actions: CollectionActions | null = null;
  private layout: ReturnType<typeof collectionLayout> | null = null;
  private progressLabel: Label | null = null;
  private progressFill: Node | null = null;
  private progressInnerWidth = 0;

  public constructor(private readonly art: ArtRepository, private readonly cosmetics: CosmeticRuntime) {}

  public build(parent: Node, model: CollectionViewModel, actions: CollectionActions): void {
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

    const layout = collectionLayout(
      model.uiWidth,
      model.uiHeight,
      model.topInset,
      model.bottomInset,
      GAME_CONFIG.cats.length,
    );
    this.layout = layout;

    const back = createIconButton(
      'CollectionBack',
      this.art.frame(GAME_CONFIG.art.collectionBackPaw),
      '‹',
      78,
      actions.onBack,
    );
    back.setPosition(-model.uiWidth / 2 + 60, layout.headerY);
    parent.addChild(back);

    const title = createLabel('猫咪图鉴', 50, COLORS.title, 390, 72, 'display');
    title.node.setPosition(0, layout.headerY + 2);
    parent.addChild(title.node);

    this.renderProgress(parent, model, layout.progressY);
    this.renderGrid(parent, model, layout, actions);
  }

  /** 经济快照更新后同步已打开图鉴，避免页面继续使用构建时的旧解锁数组。 */
  public refreshUnlockState(levels: readonly number[]): void {
    if (!this.model || !this.content) return;
    const content = this.content;
    this.model = { ...this.model, unlockedLevels: [...levels] };
    const count = new Set(levels).size;
    const total = GAME_CONFIG.cats.length;
    if (this.progressLabel?.node.isValid) this.progressLabel.string = `已解锁 ${count}/${total}`;
    if (this.progressFill?.isValid) {
      const height = 42;
      const ratio = Math.max(0, Math.min(1, count / total));
      const fillWidth = Math.max(height - 8, this.progressInnerWidth * ratio);
      this.progressFill.getComponent(UITransform)?.setContentSize(fillWidth, height - 8);
      drawRounded(this.progressFill, fillWidth, height - 8, COLORS.teal, (height - 8) / 2);
      this.progressFill.setPosition(-this.progressInnerWidth / 2 + fillWidth / 2, 0);
    }
    this.refreshCards(GAME_CONFIG.cats.map((cat) => cat.level));
    // A remote snapshot can reveal high-level cats after this page was built.
    // Warm the equipped skin before repainting once more so repaired cards do
    // not remain as empty unlocked frames.
    if (levels.some((level) => level >= 5)) {
      void this.art.loadHighLevelAssets(this.cosmetics.state.catSkin).then(() => {
        if (this.content !== content || !content.isValid) return;
        this.refreshCards(GAME_CONFIG.cats.map((cat) => cat.level));
      });
    }
  }

  private renderProgress(parent: Node, model: CollectionViewModel, centerY: number): void {
    const count = new Set(model.unlockedLevels).size;
    const total = GAME_CONFIG.cats.length;
    const width = Math.min(520, model.uiWidth - 150);
    const height = 42;
    const progress = createUiNode('CollectionProgress', width, height);
    drawRounded(progress, width, height, PROGRESS_TRACK_COLOR, height / 2,
      { color: PROGRESS_BORDER_COLOR, width: 4 });

    const ratio = Math.max(0, Math.min(1, count / total));
    const innerWidth = width - 8;
    const fillWidth = Math.max(height - 8, innerWidth * ratio);
    const fill = createUiNode('CollectionProgressFill', fillWidth, height - 8);
    drawRounded(fill, fillWidth, height - 8, COLORS.teal, (height - 8) / 2);
    fill.setPosition(-innerWidth / 2 + fillWidth / 2, 0);
    progress.addChild(fill);

    const label = createLabel(`已解锁 ${count}/${total}`, 20, COLORS.white, width - 28, height - 4, 'display');
    progress.addChild(label.node);
    this.progressLabel = label;
    this.progressFill = fill;
    this.progressInnerWidth = innerWidth;
    progress.setPosition(0, centerY);
    parent.addChild(progress);
  }

  private renderGrid(
    parent: Node,
    model: CollectionViewModel,
    layout: ReturnType<typeof collectionLayout>,
    actions: CollectionActions,
  ): void {
    const scroll = createUiNode('CollectionScroll', model.uiWidth, layout.viewportHeight);
    scroll.setPosition(0, layout.viewportTop - layout.viewportHeight / 2);
    parent.addChild(scroll);

    const viewport = createUiNode('CollectionViewport', model.uiWidth, layout.viewportHeight);
    viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    scroll.addChild(viewport);

    const content = createUiNode('CollectionContent', model.uiWidth, layout.contentHeight);
    content.setPosition(0, (layout.viewportHeight - layout.contentHeight) / 2);
    viewport.addChild(content);
    this.content = content;

    const scrollView = scroll.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.content = content;

    const unlocked = new Set(model.unlockedLevels);
    GAME_CONFIG.cats.forEach((cat, index) => {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      const cardUnlocked = unlocked.has(cat.level);
      const card = this.createCard(cat, cardUnlocked, layout.cardWidth, layout.cardHeight);
      card.setPosition(
        -layout.gridWidth / 2 + layout.cardWidth / 2
          + column * (layout.cardWidth + layout.columnGap),
        layout.contentHeight / 2 - layout.contentPadding - layout.cardHeight / 2
          - row * (layout.cardHeight + layout.rowGap),
      );
      // 卡片整体可点击：点击回调交给上层（弹窗控制器）决定展示什么。
      // 未解锁也允许点击，方便玩家提前看到解锁条件。
      bindTapFeedback(card, () => actions.onCardTap(cat, cardUnlocked), 0.94);
      content.addChild(card);
    });
  }

  /** 纹理批次加载完成后，仅替换对应卡片，避免重建页面和重置滚动位置。 */
  public refreshCards(levels: readonly number[]): void {
    const content = this.content;
    const model = this.model;
    const actions = this.actions;
    const layout = this.layout;
    if (!content || !content.isValid || !model || !actions || !layout) return;
    const unlocked = new Set(model.unlockedLevels);
    for (const level of new Set(levels)) {
      const cat = GAME_CONFIG.cats[level - 1];
      const previous = content.getChildByName(`CollectionCard:${level}`);
      if (!cat || !previous) continue;
      const cardUnlocked = unlocked.has(level);
      const replacement = this.createCard(cat, cardUnlocked, layout.cardWidth, layout.cardHeight);
      replacement.setPosition(previous.position);
      bindTapFeedback(replacement, () => actions.onCardTap(cat, cardUnlocked), 0.94);
      previous.destroy();
      content.addChild(replacement);
    }
  }

  private createCard(cat: CatDefinition, unlocked: boolean, width: number, height: number): Node {
    const card = createUiNode(`CollectionCard:${cat.level}`, width, height);
    const cardPath = unlocked ? GAME_CONFIG.art.collectionCardLight : GAME_CONFIG.art.collectionCardLocked;
    const frame = this.art.frame(cardPath);
    if (frame) {
      card.addChild(createSpriteNode(`${card.name}:Surface`, frame, width, height));
    } else {
      drawRounded(
        card,
        width,
        height,
        unlocked ? COLORS.surfacePaper : new Color(125, 113, 98, 248),
        24,
        { color: PROGRESS_BORDER_COLOR, width: 4 },
      );
    }

    if (unlocked) this.renderUnlockedCat(card, cat, width, height);
    else this.renderLockedCat(card, cat, width, height);
    return card;
  }

  /** 为卡片附加点击缩放反馈，与 `createIconButton` 风格保持一致。 */
  private renderUnlockedCat(card: Node, cat: CatDefinition, width: number, height: number): void {
    const catFrame = this.cosmetics.catFrame(cat.level);
    if (catFrame) {
      const size = Math.min(width - CARD_IMAGE_SIZE_INSET, height - 104);
      const image = createSpriteNode(`CollectionCat:${cat.level}`, catFrame, size, size);
      image.setPosition(0, CARD_IMAGE_Y);
      card.addChild(image);
    }

    const labelWidth = Math.max(1, width - CARD_LABEL_WIDTH_INSET);
    const level = createLabel(`Lv.${cat.level}`, 18, COLORS.title, labelWidth, CARD_LEVEL_HEIGHT, 'display');
    level.node.setPosition(0, -height / 2 + CARD_LEVEL_Y_OFFSET);
    card.addChild(level.node);
    const name = createLabel(cat.name, 18, COLORS.title, labelWidth, CARD_NAME_HEIGHT, 'display');
    name.node.setPosition(0, -height / 2 + CARD_NAME_Y_OFFSET);
    card.addChild(name.node);
  }

  private renderLockedCat(card: Node, cat: CatDefinition, width: number, height: number): void {
    const silhouetteFrame = this.art.frame(GAME_CONFIG.art.collectionLockedCat);
    if (silhouetteFrame) {
      const size = Math.min(width - 62, height - 118);
      const silhouette = createSpriteNode(`CollectionLockedCat:${cat.level}`, silhouetteFrame, size, size);
      silhouette.setPosition(0, CARD_LOCKED_IMAGE_Y);
      card.addChild(silhouette);
    }

    const lockFrame = this.art.frame(GAME_CONFIG.art.collectionLock);
    if (lockFrame) {
      const lock = createSpriteNode(`CollectionLock:${cat.level}`, lockFrame, 54, 54);
      lock.setPosition(0, 16);
      card.addChild(lock);
    }

    const labelWidth = Math.max(1, width - CARD_LABEL_WIDTH_INSET);
    const level = createLabel(`Lv.${cat.level}`, 18, LOCKED_TEXT_COLOR, labelWidth, CARD_LEVEL_HEIGHT, 'display');
    level.node.setPosition(0, -height / 2 + CARD_LEVEL_Y_OFFSET);
    card.addChild(level.node);
    const label = createLabel('未解锁', 18, LOCKED_TEXT_COLOR, labelWidth, CARD_NAME_HEIGHT, 'display');
    label.node.setPosition(0, -height / 2 + CARD_NAME_Y_OFFSET);
    card.addChild(label.node);
  }
}
