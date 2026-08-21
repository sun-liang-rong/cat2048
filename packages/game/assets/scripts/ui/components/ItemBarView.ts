import {
  Color,
  Label,
  Node,
  tween,
  UIOpacity,
  Vec3,
} from 'cc';
import type { ItemKind, ItemState } from '../../core/types';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  setLabelText,
} from '../utils/uiFactory';

interface ItemButtonView {
  readonly kind: ItemKind;
  readonly node: Node;
  readonly count: Label;
  readonly badge: Node;
  readonly title: Label;
  readonly icon: Node;
  readonly baseTitle: string;
  readonly baseIcon: string;
}

export interface ItemBarActions {
  readonly isLocked: () => boolean;
  readonly canUse: (kind: ItemKind) => boolean;
  readonly inventoryCount: (kind: ItemKind) => number;
  readonly onUse: (kind: ItemKind) => void;
}

export class ItemBarView {
  private undoItem: ItemButtonView | null = null;
  private eraseItem: ItemButtonView | null = null;
  private actions: ItemBarActions | null = null;

  public constructor(private readonly art: ArtRepository) {}

  public mount(parent: Node, y: number, actions: ItemBarActions): void {
    this.actions = actions;
    const bar = createUiNode('ItemBar', 650, 88);
    bar.setPosition(0, y);
    parent.addChild(bar);

    const undo = this.createItemButton('undo', 'UndoItem', '撤回一步', '↶');
    undo.node.setPosition(-163, 0);
    bar.addChild(undo.node);
    this.undoItem = undo;

    const erase = this.createItemButton('erase', 'EraseItem', '消除猫咪', '×');
    erase.node.setPosition(163, 0);
    bar.addChild(erase.node);
    this.eraseItem = erase;
  }

  public refresh(state: ItemState, inventoryCounts: Record<ItemKind, number>): void {
    this.setItemButtonState(this.undoItem, state.canUse('undo'), inventoryCounts['undo'] ?? 0);
    this.setItemButtonState(this.eraseItem, state.canUse('erase'), inventoryCounts['erase'] ?? 0);
  }

  public nodeFor(kind: ItemKind): Node | null {
    return kind === 'undo' ? this.undoItem?.node ?? null : this.eraseItem?.node ?? null;
  }

  public clear(): void {
    this.undoItem = null;
    this.eraseItem = null;
    this.actions = null;
  }

  private createItemButton(kind: ItemKind, name: string, titleText: string, iconText: string): ItemButtonView {
    const node = createUiNode(name, 310, 88);
    drawRounded(node, 310, 88, new Color(255, 248, 228, 242), 22,
      { color: new Color(139, 91, 59, 145), width: 2 });

    const icon = createUiNode(`${name}:Icon`, 60, 60);
    drawRounded(icon, 60, 60, new Color(247, 226, 188, 245), 18,
      { color: new Color(139, 91, 59, 80), width: 1 });
    icon.setPosition(-111, 0);
    const itemFrame = this.art.frame(kind === 'undo' ? GAME_CONFIG.art.undo : GAME_CONFIG.art.removeLowest);
    if (itemFrame) icon.addChild(createSpriteNode(`${name}:IconSprite`, itemFrame, 52, 52));
    else icon.addChild(createLabel(iconText, 27, COLORS.teal, 54, 52, 'display').node);
    node.addChild(icon);

    const title = createLabel(titleText, 22, COLORS.ink, 174, 42, 'display');
    title.node.setPosition(10, 3);
    node.addChild(title.node);

    const badge = createUiNode(`${name}:CountBadge`, 58, 28);
    drawRounded(badge, 58, 28, COLORS.mustard, 14);
    badge.setPosition(155, 44);
    const count = createLabel('×0', 17, COLORS.white, 52, 24, 'display');
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
      }).start();
    });
    return { kind, node, count, badge, title, icon, baseTitle: titleText, baseIcon: iconText };
  }

  private canTap(kind: ItemKind): boolean {
    const actions = this.actions;
    return Boolean(actions && !actions.isLocked() && actions.canUse(kind));
  }

  private setItemButtonState(view: ItemButtonView | null, canUse: boolean, inventoryCount: number): void {
    if (!view) return;
    view.count.string = `×${Math.max(0, inventoryCount)}`;
    setLabelText(view.title, view.baseTitle, 'display', 22);
    const depleted = inventoryCount <= 0;
    drawRounded(view.badge, 58, 28,
      canUse ? COLORS.mustard : depleted ? new Color(157, 148, 135, 190) : COLORS.coral,
      14);
    // 图标刷新
    for (const child of [...view.icon.children]) child.destroy();
    const frame = this.art.frame(view.kind === 'undo' ? GAME_CONFIG.art.undo : GAME_CONFIG.art.removeLowest);
    if (frame) view.icon.addChild(createSpriteNode(`${view.node.name}:IconSprite`, frame, 52, 52));
    else view.icon.addChild(createLabel(view.baseIcon, 27, COLORS.teal, 54, 52, 'display').node);
    const opacity = view.node.getComponent(UIOpacity) ?? view.node.addComponent(UIOpacity);
    opacity.opacity = canUse ? 255 : 105;
  }
}