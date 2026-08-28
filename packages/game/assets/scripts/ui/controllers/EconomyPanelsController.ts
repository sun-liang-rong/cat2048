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
          this.dailyRewardOverlay?.destroy();
          this.dailyRewardOverlay = null;
          this.deps.unlockInput();
        },
      });
  }

  public async claimDailyReward(): Promise<void> {
    if (this.dailyClaimInProgress || !this.dailyRewardOverlay?.isValid) return;
    this.dailyClaimInProgress = true;
    try {
      const result = await this.deps.economy.claimDailyReward();
      this.deps.applyEconomyResult(result);
      if (!result.ok) {
        this.deps.unlockInput();
        this.deps.showNotice('今日奖励已领取');
        return;
      }
      await this.deps.economy.grantItem('undo', 2);
      await this.deps.economy.grantItem('erase', 1);
      this.deps.applyEconomySnapshot(await this.deps.economy.load());
      this.dailyRewardOverlay?.destroy();
      this.dailyRewardOverlay = null;
      this.deps.unlockInput();
      if (this.deps.getCurrentScreen() === 'shop') this.showShop();
      else this.deps.showHome();
    } catch (error) {
      console.warn('[Cat2048] Failed to claim daily reward.', error);
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
      const result = this.deps.tasks.claim(taskId);
      if (result.ok) {
        await this.deps.economy.grantCoins(result.awardedCoins);
        this.deps.applyEconomySnapshot(await this.deps.economy.load());
      } else {
        this.deps.showNotice('任务尚未完成');
      }
      this.deps.taskPanel.refresh(result.snapshot, {
        onClaim: (id) => { void this.claimTask(id); },
        onClose: () => this.closeTasks(),
      });
      // 即时同步首页红点，避免关闭面板后仍残留。
      this.deps.refreshHome();
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
      this.showShop();
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
      this.deps.unlockInput();
      this.showShop();
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
    const unlockedLevels = this.deps.getSave().unlockedCatLevels;
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
      unlockedLevels: this.deps.getSave().unlockedCatLevels,
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
