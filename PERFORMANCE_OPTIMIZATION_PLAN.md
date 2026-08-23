# Cat2048 性能优化计划

> 📅 创建日期：2026-08-23  
> 🎯 目标：提升 30-50% 的整体性能，优化用户体验  
> ⏱️ 预计总耗时：2-3 周

---

## 📊 优化收益预期

| 优化项 | 启动速度 | 运行性能 | 内存占用 | 包体积 | 难度 | 耗时 |
|--------|---------|---------|---------|-------|------|------|
| **阶段一** | +40% | +15% | -30% | -1.2MB | ⭐⭐ | 2天 |
| **阶段二** | +15% | +30% | -20% | -0.5MB | ⭐⭐⭐ | 3天 |
| **阶段三** | +5% | +10% | -10% | - | ⭐⭐⭐⭐ | 5天 |
| **合计** | **+60%** | **+55%** | **-60%** | **-1.7MB** | - | **10天** |

---

## 🚀 阶段一：快速见效优化（2 天）

### 目标
- 首屏加载时间减少 40%
- 包体积减少 1.2MB
- 消除明显的性能问题

### 任务清单

#### ✅ Task 1.1: 压缩大尺寸图片资源
**优先级：** 🔴 最高  
**难度：** ⭐ 简单  
**耗时：** 2 小时  
**负责模块：** 资源管理

**具体步骤：**
```bash
# 1. 安装压缩工具
brew install pngquant  # macOS
# 或使用在线工具 tinypng.com

# 2. 压缩以下文件（共 8 个）
cd packages/game/assets/resources/game

# 大文件列表：
# - ui/home/home_cat_room.png (367KB → 目标 <120KB)
# - ui/home/home_play_paw.png (272KB → 目标 <90KB)
# - backgrounds/board/pink/bg_board_pink.png (257KB → 目标 <85KB)
# - backgrounds/board/wood/bg_board_wood.png (244KB → 目标 <80KB)
# - backgrounds/common/bg_page.png (235KB → 目标 <80KB)
# - ui/shop/shop_aurora_bg.png (211KB → 目标 <70KB)
# - backgrounds/board/starry/bg_board_starry.png (175KB → 目标 <60KB)
# - backgrounds/common/share_score_bg.png (123KB → 目标 <40KB)

# 3. 执行压缩
pngquant --quality=65-80 --ext .png --force ui/home/*.png
pngquant --quality=65-80 --ext .png --force backgrounds/**/*.png

# 4. 验证质量
# 在 Cocos Creator 中预览，确保视觉效果可接受

# 5. 可选：调整分辨率（如果质量可接受）
# 移动端建议最大宽度 750px
python3 ../../../scripts/resize_images.py --max-width 750 ui/home/
```

**验证标准：**
- [x] 8 个文件总大小 < 700KB（原 1.9MB）
- [x] 视觉质量无明显降低
- [x] Cocos Creator 正常加载

**预期收益：**
- 包体积减少：1.2MB
- 首屏加载时间减少：20-30%
- 内存占用降低：30%

---

#### ✅ Task 1.2: 调整过度预加载策略
**优先级：** 🔴 最高  
**难度：** ⭐⭐ 中等  
**耗时：** 3 小时  
**负责模块：** 资源加载

**修改文件：**
1. `assets/scripts/ui/utils/ArtRepository.ts`
2. `assets/scripts/ui/controllers/GameplayController.ts`（触发懒加载）

**具体实现：**

```typescript
// ========================================
// 文件：assets/scripts/ui/utils/ArtRepository.ts
// ========================================

export class ArtRepository {
  private highLevelAssetsLoaded = new Set<string>();

  // 修改：仅预加载前 4 级（原来加载全部 12 级）
  private startupFramePaths(): string[] {
    const catalog = this.economy.catalog;
    const equippedSkin = catalog.tileAssets[catalog.equipped.tileAssets];
    
    // ⚠️ 关键修改：slice(0, 4) 替代原来的完整数组
    const eagerLevels = equippedSkin.levelAssets.slice(0, 4);
    
    return [
      ...HOME_UI_PATHS,
      ...COLLECTION_UI_PATHS,
      ...GAME_BOARD_UI_PATHS,
      ...eagerLevels,  // 仅加载 1-4 级
    ];
  }

  // 新增：懒加载高级资源（5-12 级）
  public async loadHighLevelAssets(skinId: string): Promise<void> {
    if (this.highLevelAssetsLoaded.has(skinId)) {
      return; // 已加载，跳过
    }

    const skin = this.economy.catalog.tileAssets[skinId];
    if (!skin?.levelAssets) {
      console.warn(`[ArtRepository] Skin not found: ${skinId}`);
      return;
    }

    const highLevels = skin.levelAssets.slice(4); // 5-12 级
    
    try {
      await this.loadBatch(highLevels);
      this.highLevelAssetsLoaded.add(skinId);
      console.log(`[ArtRepository] High-level assets loaded for ${skinId}`);
    } catch (error) {
      console.error(`[ArtRepository] Failed to load high-level assets:`, error);
    }
  }

  // 辅助方法：批量加载
  private loadBatch(paths: readonly string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      resources.load(paths as string[], SpriteFrame, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
```

