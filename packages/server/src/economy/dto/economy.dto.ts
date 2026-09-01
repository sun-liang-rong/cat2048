import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CURRENT_MIGRATION_VERSION } from '../economy.catalog';

export class EquippedEconomyDto {
  @IsString()
  @IsNotEmpty()
  public catSkin!: string;

  @IsString()
  @IsNotEmpty()
  public board!: string;

  @IsString()
  @IsNotEmpty()
  public effect!: string;
}

export class EconomyItemsDto {
  @IsInt()
  @Min(0)
  @Max(100)
  public undo!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  public spawn!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  public shuffle!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  public erase!: number;
}

export class MigrateEconomyDto {
  @IsInt()
  @Min(1)
  @Max(10)
  @Equals(CURRENT_MIGRATION_VERSION)
  public migrationVersion!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  public saveSchemaVersion!: number;

  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  public coins!: number;

  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  public ownedItemIds!: string[];

  @IsArray()
  @ArrayMaxSize(32)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  public unlockedCatLevels!: number[];

  @ValidateNested()
  @Type(() => EquippedEconomyDto)
  public equipped!: EquippedEconomyDto;

  @ValidateNested()
  @Type(() => EconomyItemsDto)
  public items!: EconomyItemsDto;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public lastDailyClaimDate?: string | null;

  @IsInt()
  @Min(0)
  @Max(3650)
  public dailyStreak!: number;
}

export class RunRewardDto {
  @IsString()
  @MaxLength(64)
  @IsNotEmpty()
  public runId!: string;

  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  public score!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  public highestLevel!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  public discoveredLevels?: number[];
}

export class DailyClaimDto {
  @IsOptional()
  @IsBoolean()
  public doubleReward?: boolean;
}

export class ItemMutationDto {
  @IsString()
  @MaxLength(16)
  @IsNotEmpty()
  public kind!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  public amount!: number;
}

export class PurchaseEconomyDto {
  @IsString()
  @IsNotEmpty()
  public itemId!: string;
}

export class EquipEconomyDto {
  @IsString()
  @IsNotEmpty()
  public itemId!: string;
}

export class TaskRewardDto {
  @IsString()
  @MaxLength(32)
  @IsNotEmpty()
  public taskId!: string;
}
