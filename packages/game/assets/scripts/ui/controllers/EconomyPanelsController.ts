/**
 * 经济面板流程控制器（从 Cat2048Boot 拆出）。
 *
 * 负责每日奖励、任务、商店、图鉴弹窗/页面的打开、领取与购买流程。
 * 依赖通过 deps 注入（回调访问宿主状态），不直接持有宿主引用。
 */
import { Node } from 'cc';
import type { CollectionOrigin } from '../screens/CollectionView';
import type { ArtRepository } from '../utils/ArtRepository';
import type { CosmeticRuntime } from '../components/CosmeticRuntime';
import type { EconomyRepository, EconomySnapshot, EconomyMutationResult } from '../../features/economy/economy';
import type { LocalDailyTaskRepository } from '../../features/tasks/dailyTasks';
import type { ModalView } from '../panels/ModalView';
import type { DailyRewardView } from '../panels/DailyRewardView';
import type { TaskPanelView } from '../panels/TaskPanelView';
import type { CatDetailModal } from '../panels/CatDetailModal';
import type { ShopView } from '../screens/ShopView';
import type { CollectionView } from '../screens/CollectionView';
import type { SaveDataV3 } from '../../features/storage/saveTypes';
import type { SavedRunMode } from '../../features/storage/runSession';
import type { CosmeticCategory } from '../../features/economy/catalog';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import {
  collectionAssetPaths,
  collectionCatAssets,
  equippedCosmeticAssetPaths,
  shopPreviewAssetPaths,
} from '../utils/assetPaths';
import { economyErrorText } from '../../features/economy/errors';
import { mergeCollectionLevels } from '../../features/gameplay/collectionProgress';

export type ScreenName = 'loading' | 'home' | 'game' | 'collection' | 'shop' | 'leaderboard';

export interface EconomyPanelsDeps {
  readonly art: ArtRepository;
  readonly cosmetics: CosmeticRuntime;
  readonly economy: EconomyRepository;
  readonly tasks: LocalDailyTaskRepository;
  readonly dialogs: ModalView;
  readonly dailyRewardView: DailyRewardView;
  readonly taskPanel: TaskPanelView;
  readonly shopView: ShopView;
  readonly collectionView: CollectionView;
  readonly catDetailModal: CatDetailModal;
  readonly getScreenRoot: () => Node | null;
  readonly getCurrentScreen: () => ScreenName;
  readonly getSceneToken: () => number;
  readonly getSave: () => SaveDataV3;
  readonly getEconomySnapshot: () => EconomySnapshot;
  readonly getSize: () => { width: number; height: number };
  readonly topInset: () => number;
  readonly bottomInset: () => number;
  readonly isInputLocked: () => boolean;
  readonly lockInput: () => void;
  readonly unlockInput: () => void;
  readonly applyEconomyResult: (result: EconomyMutationResult) => void;
  readonly applyEconomySnapshot: (snapshot: EconomySnapshot) => void;
  readonly showNotice: (text: string) => void;
  readonly showHome: () => void;
  /** 仅刷新首页视图（金币、红点等状态），不重建屏幕；非首页时无副作用。 */
  readonly refreshHome: () => void;
  readonly showGame: (resume: boolean, mode?: SavedRunMode) => void;
  readonly makeScreen: (name: string) => Node;
  readonly clearScreen: () => void;
  readonly setCurrentScreen: (name: ScreenName) => void;
}

export class EconomyPanelsController {
  private dailyRewardOverlay: Node | null = null;
  private taskOverlay: Node | null = null;
  private taskClaimInProgress = false;
  private dailyClaimInProgress = false;
  private dailyPromptShown = false;
  private collectionOrigin: CollectionOrigin = 'home';
  private catDetailOverlay: Node | null = null;
  private shopLoadGeneration = 0;
  private collectionLoadGeneration = 0;

  public constructor(private readonly deps: EconomyPanelsDeps) {}

  /** 屏幕切换时重置弹窗与领取状态（由宿主 clearScreen 调用）。 */
  public resetOverlays(): void {
    this.dailyRewardOverlay = null;
    this.taskOverlay = null;
    this.catDetailOverlay = null;
    this.taskClaimInProgress = false;
    this.dailyClaimInProgress = false;
    this.shopLoadGeneration += 1;
    this.collectionLoadGeneration += 1;
  }