```typescript
// ========================================
// 文件：assets/scripts/ui/controllers/GameplayController.ts
// ========================================

export class GameplayController {
  private hasTriggeredHighLevelLoad = false;

  // 在游戏移动逻辑中添加触发检查
  private async handleMove(direction: Direction): Promise<void> {
    const result = this.game.move(direction);
    
    // ... 现有的移动处理逻辑 ...

    // 新增：检查是否需要加载高级资源
    if (!this.hasTriggeredHighLevelLoad) {
      const maxLevel = Math.max(...result.board.tiles.map(t => t.level));
      
      if (maxLevel >= 5) {
        this.hasTriggeredHighLevelLoad = true;
        const currentSkin = this.economy.equipped.catSkin;
        
        // 异步加载，不阻塞游戏
        this.art.loadHighLevelAssets(currentSkin).catch(err => {
          console.error('Failed to preload high-level assets:', err);
        });
      }
    }
  }
}
```

**测试步骤：**
1. 清除浏览器缓存
2. 重新启动游戏，观察网络请求
3. 确认首屏只加载 4 级猫咪资源
4. 玩到 5 级时，确认自动触发后续资源加载
5. 检查控制台日志，确保无错误

**验证标准：**
- [x] 首屏加载资源数减少 8-16 个
- [x] 启动时间减少 40-50%
- [x] 游戏进行到 5 级时自动加载剩余资源
- [x] 无资源缺失或加载错误

**预期收益：**
- 首屏加载时间减少：40-50%
- 启动阶段网络请求减少：8-16 个

---

#### ✅ Task 1.3: 添加 Tween 清理防止内存泄漏
**优先级：** 🟠 高  
**难度：** ⭐⭐ 中等  
**耗时：** 2 小时  
**负责模块：** UI 渲染

**修改文件：**
1. `assets/scripts/ui/components/BoardView.ts`
2. `assets/scripts/ui/components/board/TileView.ts`

**具体实现：**

```typescript
// ========================================
// 文件：assets/scripts/ui/components/BoardView.ts
// ========================================

import { Tween } from 'cc';

export class BoardView {
  // 修改：rebuild 方法（第 99 行附近）
  public rebuild(snapshot: BoardSnapshot, animate = true): void {
    // ⚠️ 关键修改 1：倒序删除 + 停止动画
    const children = this.tileLayer!.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      Tween.stopAllByTarget(child);  // 停止所有 tween
      child.destroy();
    }

    const tileNodes = new Map<string, Node>();
    for (const tile of snapshot.tiles) {
      const node = this.createTileNode(tile, animate);
      this.tileLayer!.addChild(node);
      tileNodes.set(tile.id, node);
    }

    this.tileNodesValue = tileNodes;
  }

  // 新增：组件卸载时清理
  public onDestroy(): void {
    if (this.tileLayer) {
      this.tileLayer.children.forEach(child => {
        Tween.stopAllByTarget(child);
      });
    }
  }

  // 修改：playMergeAnimation 中的清理
  public playMergeAnimation(
    merge: MergeRecord,
    tileNodes: Map<string, Node>,
    onComplete: () => void
  ): void {
    // ... 现有动画代码 ...

    // ⚠️ 关键修改 2：销毁源节点前停止动画
    for (const id of merge.sourceIds) {
      const node = tileNodes.get(id);
      if (node) {
        Tween.stopAllByTarget(node);  // 停止动画
        node.destroy();
      }
      tileNodes.delete(id);
    }
  }
}
```

```typescript
// ========================================
// 文件：assets/scripts/ui/components/board/TileView.ts
// ========================================

export class TileView {
  // 修改：最高级猫咪的永久旋转动画（第 66 行附近）
  private applyHighestLevelEffect(node: Node): void {
    const halo = node.getChildByName('halo');
    if (!halo) return;

    // ⚠️ 关键修改：先停止已有动画，避免重复创建
    Tween.stopAllByTarget(halo);

    // 创建新的永久旋转动画
    tween(halo)
      .by(3, { angle: 360 })
      .repeatForever()
      .start();
  }

  // 新增：清理方法
  public cleanup(node: Node): void {
    Tween.stopAllByTarget(node);
    const halo = node.getChildByName('halo');
    if (halo) {
      Tween.stopAllByTarget(halo);
    }
  }
}
```

**测试步骤：**
1. 使用 Chrome DevTools Memory Profiler
2. 玩游戏 5 分钟，频繁移动和合并
3. 拍摄内存快照，检查是否有 tween 对象泄漏
4. 重复游戏 → 重新开始循环 10 次
5. 观察内存占用是否稳定

