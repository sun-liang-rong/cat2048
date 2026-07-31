import {
  BlockInputEvents,
  Color,
  Graphics,
  Node,
  Sprite,
  tween,
  Vec3,
} from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import { addCoverBackground } from './background';
import {
  COLORS,
  createButton,
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

export interface UnlockActions {
  readonly onContinue: () => void;
  readonly onViewCollection: () => void;
}

type CatDefinition = (typeof GAME_CONFIG.cats)[number];

export class CollectionView {
  public constructor(private readonly art: ArtRepository) {}

  public build(parent: Node, model: CollectionViewModel, actions: CollectionActions): void {
    addCoverBackground(
      parent,
      this.art,
      GAME_CONFIG.art.pageBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(249, 235, 206, 255),
    );

    const headerY = model.uiHeight / 2 - model.topInset - 62;
    const back = createIconButton('CollectionBack', this.art.frame(GAME_CONFIG.art.back), '‹', 72, actions.onBack);
    back.setPosition(-model.uiWidth / 2 + 58, headerY);
    parent.addChild(back);

    const title = createLabel('猫咪图鉴', 45, COLORS.coral, 360, 70, 'display');
    title.node.setPosition(0, headerY + 8);
    parent.addChild(title.node);

    const count = model.unlockedLevels.length;
    const progress = createUiNode('CollectionProgress', 210, 48);
    drawRounded(progress, 210, 48, count === GAME_CONFIG.cats.length ? COLORS.mustard : COLORS.teal, 24);
    progress.setPosition(0, headerY - 58);
    const progressText = createLabel(count === GAME_CONFIG.cats.length
      ? '全图鉴达成' : `已解锁 ${count}/${GAME_CONFIG.cats.length}`, 20, COLORS.white, 190, 40, 'display');
    progress.addChild(progressText.node);
    parent.addChild(progress);

    const unlocked = new Set(model.unlockedLevels);
    const gridTop = headerY - 105;
    const availableHeight = Math.max(480, gridTop + model.uiHeight / 2 - model.bottomInset - 24);
    const gap = 12;
    const gridWidth = Math.min(660, model.uiWidth - 44);
    const cardWidth = (gridWidth - gap * 2) / 3;
    const cardHeight = Math.min(210, (availableHeight - gap * 2) / 3);

    GAME_CONFIG.cats.forEach((cat, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const card = this.createCard(cat, unlocked.has(cat.level), cardWidth, cardHeight, () => {
        if (unlocked.has(cat.level)) this.showDetail(parent, model, cat);
      });
      card.setPosition(
        -gridWidth / 2 + cardWidth / 2 + col * (cardWidth + gap),
        gridTop - cardHeight / 2 - row * (cardHeight + gap),
      );
      parent.addChild(card);
    });
  }

  public showUnlock(parent: Node, uiWidth: number, uiHeight: number, level: number,
    isFirstCollectionGuide: boolean, actions: UnlockActions): Node {
    const cat = GAME_CONFIG.cats[level - 1];
    const overlay = this.createOverlay(parent, uiWidth, uiHeight, 'CollectionUnlockOverlay');
    const panel = createUiNode('CollectionUnlockPanel', 590, 650);
    drawRounded(panel, 590, 650, COLORS.ivory, 38, { color: COLORS.ink, width: 6 });
    overlay.addChild(panel);

    const badge = createUiNode('NewCatBadge', 220, 50);
    drawRounded(badge, 220, 50, COLORS.mustard, 25);
    badge.setPosition(0, 255);
    badge.addChild(createLabel('新猫咪解锁', 23, COLORS.white, 200, 42, 'display').node);
    panel.addChild(badge);

    const frame = this.art.frame(cat.asset);
    if (frame) {
      const image = createSpriteNode('UnlockedCat', frame, 250, 250);
      image.setPosition(0, 80);
      panel.addChild(image);
      image.setScale(0.65, 0.65, 1);
      tween(image).to(0.3, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    }

    const name = createLabel(`Lv.${cat.level}  ${cat.name}`, 38, COLORS.coral, 480, 62, 'display');
    name.node.setPosition(0, -74);
    panel.addChild(name.node);
    const body = createLabel(isFirstCollectionGuide
      ? `${cat.description}\n已永久收录进猫咪图鉴` : cat.description, 25, COLORS.ink, 480, 100);
    body.node.setPosition(0, -145);
    panel.addChild(body.node);

    const continueButton = createButton('继续游戏', 230, 78, COLORS.teal, () => {
      overlay.destroy();
      actions.onContinue();
    }, 27);
    continueButton.setPosition(-132, -252);
    panel.addChild(continueButton);
    const viewButton = createButton('查看图鉴', 230, 78, COLORS.coral, () => {
      overlay.destroy();
      actions.onViewCollection();
    }, 27);
    viewButton.setPosition(132, -252);
    panel.addChild(viewButton);

    panel.setScale(0.8, 0.8, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    return overlay;
  }

  private createCard(cat: CatDefinition, unlocked: boolean, width: number, height: number,
    onTap: () => void): Node {
    const card = createUiNode(`CollectionCard:${cat.level}`, width, height);
    drawRounded(card, width, height, unlocked ? new Color(255, 249, 230, 245) : new Color(214, 207, 194, 235),
      22, { color: unlocked ? COLORS.ink : new Color(100, 94, 88, 210), width: 4 });

    const frame = this.art.frame(cat.asset);
    const catSize = Math.max(72, Math.min(width - 34, height - 66));
    if (frame) {
      const image = createSpriteNode(`CollectionCat:${cat.level}`, frame, catSize, catSize);
      image.setPosition(0, 18);
      if (!unlocked) {
        const sprite = image.getComponent(Sprite);
        if (sprite) sprite.color = new Color(70, 70, 70, 255);
      }
      card.addChild(image);
    }

    if (unlocked) {
      const name = createLabel(`Lv.${cat.level}  ${cat.name}`, 19, COLORS.ink, width - 16, 36, 'display');
      name.node.setPosition(0, -height / 2 + 25);
      card.addChild(name.node);
    } else {
      const lockFrame = this.art.frame(GAME_CONFIG.art.locked);
      if (lockFrame) {
        const lock = createSpriteNode(`CollectionLock:${cat.level}`, lockFrame, 54, 54);
        lock.setPosition(0, 18);
        card.addChild(lock);
      }
      const lockedText = createLabel(`Lv.${cat.level}  未解锁`, 18, new Color(95, 90, 84, 255), width - 16, 34, 'display');
      lockedText.node.setPosition(0, -height / 2 + 25);
      card.addChild(lockedText.node);
    }
    card.on(Node.EventType.TOUCH_START, () => tween(card).to(0.05, { scale: new Vec3(0.96, 0.96, 1) }).start());
    card.on(Node.EventType.TOUCH_CANCEL, () => tween(card).to(0.08, { scale: Vec3.ONE }).start());
    card.on(Node.EventType.TOUCH_END, () => tween(card).to(0.08, { scale: Vec3.ONE }).call(onTap).start());
    return card;
  }

  private showDetail(parent: Node, model: CollectionViewModel, cat: CatDefinition): void {
    const overlay = this.createOverlay(parent, model.uiWidth, model.uiHeight, 'CollectionDetailOverlay');
    const panel = createUiNode('CollectionDetailPanel', 590, 650);
    drawRounded(panel, 590, 650, COLORS.ivory, 38, { color: COLORS.ink, width: 6 });
    overlay.addChild(panel);

    const frame = this.art.frame(cat.asset);
    if (frame) {
      const image = createSpriteNode('CollectionDetailCat', frame, 300, 300);
      image.setPosition(0, 105);
      panel.addChild(image);
    }
    const name = createLabel(`Lv.${cat.level}  ${cat.name}`, 42, COLORS.coral, 500, 68, 'display');
    name.node.setPosition(0, -85);
    panel.addChild(name.node);
    const description = createLabel(cat.description, 27, COLORS.ink, 470, 100);
    description.node.setPosition(0, -162);
    panel.addChild(description.node);
    const close = createButton('关闭', 270, 78, COLORS.teal, () => overlay.destroy(), 29);
    close.setPosition(0, -260);
    panel.addChild(close);
    panel.setScale(0.8, 0.8, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  }

  private createOverlay(parent: Node, width: number, height: number, name: string): Node {
    const overlay = createUiNode(name, width, height);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = COLORS.overlay;
    dim.rect(-width / 2, -height / 2, width, height);
    dim.fill();
    parent.addChild(overlay);
    return overlay;
  }
}
