import {
  Color,
  Label,
  Node,
  tween,
  UIOpacity,
  Vec3,
} from 'cc';
import type { ItemKind, ItemState } from '../core/types';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  setLabelText,
} from './uiFactory';

interface ItemButtonView {
  readonly kind: ItemKind;
  readonly node: Node;
  readonly count: Label;
  readonly title: Label;
  readonly icon: Node;
  readonly baseTitle: string;
  readonly baseIcon: string;
}

export interface ItemBarActions {
  readonly isLocked: () => boolean;
  readonly canUse: (kind: ItemKind) => boolean;
  readonly canRefill: (kind: ItemKind) => boolean;
  readonly onUse: (kind: ItemKind) => void;
  readonly onRefill: (kind: ItemKind) => void;
}

export class ItemBarView {
  private undoItem: ItemButtonView | null = null;
  private removeLowestItem: ItemButtonView | null = null;
  private actions: ItemBarActions | null = null;

  public constructor(private readonly art: ArtRepository) {}

  public mount(parent: Node, y: number, actions: ItemBarActions): void {
    this.actions = actions;
    const bar = createUiNode('ItemBar', 650, 96);
    bar.setPosition(0, y);
    parent.addChild(bar);

    const undo = this.createItemButton('undo', 'UndoItem', '撤回一步', '↶');
    undo.node.setPosition(-167, 0);
    bar.addChild(undo.node);
    this.undoItem = undo;

    const remove = this.createItemButton('remove-lowest', 'RemoveLowestItem',
      '消除最低 ×3', '×3');
    remove.node.setPosition(167, 0);
    bar.addChild(remove.node);
    this.removeLowestItem = remove;
  }

  public refresh(state: ItemState): void {
    this.setItemButtonState(this.undoItem, state.canUndo, state.canRequestUndoRefill,
      state.undoRemaining, state.undoRefillRemaining);
    this.setItemButtonState(this.removeLowestItem, state.canRemoveLowest,
      state.canRequestRemoveLowestRefill, state.removeLowestRemaining, state.removeLowestRefillRemaining);
  }

  public nodeFor(kind: ItemKind): Node | null {
    return kind === 'undo' ? this.undoItem?.node ?? null : this.removeLowestItem?.node ?? null;
  }

  public clear(): void {
    this.undoItem = null;
    this.removeLowestItem = null;
    this.actions = null;
  }

  private createItemButton(kind: ItemKind, name: string, titleText: string, iconText: string): ItemButtonView {
    const node = createUiNode(name, 316, 96);
    drawRounded(node, 316, 96, new Color(255, 248, 226, 245), 26,
      { color: COLORS.ink, width: 4 });

    const icon = createUiNode(`${name}:Icon`, 68, 68);
    drawRounded(icon, 68, 68, COLORS.teal, 22);
    icon.setPosition(-111, 0);
    const itemFrame = this.art.frame(kind === 'undo' ? GAME_CONFIG.art.undo : GAME_CONFIG.art.removeLowest);
    if (itemFrame) icon.addChild(createSpriteNode(`${name}:IconSprite`, itemFrame, 56, 56));
    else icon.addChild(createLabel(iconText, 29, COLORS.white, 60, 58, 'display').node);
    node.addChild(icon);

    const title = createLabel(titleText, 25, COLORS.ink, 176, 46, 'display');
    title.node.setPosition(11, 7);
    node.addChild(title.node);

    const badge = createUiNode(`${name}:CountBadge`, 54, 32);
    drawRounded(badge, 54, 32, COLORS.mustard, 16);
    badge.setPosition(119, -26);
    const count = createLabel('1', 20, COLORS.white, 48, 28, 'display');
    badge.addChild(count.node);
    node.addChild(badge);

    node.on(Node.EventType.TOUCH_START, () => {
      if (!this.canTap(kind)) return;
      tween(node).to(0.05, { scale: new Vec3(0.96, 0.96, 1) }).start();
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
    node.on(Node.EventType.TOUCH_END, () => {
      if (!this.canTap(kind)) return;
      tween(node).to(0.08, { scale: Vec3.ONE }).call(() => {
        const actions = this.actions;
        if (!actions || actions.isLocked()) return;
        if (actions.canUse(kind)) actions.onUse(kind);
        else if (actions.canRefill(kind)) actions.onRefill(kind);
      }).start();
    });
    return { kind, node, count, title, icon, baseTitle: titleText, baseIcon: iconText };
  }

  private canTap(kind: ItemKind): boolean {
    const actions = this.actions;
    return Boolean(actions && !actions.isLocked() && (actions.canUse(kind) || actions.canRefill(kind)));
  }

  private setItemButtonState(view: ItemButtonView | null, canUse: boolean, canRefill: boolean,
    remaining: number, refillRemaining: number): void {
    if (!view) return;
    view.count.string = String(remaining);
    setLabelText(view.title, canRefill ? '分享补充' : view.baseTitle, 'display');
    for (const child of [...view.icon.children]) child.destroy();
    const frame = canRefill
      ? this.art.frame(GAME_CONFIG.art.share)
      : this.art.frame(view.kind === 'undo' ? GAME_CONFIG.art.undo : GAME_CONFIG.art.removeLowest);
    if (frame) view.icon.addChild(createSpriteNode(`${view.node.name}:IconSprite`, frame, 56, 56));
    else view.icon.addChild(createLabel(view.baseIcon, 29, COLORS.white, 60, 58, 'display').node);
    const opacity = view.node.getComponent(UIOpacity) ?? view.node.addComponent(UIOpacity);
    opacity.opacity = canUse || canRefill ? 255 : refillRemaining > 0 || remaining > 0 ? 145 : 90;
  }
}
