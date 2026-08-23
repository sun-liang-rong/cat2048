import { Color, Label, Node, UITransform } from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import type { CosmeticRuntime } from './CosmeticRuntime';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  withAlpha,
} from '../utils/uiFactory';

const PANEL_FILL = new Color(255, 249, 232, 238);
const PANEL_EDGE = withAlpha(COLORS.softBrown, 125);

export interface EvolutionPanelActions {
  readonly isLocked: () => boolean;
  readonly onCollection: () => void;
}

export interface EvolutionChallenge {
  readonly targetLevel: number;
  readonly completed: boolean;
}

export class EvolutionPanelView {
  private panel: Node | null = null;
  private compactCollectionLabel: Label | null = null;
  private actions: EvolutionPanelActions | null = null;
  private challenge: EvolutionChallenge | null = null;

  public constructor(
    private readonly art: ArtRepository,
    private readonly cosmetics: CosmeticRuntime,
  ) {}

  public mount(parent: Node, y: number, height: number, highestLevel: number,
    unlockedCount: number, actions: EvolutionPanelActions, challenge?: EvolutionChallenge): void {
    this.actions = actions;
    this.panel = null;
    this.compactCollectionLabel = null;
    this.challenge = challenge ?? null;
    if (height > 0) {
      const panel = createUiNode('EvolutionPanel', 650, height);
      drawRounded(panel, 650, height, PANEL_FILL, 22,
        { color: PANEL_EDGE, width: 2 });
      panel.setPosition(0, y);
      parent.addChild(panel);
      this.panel = panel;
    } else {
      this.createCompactCollectionEntry(parent, y, unlockedCount);
    }
    this.refresh(highestLevel, unlockedCount);
  }

  public setChallenge(challenge?: EvolutionChallenge): void {
    this.challenge = challenge ?? null;
  }