  /** 首页展示时，若每日奖励可领取则弹出（每会话一次）。 */
  public promptDailyRewardIfDue(): void {
    if (this.deps.getEconomySnapshot().canClaimDaily && !this.dailyPromptShown) {
      this.dailyPromptShown = true;
      this.showDailyReward();
    }
  }

  public showDailyReward(): void {
    const screenRoot = this.deps.getScreenRoot();
    if (!screenRoot || this.dailyRewardOverlay?.isValid) return;
    this.deps.lockInput();
    const { width, height } = this.deps.getSize();
    this.dailyRewardOverlay = this.deps.dailyRewardView.show(screenRoot, this.deps.getEconomySnapshot(),
      width, height, {
        onClaim: () => { void this.claimDailyReward(); },
        onClose: () => {
          if (this.dailyClaimInProgress) return;
          this.closeDailyReward();
        },
      });
  }

  /** 立即移除每日奖励遮罩，避免等待页面重建或下一帧才解除输入锁。 */
  private closeDailyReward(): void {
    const overlay = this.dailyRewardOverlay;
    this.dailyRewardOverlay = null;
    if (overlay?.isValid) {
      overlay.removeFromParent();
      overlay.destroy();
    }
    this.deps.unlockInput();
  }

  private refreshDailyRewardHost(): void {
    const screen = this.deps.getCurrentScreen();
    if (screen === 'shop') this.showShop();
    else if (screen === 'home') this.deps.refreshHome();
    else this.deps.showHome();
  }

  public async claimDailyReward(): Promise<void> {
    if (this.dailyClaimInProgress || !this.dailyRewardOverlay?.isValid) return;
    this.dailyClaimInProgress = true;
    try {
      const result = await this.deps.economy.claimDailyReward();
      this.deps.applyEconomyResult(result);
      if (!result.ok) {
        this.deps.dailyRewardView.setClaimEnabled(false);
        this.closeDailyReward();
        this.refreshDailyRewardHost();
        this.deps.showNotice(result.reason === 'already-claimed' ? '今日奖励已领取' : '每日奖励不可领取');
        return;
      }
      // mutation 已返回服务端最新快照，不再用可能过期的本地缓存覆盖它。
      this.deps.dailyRewardView.setClaimEnabled(false);
      this.closeDailyReward();
      this.refreshDailyRewardHost();
      // 先完成遮罩移除/页面刷新，再显示成功反馈，避免提示被旧节点覆盖。
      this.deps.showNotice(`领取成功：+${result.awardedCoins} 金币`);
    } catch (error) {
      console.warn('[Cat2048] Failed to claim daily reward.', error);
      this.deps.dailyRewardView.setClaimEnabled(true);
      this.deps.unlockInput();
      this.deps.showNotice('每日奖励领取失败');
    } finally {
      this.dailyClaimInProgress = false;
    }
  }

  public showTasks(): void {
    const screenRoot = this.deps.getScreenRoot();
    if (!screenRoot || this.taskOverlay?.isValid) return;
    this.deps.lockInput();
    const { width, height } = this.deps.getSize();
    this.taskOverlay = this.deps.taskPanel.show(screenRoot, this.deps.tasks.snapshot(),
      width, height, {
        onClaim: (taskId) => { void this.claimTask(taskId); },
        onClose: () => this.closeTasks(),
      });
  }

  private closeTasks(): void {
    if (this.taskClaimInProgress) return;
    this.taskOverlay?.destroy();
    this.taskOverlay = null;
    this.deps.unlockInput();
    // 领取后首页任务红点可能变化（全部领取完应隐藏），关闭时同步刷新。
    this.deps.refreshHome();
  }