**验证标准：**
- [x] 长时间游戏后内存不持续增长
- [x] 重复游戏 10 次后内存占用稳定
- [x] 无控制台警告或错误

**预期收益：**
- 消除内存泄漏隐患
- 长时间游戏性能不衰减

---

#### ✅ Task 1.4: 移除不必要的数组拷贝
**优先级：** 🟡 中  
**难度：** ⭐ 简单  
**耗时：** 30 分钟  
**负责模块：** UI 渲染

**修改文件：**
1. `assets/scripts/ui/components/BoardView.ts:99`

**具体实现：**

```typescript
// ========================================
// 文件：assets/scripts/ui/components/BoardView.ts
// ========================================

export class BoardView {
  // 修改前（第 99 行）：
  // for (const child of [...this.tileLayer.children]) child.destroy();

  // 修改后：
  public rebuild(snapshot: BoardSnapshot, animate = true): void {
    const children = this.tileLayer!.children;
    
    // ⚠️ 倒序删除，避免索引问题和数组拷贝
    for (let i = children.length - 1; i >= 0; i--) {
      Tween.stopAllByTarget(children[i]);
      children[i].destroy();
    }

    // ... 其余代码保持不变 ...
  }
}
```

**验证标准：**
- [x] 功能正常，无视觉差异
- [x] 性能略有提升

**预期收益：**
- 每次 rebuild 减少一次数组分配
- 累积性能提升 5-10%

---

#### ✅ Task 1.5: 存储操作防抖
**优先级：** 🟡 中  
**难度：** ⭐⭐ 中等  
**耗时：** 2 小时  
**负责模块：** 存储管理

**修改文件：**
1. `assets/scripts/features/storage/runSession.ts`

**具体实现：**

```typescript
// ========================================
// 文件：assets/scripts/features/storage/runSession.ts
// ========================================

export class RunSessionStore {
  private saveTimer: number | null = null;
  private pendingSave: SavedRun | null = null;
  private readonly DEBOUNCE_MS = 500;

  // 修改：添加防抖逻辑
  public save(run: SavedRun): void {
    this.pendingSave = run;

    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      if (this.pendingSave) {
        this.persistNow(this.pendingSave);
        this.pendingSave = null;
      }
      this.saveTimer = null;
    }, this.DEBOUNCE_MS);
  }

  // 新增：立即保存（游戏结束时调用）
  public flush(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.pendingSave) {
      this.persistNow(this.pendingSave);
      this.pendingSave = null;
    }
  }

  // 提取：实际存储逻辑
  private persistNow(run: SavedRun): void {
    const normalized = normalizeSavedRun(run);
    if (!normalized) {
      console.error('[RunSessionStore] Invalid run data, skipping save');
      return;
    }
    
    try {
      this.storage.setItem(RUN_SESSION_SAVE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.error('[RunSessionStore] Failed to save run session:', error);
    }
  }
}
```

**修改调用位置：**

```typescript
// ========================================
// 文件：assets/scripts/ui/controllers/GameplayController.ts
// ========================================

export class GameplayController {
  private runSessionStore: RunSessionStore;

  // 游戏结束时立即保存
  private handleGameOver(): void {
    this.runSessionStore.flush();  // 新增：立即保存
    // ... 其余游戏结束逻辑 ...
  }

  // 组件卸载时也要 flush
  public onDestroy(): void {
    this.runSessionStore.flush();  // 新增：确保保存
  }
}
```

**测试步骤：**
1. 快速连续移动 20 次
2. 使用 Chrome DevTools → Application → Local Storage
3. 观察写入次数（应该远少于移动次数）
4. 游戏结束后立即检查存档完整性

**验证标准：**
- [x] localStorage 写入频率显著降低
- [x] 游戏结束时数据正确保存
- [x] 无数据丢失

**预期收益：**
- localStorage 写入次数减少 70%
- 序列化 CPU 开销降低 60%

---

### 🎯 阶段一验收标准

**性能指标：**
- [ ] 首屏加载时间：从 ~3s 降至 ~1.8s（-40%）
- [ ] 包体积：减少 1.2MB
- [ ] 首屏网络请求：减少 8-16 个
- [ ] 内存占用：降低 30%

**测试清单：**
- [ ] 清除缓存后首次加载正常
- [ ] 游戏流程完整，无功能缺失
- [ ] 长时间游戏无内存泄漏
- [ ] 所有资源正常显示

**提交要求：**
```bash
git add .
git commit -m "perf(stage1): 完成阶段一性能优化

- 压缩 8 个大尺寸图片，减少 1.2MB
- 调整资源预加载策略，首屏加载时间减少 40%
- 添加 Tween 清理防止内存泄漏
- 移除不必要的数组拷贝
- 存储操作防抖优化

预期收益：首屏加载 +40%，运行性能 +15%，内存占用 -30%"
```

---

## 🔧 阶段二：核心性能优化（3 天）