  public refresh(highestLevel: number, unlockedCount: number): void {
    if (this.compactCollectionLabel) {
      this.compactCollectionLabel.string = this.challenge
        ? this.compactChallengeText(highestLevel)
        : this.compactCollectionText(unlockedCount);
    }
    const panel = this.panel;
    if (!panel) return;
    for (const child of [...panel.children]) child.destroy();

    const safeLevel = Math.max(1, Math.min(GAME_CONFIG.cats.length, highestLevel));
    const panelHeight = panel.getComponent(UITransform)?.height ?? 0;
    const compact = panelHeight < 190;
    const challenge = this.challenge;
    const current = GAME_CONFIG.cats[safeLevel - 1];
    const next = GAME_CONFIG.cats[Math.min(safeLevel, GAME_CONFIG.cats.length - 1)];
    const maxed = safeLevel === GAME_CONFIG.cats.length;

    const title = createLabel(challenge ? '今日挑战' : '猫咪进化路线', compact ? 20 : 22,
      COLORS.ink, 250, 36, 'display');
    title.node.setPosition(-173, panelHeight / 2 - (compact ? 25 : 28));
    panel.addChild(title.node);

    const collection = createLabel(challenge
      ? challenge.completed ? '挑战完成' : `合成 Lv.${challenge.targetLevel}`
      : this.collectionText(unlockedCount), compact ? 17 : 18,
    challenge?.completed ? COLORS.mustard : COLORS.teal, 180, 34, 'display');
    collection.node.setPosition(220, panelHeight / 2 - (compact ? 25 : 28));
    collection.node.on(Node.EventType.TOUCH_END, () => {
      if (!challenge && !this.actions?.isLocked()) this.actions?.onCollection();
    });
    panel.addChild(collection.node);

    const catY = compact ? -2 : 9;
    const catSize = compact ? 68 : 80;
    const currentFrame = this.cosmetics.catFrame(current.level);
    if (currentFrame) {
      const cat = createSpriteNode('EvolutionCurrentCat', currentFrame, catSize, catSize);
      cat.setPosition(-185, catY);
      panel.addChild(cat);
    }
    const currentText = createLabel(`Lv.${safeLevel}  ${current.name}`, compact ? 18 : 19,
      COLORS.ink, 250, compact ? 32 : 34, 'display');
    currentText.node.setPosition(-185, compact ? -45 : -48);
    panel.addChild(currentText.node);

    const arrowBadge = createUiNode('EvolutionArrow', compact ? 40 : 44, compact ? 40 : 44);
    drawRounded(arrowBadge, compact ? 40 : 44, compact ? 40 : 44,
      COLORS.mustard, compact ? 20 : 22);
    const arrow = createLabel('›', compact ? 31 : 34, COLORS.white,
      compact ? 34 : 38, compact ? 34 : 38, 'display');
    arrow.node.setPosition(2, 2);
    arrowBadge.addChild(arrow.node);
    arrowBadge.setPosition(0, catY);
    panel.addChild(arrowBadge);

    if (maxed) {
      const complete = createLabel('全图鉴达成', compact ? 19 : 22,
        COLORS.mustard, 200, 42, 'display');
      complete.node.setPosition(185, catY);
      panel.addChild(complete.node);
    } else {
      const nextFrame = this.cosmetics.catFrame(next.level);
      if (nextFrame) {
        const nextCat = createSpriteNode('EvolutionNextCat', nextFrame, catSize, catSize);
        nextCat.setPosition(185, catY);
        panel.addChild(nextCat);
      }
      const nextText = createLabel(`Lv.${safeLevel + 1}  ${next.name}`, compact ? 17 : 18,
        COLORS.ink, 250, compact ? 32 : 34, 'display');
      nextText.node.setPosition(185, compact ? -45 : -48);
      panel.addChild(nextText.node);
    }

    if (!compact) {
      const trackWidth = 570;
      const track = createUiNode('EvolutionProgressTrack', trackWidth, 14);
      drawRounded(track, trackWidth, 14, new Color(226, 207, 171, 210), 7); // 进化进度轨道沙色
      track.setPosition(0, -panelHeight / 2 + 18);
      panel.addChild(track);
      const progressLimit = challenge?.targetLevel ?? GAME_CONFIG.cats.length;
      const fillWidth = Math.max(14, trackWidth * Math.min(1, safeLevel / progressLimit));
      const fill = createUiNode('EvolutionProgressFill', fillWidth, 14);
      drawRounded(fill, fillWidth, 14, challenge?.completed || maxed ? COLORS.mustard : COLORS.coral, 7);
      fill.setPosition(-trackWidth / 2 + fillWidth / 2, 0);
      track.addChild(fill);
    }
  }

  public clear(): void {
    this.panel = null;
    this.compactCollectionLabel = null;
    this.actions = null;
    this.challenge = null;
  }

  private createCompactCollectionEntry(parent: Node, y: number, unlockedCount: number): void {
    const entry = createUiNode('CompactCollectionEntry', 250, 44);
    drawRounded(entry, 250, 44, PANEL_FILL, 22,
      { color: COLORS.teal, width: 2 });
    entry.setPosition(0, y);
    this.compactCollectionLabel = createLabel(this.challenge
      ? this.compactChallengeText(1)
      : this.compactCollectionText(unlockedCount),
      19, COLORS.teal, 225, 38, 'display');
    entry.addChild(this.compactCollectionLabel.node);
    entry.on(Node.EventType.TOUCH_END, () => {
      if (!this.challenge && !this.actions?.isLocked()) this.actions?.onCollection();
    });
    parent.addChild(entry);
  }

  private collectionText(unlockedCount: number): string {
    return unlockedCount >= GAME_CONFIG.cats.length
      ? '全图鉴达成'
      : `图鉴 ${unlockedCount}/${GAME_CONFIG.cats.length}`;
  }

  private compactCollectionText(unlockedCount: number): string {
    return `图鉴 ${unlockedCount}/${GAME_CONFIG.cats.length} ›`;
  }

  private compactChallengeText(highestLevel: number): string {
    const challenge = this.challenge;
    if (!challenge) return '';
    return challenge.completed
      ? '今日挑战已完成'
      : `今日挑战 Lv.${Math.min(highestLevel, challenge.targetLevel)}/${challenge.targetLevel}`;
  }
}
