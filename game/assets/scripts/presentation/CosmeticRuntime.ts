import { Color, SpriteFrame } from 'cc';
import { DEFAULT_EQUIPPED, findCosmetic, type EquippedCosmetics } from '../economy/catalog';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';

export interface ButtonTheme {
  readonly primary: Color;
  readonly secondary: Color;
  readonly reward: Color;
  readonly cream: Color;
  readonly primaryFrame?: SpriteFrame;
  readonly secondaryFrame?: SpriteFrame;
  readonly rewardFrame?: SpriteFrame;
  readonly creamFrame?: SpriteFrame;
}

const BUTTON_THEMES: Record<string, ButtonTheme> = {
  'button-theme.classic': {
    primary: new Color(239, 100, 83, 255),
    secondary: new Color(39, 166, 151, 255),
    reward: new Color(245, 180, 54, 255),
    cream: new Color(248, 225, 181, 255),
  },
  'button-theme.berry': {
    primary: new Color(201, 71, 107, 255),
    secondary: new Color(39, 147, 157, 255),
    reward: new Color(239, 154, 56, 255),
    cream: new Color(250, 220, 205, 255),
  },
  'button-theme.aurora': {
    primary: new Color(121, 82, 190, 255),
    secondary: new Color(25, 164, 164, 255),
    reward: new Color(226, 160, 64, 255),
    cream: new Color(226, 222, 244, 255),
  },
};

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

  public buttonTheme(): ButtonTheme {
    const theme = BUTTON_THEMES[this.equipped.buttonTheme] ?? BUTTON_THEMES[DEFAULT_EQUIPPED.buttonTheme];
    const item = findCosmetic(this.equipped.buttonTheme);
    return {
      ...theme,
      primaryFrame: item?.primaryAsset ? this.art.frame(item.primaryAsset) : undefined,
      secondaryFrame: item?.secondaryAsset ? this.art.frame(item.secondaryAsset) : undefined,
      rewardFrame: item?.rewardAsset ? this.art.frame(item.rewardAsset) : undefined,
      creamFrame: item?.creamAsset ? this.art.frame(item.creamAsset) : undefined,
    };
  }
}
