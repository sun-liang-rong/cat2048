import { Color, JsonAsset, Node, Rect, SpriteFrame, Texture2D, tween, Vec3, resources } from 'cc';
import type { ArtRepository } from './ArtRepository';
import { createLabel, createSpriteNode, createUiNode, drawRounded } from './uiFactory';

const DOCK_HEIGHT = 168;
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

interface SpriteConfig {
  width: number;
  height: number;
  icons: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/**
 * 现代化导航栏组件
 * 使用雪碧图优化性能，减少 DrawCall
 */
export class ModernNavDock {
  private taskBadge: Node | null = null;
  private spriteTexture: Texture2D | null = null;
  private spriteConfig: SpriteConfig | null = null;
  private isReady = false;

  constructor(private readonly art: ArtRepository) {
    this.loadSpriteResources();
  }

  private async loadSpriteResources(): Promise<void> {
    try {
      // 加载雪碧图纹理（nav_sprite_sheet 未在预加载列表中，需直接加载）
      await new Promise<void>((resolve, reject) => {
        resources.load('game/ui/home-v2/nav_sprite_sheet/texture', Texture2D, (err, asset) => {
          if (err) {
            console.error('加载雪碧图纹理失败:', err);
            reject(err);
            return;
          }
          this.spriteTexture = asset;
          resolve();
        });
      });

      // 加载配置文件
      await new Promise<void>((resolve, reject) => {
        resources.load('game/ui/home-v2/nav_sprite_sheet', JsonAsset, (err, asset) => {
          if (err) {
            console.error('加载雪碧图配置失败:', err);
            reject(err);
            return;
          }
          this.spriteConfig = asset.json as SpriteConfig;
          resolve();
        });
      });

      this.isReady = true;
    } catch (error) {
      console.error('加载雪碧图资源失败:', error);
    }
  }

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
      onSettings: () => void;
    }
  ): Node {
    const dockY = -uiHeight / 2 + bottomInset + DOCK_HEIGHT / 2;
    const dock = createUiNode('ModernNavDock', uiWidth, DOCK_HEIGHT);
    dock.setPosition(0, dockY);

    // 背景
    this.drawModernBackground(dock, uiWidth, DOCK_HEIGHT);

    // 导航项
    const items: NavItem[] = [
      { name: 'Collection', label: '图鉴', iconName: 'collection', onTap: actions.onCollection },
      { name: 'Shop', label: '商店', iconName: 'shop', onTap: actions.onShop },
      { name: 'Tasks', label: '任务', iconName: 'tasks', onTap: actions.onTasks, badge: true },
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
      const label = createLabel(item.label, 22, new Color(103, 67, 48, 255), 120, 34, 'display');
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
    // 主背景 - 温暖的木质色调
    const base = createUiNode('DockBg:Base', width, height);
    drawRounded(base, width, height, new Color(252, 237, 203, 255), 28);
    node.addChild(base);

    // 顶部装饰性高光
    const highlight = createUiNode('DockBg:Highlight', width - 40, 48);
    drawRounded(highlight, width - 40, 48, new Color(255, 250, 235, 100), 20);
    highlight.setPosition(0, height / 2 - 32);
    node.addChild(highlight);

    // 精致边框
    const border = createUiNode('DockBg:Border', width, height);
    drawRounded(border, width, height, new Color(0, 0, 0, 0), 28,
      { color: new Color(169, 123, 80, 220), width: 4 });
    node.addChild(border);

    // 顶部分隔线
    const divider = createUiNode('DockBg:Divider', width - 60, 3);
    drawRounded(divider, width - 60, 3, new Color(169, 123, 80, 80), 1.5);
    divider.setPosition(0, height / 2 - 10);
    node.addChild(divider);

    // 底部内阴影效果
    const innerShadow = createUiNode('DockBg:InnerShadow', width - 20, 20);
    drawRounded(innerShadow, width - 20, 20, new Color(139, 84, 50, 30), 10);
    innerShadow.setPosition(0, -height / 2 + 16);
    node.addChild(innerShadow);
  }

  private createNavButton(name: string, iconName: string, onTap: () => void): Node {
    const container = createUiNode(`NavBtn:${name}`, ICON_SIZE, ICON_SIZE);

    // 按钮背景 - 圆形容器
    const bgSize = 74;
    const background = createUiNode(`${name}:Bg`, bgSize, bgSize);
    
    // 外发光效果
    const glow = createUiNode(`${name}:Glow`, bgSize + 8, bgSize + 8);
    drawRounded(glow, bgSize + 8, bgSize + 8, new Color(255, 243, 210, 80), (bgSize + 8) / 2);
    background.addChild(glow);
    
    // 主背景
    drawRounded(background, bgSize, bgSize, new Color(255, 250, 238, 255), bgSize / 2,
      { color: new Color(209, 163, 110, 150), width: 3 });
    container.addChild(background);

    // 优先使用雪碧图，降级到独立图标
    let icon: Node | null = null;
    if (this.isReady && this.spriteTexture && this.spriteConfig) {
      icon = this.createIconFromSprite(name, iconName);
    }
    
    // 降级：使用独立图标文件
    if (!icon) {
      icon = this.createIconFromIndividualFile(name, iconName);
    }
    
    if (icon) {
      icon.setPosition(0, 2);
      container.addChild(icon);
    }

    // 悬浮动画
    this.addHoverAnimation(container);
    this.bindTap(container, onTap);
    
    return container;
  }

  private createIconFromSprite(name: string, iconName: string): Node | null {
    if (!this.spriteTexture || !this.spriteConfig) return null;

    // 从配置中查找图标信息
    const iconInfo = this.spriteConfig.icons.find(icon => icon.name === iconName);
    if (!iconInfo) {
      console.warn(`未找到图标配置: ${iconName}`);
      return null;
    }

    // 创建新的 SpriteFrame 用于裁剪
    const croppedFrame = new SpriteFrame();
    croppedFrame.texture = this.spriteTexture;
    
    // 设置裁剪区域 - 注意 Cocos 的坐标系是从左下角开始
    // 而我们的配置是从左上角开始，需要转换 Y 坐标
    const textureHeight = this.spriteConfig.height;
    croppedFrame.rect = new Rect(
      iconInfo.x,
      textureHeight - iconInfo.y - iconInfo.height, // Y 坐标转换
      iconInfo.width,
      iconInfo.height
    );

    return createSpriteNode(`${name}:Icon`, croppedFrame, ICON_SIZE_UI, ICON_SIZE_UI);
  }

  private createIconFromIndividualFile(name: string, iconName: string): Node | null {
    // 使用独立的图标文件作为降级方案（路径需带 /texture 后缀，与 ArtRepository 缓存 key 一致）
    const iconFrame = this.art.frame(`game/ui/home-v2/${iconName}/texture`);
    if (!iconFrame) {
      console.warn(`未找到图标文件: game/ui/home-v2/${iconName}/texture`);
      return null;
    }

    return createSpriteNode(`${name}:Icon`, iconFrame, ICON_SIZE_UI, ICON_SIZE_UI);
  }

  private createBadge(): Node {
    const badge = createUiNode('TaskBadge', 32, 32);
    
    // 外发光
    const glow = createUiNode('Badge:Glow', 36, 36);
    drawRounded(glow, 36, 36, new Color(255, 124, 82, 60), 18);
    badge.addChild(glow);
    
    // 主体
    drawRounded(badge, 32, 32, new Color(255, 107, 74, 255), 16,
      { color: new Color(255, 248, 232, 255), width: 3 });
    
    // 感叹号
    const icon = createLabel('!', 20, new Color(255, 248, 232, 255), 24, 28, 'display');
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

  private bindTap(node: Node, onTap: () => void): void {
    node.on(Node.EventType.TOUCH_START, () => {
      tween(node)
        .to(0.08, { scale: new Vec3(0.92, 0.92, 1) }, { easing: 'quadOut' })
        .start();
    });

    node.on(Node.EventType.TOUCH_CANCEL, () => {
      tween(node)
        .to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' })
        .start();
    });

    node.on(Node.EventType.TOUCH_END, () => {
      tween(node)
        .to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' })
        .call(onTap)
        .start();
    });
  }

  public setTaskBadge(visible: boolean): void {
    if (this.taskBadge) {
      this.taskBadge.active = visible;
    }
  }
}