### 目标
- 运行时性能提升 30%
- 进一步减少内存占用 20%
- 优化网络请求和资源加载

### 任务清单

#### ✅ Task 2.1: 实现节点对象池
**优先级：** 🔴 最高  
**难度：** ⭐⭐⭐ 较难  
**耗时：** 4 小时  
**负责模块：** UI 渲染

**修改文件：**
1. `assets/scripts/ui/components/BoardView.ts`

**具体实现：**

```typescript
// ========================================
// 文件：assets/scripts/ui/components/BoardView.ts
// ========================================

import { Node, UITransform, Tween } from 'cc';

export class BoardView {
  private tilePool: Node[] = [];
  private readonly POOL_MAX_SIZE = 20;

  // 新增：从对象池获取节点
  private getTileNodeFromPool(): Node {
    const node = this.tilePool.pop();
    if (node) {
      node.active = true;
      return node;
    }
    return this.createNewTileNode();
  }

  // 新增：归还节点到对象池
  private returnTileNodeToPool(node: Node): void {
    if (this.tilePool.length < this.POOL_MAX_SIZE) {
      // 清理状态
      Tween.stopAllByTarget(node);
      node.active = false;
      node.removeFromParent();
      node.setPosition(0, 0, 0);
      node.setScale(1, 1, 1);
      
      // 清理子节点状态
      const halo = node.getChildByName('halo');
      if (halo) {
        Tween.stopAllByTarget(halo);
        halo.setRotationFromEuler(0, 0, 0);
      }

      this.tilePool.push(node);
    } else {
      node.destroy();
    }
  }

  // 新增：创建全新节点
  private createNewTileNode(): Node {
    const node = new Node('tile');
    node.addComponent(UITransform);
    
    // 添加光环节点（用于最高级动画）
    const halo = new Node('halo');
    halo.addComponent(UITransform);
    node.addChild(halo);
    
    return node;
  }

  // 修改：rebuild 使用对象池
  public rebuild(snapshot: BoardSnapshot, animate = true): void {
    const children = this.tileLayer!.children;
    
    // 归还所有节点到池
    for (let i = children.length - 1; i >= 0; i--) {
      this.returnTileNodeToPool(children[i]);
    }

    const tileNodes = new Map<string, Node>();
    for (const tile of snapshot.tiles) {
      // 从池获取节点
      const node = this.getTileNodeFromPool();
      this.setupTileNode(node, tile, animate);
      this.tileLayer!.addChild(node);
      tileNodes.set(tile.id, node);
    }

    this.tileNodesValue = tileNodes;
  }

  // 新增：设置节点状态
  private setupTileNode(node: Node, tile: Tile, animate: boolean): void {
    // 设置位置、贴图、等级等
    const pos = this.boardToLocal(tile.row, tile.col);
    node.setPosition(pos.x, pos.y, 0);
    
    // 加载贴图
    this.loadTileSprite(node, tile.level);
    
    // 如果是最高级，添加特效
    if (tile.level === 12) {
      this.applyHighestLevelEffect(node);
    }

    // 入场动画
    if (animate) {
      node.setScale(0, 0, 1);
      tween(node).to(0.15, { scale: new Vec3(1, 1, 1) }).start();
    }
  }

  // 修改：playMergeAnimation 使用对象池
  public playMergeAnimation(
    merge: MergeRecord,
    tileNodes: Map<string, Node>,
    onComplete: () => void
  ): void {
    // 源节点动画后归还池
    for (const id of merge.sourceIds) {
      const node = tileNodes.get(id);
      if (node) {
        tween(node)
          .to(0.15, { scale: new Vec3(0, 0, 1) })
          .call(() => {
            this.returnTileNodeToPool(node);  // 归还而非销毁
          })
          .start();
      }
      tileNodes.delete(id);
    }

    // ... 其余动画逻辑 ...
  }

  // 组件销毁时清空池
  public onDestroy(): void {
    this.tilePool.forEach(node => node.destroy());
    this.tilePool = [];
  }
}
```

**测试步骤：**
1. 使用 Chrome DevTools Performance 录制
2. 快速连续玩 3 局游戏
3. 分析 GC 频率和耗时
4. 对比优化前后的 GC 次数

**验证标准：**
- [x] 游戏流程正常，视觉无差异
- [x] GC 频率降低 50-70%
- [x] 帧率更稳定（波动 < 5 FPS）

**预期收益：**
- GC 频率降低 50-70%
- 节点创建开销减少 80%
- 帧率更稳定

---

#### ✅ Task 2.2: 将 UI 小图标打包成图集
**优先级：** 🟠 高  
**难度：** ⭐⭐ 中等  
**耗时：** 3 小时  
**负责模块：** 资源管理

**具体步骤：**

1. **使用 Cocos Creator 创建图集**

