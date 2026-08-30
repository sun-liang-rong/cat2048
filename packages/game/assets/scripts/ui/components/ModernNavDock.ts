import { Color, Node, tween, Vec3 } from 'cc';
import type { ArtRepository } from '../utils/ArtRepository';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  bindTapFeedback,
} from '../utils/uiFactory';
import { withAlpha } from '../utils/colors';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { NAV_DOCK_HEIGHT } from '../styles/tokens';

const ICON_SIZE = 92;
// 间距根据屏幕宽度动态计算，4 个图标均匀铺开
const MAX_ICON_SPACING = 184;
const ICON_SIZE_UI = 100;

interface NavItem {
  name: string;
  label: string;
  iconName: string; // 图标名称，对应配置文件中的 name
  onTap: () => void;
  badge?: boolean;
}

/**
 * 现代化导航栏组件
 */
export class ModernNavDock {
  private taskBadge: Node | null = null;

  constructor(private readonly art: ArtRepository) {}

  public build(
    parent: Node,
    uiWidth: number,
    uiHeight: number,
    bottomInset: number,
    taskClaimable: boolean,
    actions: {
      onCollection: () => void;
      onShop: () => void;
      onTasks: () => void;
      onGuide: () => void;
      onSettings: () => void;
    }
  ): Node {
    const dockY = -uiHeight / 2 + bottomInset + NAV_DOCK_HEIGHT / 2;
    const dock = createUiNode('ModernNavDock', uiWidth, NAV_DOCK_HEIGHT);
    dock.setPosition(0, dockY);

    // 背景
    this.drawModernBackground(dock, uiWidth, NAV_DOCK_HEIGHT);

    // 导航项
    const items: NavItem[] = [
      { name: 'Collection', label: '图鉴', iconName: 'collection', onTap: actions.onCollection },
      { name: 'Shop', label: '商店', iconName: 'shop', onTap: actions.onShop },
      { name: 'Tasks', label: '任务', iconName: 'tasks', onTap: actions.onTasks, badge: true },
      { name: 'Guide', label: '玩法', iconName: 'guide', onTap: actions.onGuide },
      { name: 'Settings', label: '设置', iconName: 'settings', onTap: actions.onSettings },
    ];

    // 按屏幕宽度均匀铺开：左右各留约 100px 边距，图标之间等距分布
    const iconSpacing = Math.min(MAX_ICON_SPACING, uiWidth / (items.length + 0.12));
    const totalWidth = (items.length - 1) * iconSpacing;
    const startX = -totalWidth / 2;

    items.forEach((item, index) => {
      const x = startX + index * iconSpacing;
      const button = this.createNavButton(item.name, item.iconName, item.onTap);
      button.setPosition(x, 24);
      dock.addChild(button);

      // 标签
      const label = createLabel(item.label, 22, COLORS.textBody, 120, 34, 'display');
      label.node.setPosition(x, -46);
      dock.addChild(label.node);

      // 任务徽章
      if (item.badge) {
        const badge = this.createBadge();
        badge.setPosition(x + 32, 62);
        badge.active = taskClaimable;
        dock.addChild(badge);
        this.taskBadge = badge;
      }
    });

    parent.addChild(dock);
    return dock;
  }

  private drawModernBackground(node: Node, width: number, height: number): void {
    // 主背景
    const base = createUiNode('DockBg:Base', width, height);
    drawRounded(base, width, height, new Color(252, 237, 203, 255), 28);
    node.addChild(base);

    // 边框（原高光、分隔线、内阴影装饰层合并省略，降低 Graphics 节点数）
    const border = createUiNode('DockBg:Border', width, height);
    drawRounded(border, width, height, new Color(0, 0, 0, 0), 28,
      { color: withAlpha(new Color(169, 123, 80, 255), 220), width: 4 });
    node.addChild(border);
  }

  private createNavButton(name: string, iconName: string, onTap: () => void): Node {
    const container = createUiNode(`NavBtn:${name}`, ICON_SIZE, ICON_SIZE);

    // 按钮背景 - 圆形容器
    const bgSize = 74;
    const background = createUiNode(`${name}:Bg`, bgSize, bgSize);
    drawRounded(background, bgSize, bgSize, new Color(255, 250, 238, 255), bgSize / 2,
      { color: new Color(209, 163, 110, 150), width: 3 });
    container.addChild(background);

    // 使用配置中心定义的路径（更可靠）
    const iconPathMap: Record<string, string> = {
      collection: GAME_CONFIG.art.homeCollection,
      shop: GAME_CONFIG.art.homeShop,
      tasks: GAME_CONFIG.art.homeTasks,
      guide: GAME_CONFIG.art.homeGuide,
      settings: GAME_CONFIG.art.homeSettings,
    };

    const iconPath = iconPathMap[iconName];
    if (!iconPath) {
      console.warn(`[ModernNavDock] 未定义的图标名称: ${iconName}`);
      return container;
    }

    const iconFrame = this.art.frame(iconPath);
    if (iconFrame) {
      const icon = createSpriteNode(`${name}:Icon`, iconFrame, ICON_SIZE_UI, ICON_SIZE_UI);
      icon.setPosition(0, 2);
      container.addChild(icon);
    } else {
      console.warn(`[ModernNavDock] 图标加载失败: ${iconPath}`);
    }

    // 悬浮动画
    this.addHoverAnimation(container);
    bindTapFeedback(container, onTap, 0.92);

    return container;
  }

  private createBadge(): Node {
    const badge = createUiNode('TaskBadge', 32, 32);

    // 外发光
    const glow = createUiNode('Badge:Glow', 36, 36);
    drawRounded(glow, 36, 36, withAlpha(COLORS.coral, 60), 18);
    badge.addChild(glow);

    // 主体
    drawRounded(badge, 32, 32, COLORS.coral, 16,
      { color: COLORS.textLight, width: 3 });

    // 感叹号
    const icon = createLabel('!', 20, COLORS.textLight, 24, 28, 'display');
    icon.node.setPosition(0, 1);
    badge.addChild(icon.node);

    // 脉冲动画
    tween(badge)
      .to(0.6, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'sineInOut' })
      .to(0.6, { scale: Vec3.ONE }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

    return badge;
  }

  private addHoverAnimation(node: Node): void {
    // 微妙的浮动动画
    tween(node)
      .by(1.8, { position: new Vec3(0, 3, 0) }, { easing: 'sineInOut' })
      .by(1.8, { position: new Vec3(0, -3, 0) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
  }

  public setTaskBadge(visible: boolean): void {
    if (this.taskBadge) {
      this.taskBadge.active = visible;
    }
  }
}
