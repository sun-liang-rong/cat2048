import {
  Color,
  Mask,
  Node,
  ScrollView,
} from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import type { CosmeticRuntime } from './CosmeticRuntime';
import { addCoverBackground } from './background';
import { collectionLayout } from './collectionLayout';
import {
  COLORS,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from './uiFactory';

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
}

type CatDefinition = (typeof GAME_CONFIG.cats)[number];

const TITLE_COLOR = new Color(91, 49, 31, 255);
const LOCKED_TEXT_COLOR = new Color(244, 228, 196, 255);
const PROGRESS_TRACK_COLOR = new Color(241, 224, 191, 245);
const PROGRESS_BORDER_COLOR = new Color(105, 61, 40, 255);

export class CollectionView {
  public constructor(private readonly art: ArtRepository, private readonly cosmetics: CosmeticRuntime) {}

  public build(parent: Node, model: CollectionViewModel, actions: CollectionActions): void {
    addCoverBackground(
      parent,
      this.art,
      GAME_CONFIG.art.collectionBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(255, 246, 220, 255),
    );

    const layout = collectionLayout(
      model.uiWidth,
      model.uiHeight,
      model.topInset,
      model.bottomInset,
      GAME_CONFIG.cats.length,
    );

    const back = createIconButton(
      'CollectionBack',
      this.art.frame(GAME_CONFIG.art.collectionBackPaw),
      '‹',
      78,
      actions.onBack,
    );
    back.setPosition(-model.uiWidth / 2 + 60, layout.headerY);
    parent.addChild(back);

    const title = createLabel('猫咪图鉴', 50, TITLE_COLOR, 390, 72, 'display');
    title.node.setPosition(0, layout.headerY + 2);
    parent.addChild(title.node);

    this.renderProgress(parent, model, layout.progressY);
    this.renderGrid(parent, model, layout);
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
    progress.setPosition(0, centerY);
    parent.addChild(progress);
  }

  private renderGrid(
    parent: Node,
    model: CollectionViewModel,
    layout: ReturnType<typeof collectionLayout>,
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

    const scrollView = scroll.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.content = content;

    const unlocked = new Set(model.unlockedLevels);
    GAME_CONFIG.cats.forEach((cat, index) => {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      const card = this.createCard(cat, unlocked.has(cat.level), layout.cardWidth, layout.cardHeight);
      card.setPosition(
        -layout.gridWidth / 2 + layout.cardWidth / 2
          + column * (layout.cardWidth + layout.columnGap),
        layout.contentHeight / 2 - layout.contentPadding - layout.cardHeight / 2
          - row * (layout.cardHeight + layout.rowGap),
      );
      content.addChild(card);
    });
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
        unlocked ? new Color(255, 248, 224, 250) : new Color(125, 113, 98, 248),
        24,
        { color: PROGRESS_BORDER_COLOR, width: 4 },
      );
    }

    if (unlocked) this.renderUnlockedCat(card, cat, width, height);
    else this.renderLockedCat(card, cat, width, height);
    return card;
  }

  private renderUnlockedCat(card: Node, cat: CatDefinition, width: number, height: number): void {
    const catFrame = this.cosmetics.catFrame(cat.level);
    if (catFrame) {
      const size = Math.min(width - 34, height - 88);
      const image = createSpriteNode(`CollectionCat:${cat.level}`, catFrame, size, size);
      image.setPosition(0, 30);
      card.addChild(image);
    }

    const level = createLabel(`Lv.${cat.level}`, 18, TITLE_COLOR, width - 24, 28, 'display');
    level.node.setPosition(0, -height / 2 + 48);
    card.addChild(level.node);
    const name = createLabel(cat.name, 20, TITLE_COLOR, width - 24, 32, 'display');
    name.node.setPosition(0, -height / 2 + 22);
    card.addChild(name.node);
  }

  private renderLockedCat(card: Node, cat: CatDefinition, width: number, height: number): void {
    const silhouetteFrame = this.art.frame(GAME_CONFIG.art.collectionLockedCat);
    if (silhouetteFrame) {
      const size = Math.min(width - 46, height - 106);
      const silhouette = createSpriteNode(`CollectionLockedCat:${cat.level}`, silhouetteFrame, size, size);
      silhouette.setPosition(0, 31);
      card.addChild(silhouette);
    }

    const lockFrame = this.art.frame(GAME_CONFIG.art.collectionLock);
    if (lockFrame) {
      const lock = createSpriteNode(`CollectionLock:${cat.level}`, lockFrame, 54, 54);
      lock.setPosition(0, 16);
      card.addChild(lock);
    }

    const level = createLabel(`Lv.${cat.level}`, 18, LOCKED_TEXT_COLOR, width - 24, 28, 'display');
    level.node.setPosition(0, -height / 2 + 48);
    card.addChild(level.node);
    const label = createLabel('未解锁', 19, LOCKED_TEXT_COLOR, width - 24, 32, 'display');
    label.node.setPosition(0, -height / 2 + 22);
    card.addChild(label.node);
  }
}