```bash
# 在 Cocos Creator 中操作：
# 1. 选中 assets/resources/game/ui/buttons/ 目录
# 2. 右键 → 创建 → Auto Atlas 配置
# 3. 设置配置：
#    - 最大尺寸：2048x2048
#    - 算法：MaxRects
#    - 格式：PNG8（如果无透明度复杂度）
#    - 2 的幂次：是
#    - 允许旋转：是

# 重复以下目录：
# - game/ui/icons/ → ui_icons
# - game/ui/home/ → ui_home
# - game/ui/shop/ → ui_shop
```

2. **修改资源加载代码**

```typescript
// ========================================
// 文件：assets/scripts/ui/utils/ArtRepository.ts
// ========================================

import { SpriteAtlas, SpriteFrame } from 'cc';

export class ArtRepository {
  private atlases = new Map<string, SpriteAtlas>();

  // 新增：加载图集
  private async loadAtlases(): Promise<void> {
    const atlasNames = ['ui_buttons', 'ui_icons', 'ui_home', 'ui_shop'];
    
    return new Promise((resolve, reject) => {
      resources.load(
        atlasNames.map(name => `game/ui/${name}`),
        SpriteAtlas,
        (err, atlases: SpriteAtlas[]) => {
          if (err) {
            reject(err);
            return;
          }
          
          atlases.forEach((atlas, index) => {
            this.atlases.set(atlasNames[index], atlas);
          });
          
          resolve();
        }
      );
    });
  }

  // 修改：从图集获取 SpriteFrame
  public frame(path: string): SpriteFrame | null {
    // 解析路径：game/ui/buttons/btn_play → ui_buttons / btn_play
    const match = path.match(/game\/ui\/(\w+)\/(.+)/);
    if (!match) {
      // 不在图集中的资源，走原有逻辑
      return this.legacyFrame(path);
    }

    const [, category, frameName] = match;
    const atlasKey = `ui_${category}`;
    const atlas = this.atlases.get(atlasKey);

    if (atlas) {
      return atlas.getSpriteFrame(frameName);
    }

    console.warn(`[ArtRepository] Atlas not found: ${atlasKey}`);
    return null;
  }

  // 保留：非图集资源的加载方式
  private legacyFrame(path: string): SpriteFrame | null {
    // ... 原有逻辑 ...
  }
}
```

3. **更新资源路径常量**

```typescript
// ========================================
// 文件：assets/scripts/core/config/gameConfig.ts
// ========================================

// 确保路径与图集名称匹配
export const GAME_CONFIG = {
  art: {
    // 这些会自动从图集加载
    back: 'game/ui/buttons/btn_back',
    settings: 'game/ui/icons/icon_settings',
    // ...
  }
};
```

**测试步骤：**
1. 重新构建项目
2. 清除缓存，启动游戏
3. 查看网络请求（开发者工具 Network 面板）
4. 确认只加载 4 个图集文件而非 45 个单独图片
5. 检查所有 UI 显示正常

**验证标准：**
- [x] 网络请求数减少 40 个（45 → 5）
- [x] 所有 UI 元素显示正常
- [x] 图集文件大小合理（每个 < 500KB）

**预期收益：**
- 网络请求数减少 40 个
- 首屏加载时间减少 15-25%
- GPU 纹理切换减少，渲染性能提升

---

#### ✅ Task 2.3: 缓存空格子列表
**优先级：** 🟡 中  
**难度：** ⭐⭐ 中等  
**耗时：** 2 小时  
**负责模块：** 核心逻辑

**修改文件：**
1. `assets/scripts/core/Board.ts`

**具体实现：**

```typescript
// ========================================
// 文件：assets/scripts/core/Board.ts
// ========================================

export class Board {
  private cachedEmptyCells: Position[] | null = null;

  // 修改：添加缓存
  public emptyCells(): Position[] {
    // 如果有缓存，直接返回
    if (this.cachedEmptyCells) {
      return this.cachedEmptyCells;
    }

    // 计算空格子
    const cells: Position[] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (!this.tileAt({ row, col })) {
          cells.push({ row, col });
        }
      }
    }

    // 缓存结果
    this.cachedEmptyCells = cells;
    return cells;
  }

  // 修改：添加瓦片时清除缓存
  public withAddedTile(tile: Tile): Board {
    const newTiles = [...this.tilesValue, tile];
    const board = new Board(this.size, newTiles);
    board.cachedEmptyCells = null;  // 清除缓存
    return board;
  }

  // 修改：移除瓦片时清除缓存
  public withoutTiles(ids: Set<string>): Board {
    const newTiles = this.tilesValue.filter(t => !ids.has(t.id));
    const board = new Board(this.size, newTiles);
    board.cachedEmptyCells = null;  // 清除缓存
    return board;
  }

  // 修改：移动时清除缓存
  public move(direction: Direction, factory: TileFactory): BoardMoveResult {
    // ... 现有移动逻辑 ...
    
    const newBoard = new Board(this.size, newTiles);
    newBoard.cachedEmptyCells = null;  // 清除缓存
    
    return { /* ... */ };
  }
}
```