  public async claimTask(taskId: string): Promise<void> {
    if (this.taskClaimInProgress || !this.taskOverlay?.isValid) return;
    this.taskClaimInProgress = true;
    try {
      const taskSnapshot = this.deps.tasks.snapshot();
      const task = taskSnapshot.items.find((item) => item.id === taskId);
      let nextTaskSnapshot = taskSnapshot;
      let successNotice: string | null = null;
      if (!task || task.progress < task.target || task.claimed) {
        this.deps.showNotice(task?.claimed ? '任务奖励已领取' : '任务尚未完成');
      } else if (this.deps.economy.serverAuthoritative) {
        // 先让服务端确认，避免网络失败时本地先标记已领取而丢失奖励。
        const remote = await this.deps.economy.claimTaskReward(taskId, task.rewardCoins);
        if (remote.ok || remote.reason === 'already-claimed') {
          nextTaskSnapshot = this.deps.tasks.claim(taskId).snapshot;
          this.deps.applyEconomyResult(remote);
          successNotice = remote.ok
            ? `任务奖励 +${remote.awardedCoins} 金币`
            : '任务奖励已领取';
        } else {
          this.deps.showNotice(remote.reason === 'invalid-task' ? '任务不可领取' : '任务奖励已领取');
        }
      } else {
        const result = this.deps.tasks.claim(taskId);
        nextTaskSnapshot = result.snapshot;
        if (result.ok) {
          const reward = await this.deps.economy.claimTaskReward(taskId, result.awardedCoins);
          this.deps.applyEconomyResult(reward);
          successNotice = reward.ok
            ? `任务奖励 +${reward.awardedCoins} 金币`
            : '任务奖励领取失败';
        } else {
          this.deps.showNotice('任务尚未完成');
        }
      }
      this.deps.taskPanel.refresh(nextTaskSnapshot, {
        onClaim: (id) => { void this.claimTask(id); },
        onClose: () => this.closeTasks(),
      });
      // 即时同步首页红点，避免关闭面板后仍残留。
      this.deps.refreshHome();
      if (successNotice) this.deps.showNotice(successNotice);
    } catch (error) {
      console.warn('[Cat2048] Failed to claim task reward.', error);
      this.deps.showNotice('任务奖励领取失败');
    } finally {
      this.taskClaimInProgress = false;
    }
  }

  public showShop(): void {
    void this.openShop();
  }

  private async openShop(): Promise<void> {
    this.renderShop();
    const token = this.deps.getSceneToken();
    await this.loadShopCategory(this.deps.shopView.selectedCategory, token);
  }

  private async loadShopCategory(category: CosmeticCategory, token: number): Promise<void> {
    const generation = ++this.shopLoadGeneration;
    const paths = shopPreviewAssetPaths(this.deps.getEconomySnapshot().catalog, category);
    try {
      await this.deps.art.loadFramesBatched(paths, 2, () => {
        if (generation !== this.shopLoadGeneration || token !== this.deps.getSceneToken()) return;
        if (this.deps.getCurrentScreen() !== 'shop'
          || this.deps.shopView.selectedCategory !== category) return;
        this.deps.shopView.refreshContent();
      });
    } catch (error) {
      console.warn(`[Cat2048] Failed to load ${category} shop previews, showing fallbacks.`, error);
    }
  }

  private renderShop(): void {
    this.deps.clearScreen();
    this.deps.setCurrentScreen('shop');
    const root = this.deps.makeScreen('Shop');
    this.deps.shopView.build(root, {
      economy: this.deps.getEconomySnapshot(),
      uiWidth: this.deps.getSize().width,
      uiHeight: this.deps.getSize().height,
      topInset: this.deps.topInset(),
      bottomInset: this.deps.bottomInset(),
    }, {
      onBack: () => this.deps.showHome(),
      onDailyReward: () => this.showDailyReward(),
      onPurchase: (itemId) => { void this.purchaseCosmetic(itemId); },
      onEquip: (itemId) => { void this.equipCosmetic(itemId); },
      onCategoryChange: (category) => {
        void this.loadShopCategory(category, this.deps.getSceneToken());
      },
    });
  }

  public async purchaseCosmetic(itemId: string): Promise<void> {
    if (this.deps.isInputLocked()) return;
    this.deps.lockInput();
    try {
      const result = await this.deps.economy.purchase(itemId);
      this.deps.applyEconomyResult(result);
      this.deps.unlockInput();
      if (!result.ok) {
        // 金币不足时给出赚取引导，其余情况沿用通用错误文案
        this.deps.showNotice(result.reason === 'insufficient-coins'
          ? '金币不足，完成每日任务可赚金币哦'
          : economyErrorText(result));
        return;
      }
      const purchased = this.deps.getEconomySnapshot().catalog.find((item) => item.id === itemId);
      this.showShop();
      this.deps.showNotice(purchased ? `购买成功：${purchased.name}` : '购买成功');
    } catch (error) {
      this.deps.unlockInput();
      console.warn('[Cat2048] Failed to purchase cosmetic.', error);
      this.deps.showNotice('购买失败，请稍后重试');
    }
  }

