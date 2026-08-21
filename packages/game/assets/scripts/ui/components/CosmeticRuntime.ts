import { SpriteFrame } from 'cc';
import { DEFAULT_EQUIPPED, findCosmetic, type EquippedCosmetics } from '../../features/economy/catalog';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';

export class CosmeticRuntime {
  private equipped: EquippedCosmetics = { ...DEFAULT_EQUIPPED };

  public constructor(private readonly art: ArtRepository) {}

  public setEquipped(equipped: EquippedCosmetics): void {
    this.equipped = { ...equipped };
  }

  public get state(): EquippedCosmetics {
    return { ...this.equipped };
  }

  public catFrame(level: number): SpriteFrame | undefined {
    const cat = GAME_CONFIG.cats[level - 1];
    const defaultFrame = cat ? this.art.frame(cat.asset) : undefined;
    const item = findCosmetic(this.equipped.catSkin);
    const path = item?.levelAssets?.[level - 1];
    return (path ? this.art.frame(path) : undefined) ?? defaultFrame;
  }

  public boardFrame(): SpriteFrame | undefined {
    const defaultFrame = this.art.frame(GAME_CONFIG.art.boardBackground);
    const item = findCosmetic(this.equipped.board);
    return (item?.boardAsset ? this.art.frame(item.boardAsset) : undefined) ?? defaultFrame;
  }

  public mergeSparkleFrame(): SpriteFrame | undefined {
    const defaultFrame = this.art.frame(GAME_CONFIG.art.mergeSparkle);
    const item = findCosmetic(this.equipped.effect);
    return (item?.sparkleAsset ? this.art.frame(item.sparkleAsset) : undefined) ?? defaultFrame;
  }

  public mergeBurstFrame(): SpriteFrame | undefined {
    const defaultFrame = this.art.frame(GAME_CONFIG.art.mergeBurst);
    const item = findCosmetic(this.equipped.effect);
    return (item?.burstAsset ? this.art.frame(item.burstAsset) : undefined) ?? defaultFrame;
  }
}