**测试步骤：**
1. 添加单元测试验证缓存正确性
2. 运行性能基准测试
3. 对比优化前后的 `emptyCells()` 调用耗时

**验证标准：**
- [x] 单元测试通过
- [x] 每次移动节省 3-5ms
- [x] 无功能回归

**预期收益：**
- 每次移动节省 3-5ms
- 高频操作性能提升明显

---

#### ✅ Task 2.4: 排行榜请求批量化
**优先级：** 🟡 中  
**难度：** ⭐⭐⭐ 较难  
**耗时：** 4 小时  
**负责模块：** 网络请求

**修改文件：**
1. `assets/scripts/features/leaderboard/leaderboard.ts`
2. `assets/scripts/features/leaderboard/pendingQueue.ts`

**具体实现：**

```typescript
// ========================================
// 文件：assets/scripts/features/leaderboard/pendingQueue.ts
// ========================================

export class PendingQueue {
  private queue: ScoreSubmission[] = [];
  private flushTimer: number | null = null;
  private readonly BATCH_SIZE = 5;
  private readonly FLUSH_INTERVAL_MS = 5000;

  // 修改：添加到队列而非立即提交
  public enqueue(submission: ScoreSubmission): void {
    this.queue.push(submission);

    // 达到批量大小，立即提交
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
      return;
    }

    // 否则设置定时器
    if (this.flushTimer === null) {
      this.flushTimer = window.setTimeout(() => {
        this.flush();
      }, this.FLUSH_INTERVAL_MS);
    }
  }

  // 新增：批量提交
  public async flush(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.BATCH_SIZE);
    
    try {
      await this.client.submitBatch(batch);
      console.log(`[PendingQueue] Submitted ${batch.length} scores`);
    } catch (error) {
      console.error('[PendingQueue] Batch submission failed:', error);
      // 失败的放回队列头部
      this.queue.unshift(...batch);
      
      // 指数退避重试
      setTimeout(() => this.flush(), 10000);
    }
  }

  // 页面卸载时立即提交
  public onBeforeUnload(): void {
    if (this.queue.length > 0) {
      // 使用 sendBeacon 或同步请求
      this.syncSubmit(this.queue);
    }
  }

  private syncSubmit(submissions: ScoreSubmission[]): void {
    // 微信小游戏环境使用同步请求
    // 浏览器环境使用 sendBeacon
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        this.client.endpoint,
        JSON.stringify(submissions)
      );
    }
  }
}
```

```typescript
// ========================================
// 文件：assets/scripts/features/leaderboard/leaderboard.ts
// ========================================

export class LeaderboardClient {
  // 新增：批量提交接口
  public async submitBatch(submissions: ScoreSubmission[]): Promise<void> {
    if (submissions.length === 0) return;

    const response = await this.transport.request<{ success: number }>({
      method: 'POST',
      path: '/api/leaderboard/batch',
      body: { submissions },
      token: this.authToken,
    });

    if (response.success !== submissions.length) {
      throw new Error('Partial batch submission failure');
    }
  }
}
```

**后端对应接口：**

```typescript
// ========================================
// 文件：packages/server/src/leaderboard/leaderboard.controller.ts
// ========================================

@Post('batch')
async submitBatch(@Body() dto: { submissions: CreateScoreDto[] }) {
  const results = await this.leaderboardService.createMany(dto.submissions);
  return { success: results.length };
}
```

**测试步骤：**
1. 连续完成 10 局游戏
2. 观察网络请求（应该只有 2-3 个批量请求）
3. 检查后端数据库，确认所有成绩都已提交
4. 测试失败重试机制

**验证标准：**
- [x] 网络请求减少 60-80%
- [x] 所有成绩最终都能提交成功
- [x] 失败时正确重试

**预期收益：**
- 网络请求减少 60-80%
- 服务器负载降低
- 弱网环境下成功率提升

---

### 🎯 阶段二验收标准

**性能指标：**
- [ ] 运行时帧率：稳定 60 FPS
- [ ] GC 频率：降低 50-70%
- [ ] 内存占用：再降低 20%
- [ ] 网络请求：减少 40-50 个

**测试清单：**
- [ ] 对象池正常工作，无视觉差异
- [ ] 图集加载正常，所有 UI 显示正确
- [ ] 核心逻辑性能提升，单元测试通过
- [ ] 排行榜批量提交成功

**提交要求：**
```bash
git add .
git commit -m "perf(stage2): 完成阶段二性能优化

- 实现节点对象池，GC 频率降低 50-70%
- 将 UI 小图标打包成图集，网络请求减少 40 个
- 缓存空格子列表，移动性能提升
- 排行榜请求批量化，网络请求减少 60-80%

预期收益：运行性能 +30%，内存占用 -20%，网络请求 -40"
```

---

## 🎨 阶段三：深度优化（5 天）

### 目标
- 进一步优化资源加载策略
- 实现高级缓存机制
- 建立性能监控体系