  public async equipCosmetic(itemId: string): Promise<void> {
    if (this.deps.isInputLocked()) return;
    this.deps.lockInput();
    try {
      const result = await this.deps.economy.equip(itemId);
      this.deps.applyEconomyResult(result);
      if (!result.ok) {
        this.deps.unlockInput();
        this.deps.showNotice('该装饰尚未拥有');
        return;
      }
      try {
        await this.deps.art.loadFramesBatched(
          equippedCosmeticAssetPaths(this.deps.getEconomySnapshot().catalog, itemId),
          2,
        );
      } catch (error) {
        console.warn(`[Cat2048] Failed to warm equipped cosmetic ${itemId}.`, error);
      }
      const equipped = this.deps.getEconomySnapshot().catalog.find((item) => item.id === itemId);
      this.deps.unlockInput();
      this.showShop();
      this.deps.showNotice(equipped ? `装备成功：${equipped.name}` : '装备成功');
    } catch (error) {
      this.deps.unlockInput();
      console.warn('[Cat2048] Failed to equip cosmetic.', error);
      this.deps.showNotice('装备失败，请稍后重试');
    }
  }

  public showCollection(origin: CollectionOrigin): void {
    this.collectionOrigin = origin;
    void this.openCollection(origin);
  }

  /** 最近一次图鉴入口来源（resize 恢复时使用）。 */
  public get lastCollectionOrigin(): CollectionOrigin {
    return this.collectionOrigin;
  }

  private async openCollection(origin: CollectionOrigin): Promise<void> {
    // 页面先显示已缓存图片和占位卡，缺失立绘在后台逐批补齐。
    this.renderCollection(origin);
    const token = this.deps.getSceneToken();
    const generation = ++this.collectionLoadGeneration;
    const isCurrent = (): boolean => generation === this.collectionLoadGeneration
      && token === this.deps.getSceneToken()
      && this.deps.getCurrentScreen() === 'collection';
    const snapshot = this.deps.getEconomySnapshot();
    // Normalize historical/stale saves before selecting the cat assets to
    // warm; otherwise repaired Lv.8/Lv.9 cards would have no sprite loaded.
    const unlockedLevels = mergeCollectionLevels(this.deps.getSave().unlockedCatLevels);
    const skinId = this.deps.getSave().economy.equipped.catSkin;
    const catAssets = collectionCatAssets(snapshot.catalog, skinId, unlockedLevels);
    const levelsByPath = new Map(catAssets.map((asset) => [asset.path, asset.level]));
    try {
      await this.deps.art.loadFramesBatched(collectionAssetPaths(), 3);
      if (isCurrent()) this.deps.collectionView.refreshCards(GAME_CONFIG.cats.map((cat) => cat.level));
      await this.deps.art.loadFramesBatched(catAssets.map((asset) => asset.path), 2, (loadedPaths) => {
        if (!isCurrent()) return;
        this.deps.collectionView.refreshCards(loadedPaths
          .map((path) => levelsByPath.get(path))
          .filter((level): level is number => level !== undefined));
      });
    } catch (error) {
      console.warn('[Cat2048] Failed to load collection assets, showing fallbacks.', error);
    }
  }

  private renderCollection(origin: CollectionOrigin): void {
    this.deps.clearScreen();
    this.deps.setCurrentScreen('collection');
    const root = this.deps.makeScreen('Collection');
    this.deps.collectionView.build(root, {
      unlockedLevels: mergeCollectionLevels(this.deps.getSave().unlockedCatLevels),
      uiWidth: this.deps.getSize().width,
      uiHeight: this.deps.getSize().height,
      topInset: this.deps.topInset(),
      bottomInset: this.deps.bottomInset(),
    }, {
      onBack: () => {
        if (origin === 'game') this.deps.showGame(false);
        else this.deps.showHome();
      },
      onCardTap: (cat, unlocked) => this.showCatDetail(cat, unlocked),
    });
  }

  /**
   * 打开猫咪详情弹窗。同屏只会存在一个详详情弹窗，避免多层遮罩堆叠。
   * `lockInput` / `unlockInput` 由弹窗生命周期控制。
   */
  public showCatDetail(cat: (typeof GAME_CONFIG.cats)[number],
    unlocked: boolean): void {
    const screenRoot = this.deps.getScreenRoot();
    if (!screenRoot || this.catDetailOverlay?.isValid) return;
    this.deps.lockInput();
    const { width, height } = this.deps.getSize();
    this.catDetailOverlay = this.deps.catDetailModal.show(screenRoot, cat, unlocked, width, height, {
      onClose: () => {
        this.catDetailOverlay?.destroy();
        this.catDetailOverlay = null;
        this.deps.unlockInput();
      },
    });
  }
}