### 任务清单

#### ✅ Task 3.1: 实现资源预加载优先级队列
**优先级：** 🟡 中  
**难度：** ⭐⭐⭐⭐ 困难  
**耗时：** 6 小时  
**负责模块：** 资源管理

**具体实现：**

```typescript
// ========================================
// 新文件：assets/scripts/ui/utils/ResourceLoader.ts
// ========================================

export enum LoadPriority {
  CRITICAL = 0,    // 首屏必需
  HIGH = 1,        // 首屏可见
  MEDIUM = 2,      // 即将使用
  LOW = 3,         // 可能使用
  BACKGROUND = 4,  // 后台加载
}

interface LoadTask {
  path: string;
  priority: LoadPriority;
  callback: (resource: any) => void;
}

export class PriorityResourceLoader {
  private queue: LoadTask[] = [];
  private loading = false;
  private concurrency = 2;
  private activeLoads = 0;

  public load(path: string, priority: LoadPriority): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ path, priority, callback: resolve });
      this.queue.sort((a, b) => a.priority - b.priority);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.loading || this.queue.length === 0) return;
    if (this.activeLoads >= this.concurrency) return;

    this.loading = true;
    const task = this.queue.shift();
    
    if (task) {
      this.activeLoads++;
      
      try {
        const resource = await this.loadResource(task.path);
        task.callback(resource);
      } catch (error) {
        console.error(`Failed to load ${task.path}:`, error);
      } finally {
        this.activeLoads--;
        this.loading = false;
        this.processQueue();
      }
    }
  }

  private loadResource(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      resources.load(path, (err, resource) => {
        if (err) reject(err);
        else resolve(resource);
      });
    });
  }
}
```

**预期收益：**
- 关键资源优先加载
- 首屏可交互时间减少 15-20%

---

#### ✅ Task 3.2: 实现 LRU 缓存清理策略
**优先级：** 🟡 中  
**难度：** ⭐⭐⭐ 较难  
**耗时：** 4 小时  
**负责模块：** 资源管理

**具体实现：**

```typescript
// ========================================
// 新文件：assets/scripts/ui/utils/LRUCache.ts
// ========================================

export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private accessOrder: K[] = [];
  
  constructor(private maxSize: number) {}

  public get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.updateAccess(key);
    }
    return value;
  }

  public set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
        this.releaseResource(oldest, this.cache.get(oldest));
      }
    }
    
    this.cache.set(key, value);
    this.updateAccess(key);
  }

  private updateAccess(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private releaseResource(key: K, value: V | undefined): void {
    // 释放 Cocos 资源
    if (value instanceof SpriteFrame || value instanceof Texture2D) {
      resources.release(String(key));
    }
  }
}
```

**预期收益：**
- 内存占用控制在合理范围
- 长时间游戏不会内存溢出

---

#### ✅ Task 3.3: 添加性能监控埋点
**优先级：** 🟠 高  
**难度：** ⭐⭐ 中等  
**耗时：** 4 小时  
**负责模块：** 监控

**具体实现：**

```typescript
// ========================================
// 新文件：assets/scripts/infrastructure/PerformanceMonitor.ts
// ========================================

export class PerformanceMonitor {
  private metrics = {
    fps: 0,
    memory: 0,
    loadTime: 0,
    renderTime: 0,
  };

  private frameCount = 0;
  private lastTime = performance.now();

  public startMonitoring(): void {
    // FPS 监控
    setInterval(() => {
      const now = performance.now();
      const delta = now - this.lastTime;
      this.metrics.fps = Math.round(this.frameCount / (delta / 1000));
      this.frameCount = 0;
      this.lastTime = now;
    }, 1000);

    // 内存监控（如果支持）
    if (performance.memory) {
      setInterval(() => {
        this.metrics.memory = Math.round(
          performance.memory.usedJSHeapSize / 1048576
        );
      }, 5000);
    }
  }

  public recordFrameRendered(): void {
    this.frameCount++;
  }

  public recordLoadTime(stage: string, duration: number): void {
    console.log(`[Perf] ${stage} took ${duration.toFixed(2)}ms`);
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  // 上报到分析服务
  public report(): void {
    if (typeof wx !== 'undefined') {
      wx.reportPerformance(/* ... */);
    }
  }
}
```

**预期收益：**
- 可量化性能改进效果
- 发现潜在性能问题

---

#### ✅ Task 3.4: 微信小游戏分包加载
**优先级：** 🟡 中  
**难度：** ⭐⭐⭐⭐ 困难  
**耗时：** 6 小时  
**负责模块：** 构建配置

**具体步骤：**

1. 配置分包结构

```json
// game.json
{
  "subpackages": [
    {
      "name": "shop",
      "root": "subpackages/shop/",
      "resources": [
        "resources/game/ui/shop/**"
      ]
    },
    {
      "name": "collection",
      "root": "subpackages/collection/",
      "resources": [
        "resources/game/ui/collection/**"
      ]
    }
  ]
}
```

2. 按需加载分包

```typescript
// 进入商店时加载
wx.loadSubpackage({
  name: 'shop',
  success: () => {
    console.log('[Subpackage] Shop loaded');
  },
  fail: (err) => {
    console.error('[Subpackage] Failed to load shop:', err);
  }
});
```

**预期收益：**
- 主包体积减少 30-40%
- 首次启动速度提升 25%

---

### 🎯 阶段三验收标准

**性能指标：**
- [ ] 首屏可交互时间 < 1.5s
- [ ] 内存占用稳定在 50MB 以内
- [ ] 长时间游戏无性能衰减
- [ ] 微信小游戏主包 < 4MB

**测试清单：**
- [ ] 优先级加载正常工作
- [ ] LRU 缓存正常清理
- [ ] 性能监控数据准确
- [ ] 分包加载无错误

**提交要求：**
```bash
git add .
git commit -m "perf(stage3): 完成阶段三深度优化

- 实现资源加载优先级队列
- 添加 LRU 缓存清理策略
- 集成性能监控埋点
- 配置微信小游戏分包加载

预期收益：首屏可交互时间 < 1.5s，内存稳定在 50MB 以内"
```

---

## 📊 性能测试方案

### 基准测试

**测试环境：**
- 设备：iPhone 12 / 小米 11
- 网络：4G / WiFi
- 浏览器：微信内置浏览器 / Chrome 120+

**测试指标：**

| 指标 | 优化前 | 目标 | 验证方式 |
|------|--------|------|---------|
| 首屏加载时间 | 3.2s | < 1.8s | Performance API |
| 包体积 | 8.5MB | < 7.0MB | 构建产物大小 |
| 首屏请求数 | 68 个 | < 25 个 | Network 面板 |
| 内存占用（启动） | 85MB | < 60MB | Memory Profiler |
| 内存占用（游戏 10 分钟） | 135MB | < 80MB | Memory Profiler |
| 平均帧率 | 55 FPS | 60 FPS | FPS Monitor |
| GC 频率 | 每 30s | 每 60s+ | Performance 面板 |

**测试脚本：**

```bash
#!/bin/bash
# performance_test.sh

echo "性能测试开始..."

# 1. 包体积测试
BUILD_SIZE=$(du -sh packages/game/build/wechatgame | awk '{print $1}')
echo "包体积: $BUILD_SIZE"

# 2. 启动时间测试（使用 Puppeteer）
node scripts/measure_startup_time.js

# 3. 内存测试
node scripts/measure_memory.js

# 4. 帧率测试
node scripts/measure_fps.js

echo "性能测试完成"
```

---

## 📝 验收清单

### 阶段一验收（2 天后）

- [ ] 图片资源总大小 < 700KB
- [ ] 首屏加载时间 < 1.8s
- [ ] 首屏网络请求 < 30 个
- [ ] 无内存泄漏
- [ ] 所有功能正常

### 阶段二验收（5 天后）

- [ ] 运行时帧率稳定 60 FPS
- [ ] GC 频率降低 50%+
- [ ] 对象池正常工作
- [ ] 图集加载正常
- [ ] 排行榜批量提交成功

### 阶段三验收（10 天后）

- [ ] 首屏可交互时间 < 1.5s
- [ ] 内存占用 < 50MB
- [ ] 性能监控数据准确
- [ ] 分包加载正常
- [ ] 长时间游戏无性能衰减

### 最终验收

- [ ] 所有测试指标达标
- [ ] 用户体验显著提升
- [ ] 无功能回归
- [ ] 代码质量保持
- [ ] 文档完善

---

## 🛠️ 工具和资源

### 开发工具

```bash
# 安装性能测试工具
npm install --save-dev lighthouse puppeteer

# 图片压缩
brew install pngquant imagemagick

# 性能分析
npm install --save-dev webpack-bundle-analyzer
```

### 监控脚本

```javascript
// scripts/measure_startup_time.js
const puppeteer = require('puppeteer');

async function measureStartup() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const startTime = Date.now();
  await page.goto('http://localhost:8080');
  await page.waitForSelector('.game-ready');
  const loadTime = Date.now() - startTime;
  
  console.log(`启动时间: ${loadTime}ms`);
  await browser.close();
}

measureStartup();
```

---

## 📖 参考文档

- [Cocos Creator 性能优化指南](https://docs.cocos.com/creator/manual/zh/advanced-topics/performance.html)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [微信小游戏性能优化](https://developers.weixin.qq.com/minigame/dev/guide/performance/)
- [Web Performance APIs](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API)

---

## 📞 支持和反馈

如果在优化过程中遇到问题：

1. 检查本文档的常见问题部分
2. 查看 git commit 历史，对比代码变更
3. 使用性能测试脚本验证问题
4. 记录详细的性能数据和错误日志

---

**祝优化顺利！🚀**
