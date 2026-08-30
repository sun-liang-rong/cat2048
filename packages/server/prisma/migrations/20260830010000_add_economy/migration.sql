-- CreateTable
CREATE TABLE `PlayerEconomy` (
    `playerId` CHAR(36) NOT NULL,
    `coins` INTEGER NOT NULL DEFAULT 100,
    `lastDailyClaimDate` VARCHAR(10) NULL,
    `dailyStreak` INTEGER NOT NULL DEFAULT 0,
    `dailyCounterDate` VARCHAR(10) NULL,
    `dailyLoginClaimed` BOOLEAN NOT NULL DEFAULT false,
    `dailyShareUndo` INTEGER NOT NULL DEFAULT 0,
    `dailyAdUndo` INTEGER NOT NULL DEFAULT 0,
    `dailyAdSpawn` INTEGER NOT NULL DEFAULT 0,
    `dailyAdShuffle` INTEGER NOT NULL DEFAULT 0,
    `dailyAdErase` INTEGER NOT NULL DEFAULT 0,
    `undoItems` INTEGER NOT NULL DEFAULT 0,
    `spawnItems` INTEGER NOT NULL DEFAULT 0,
    `shuffleItems` INTEGER NOT NULL DEFAULT 0,
    `eraseItems` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `migrationVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`playerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerOwnedItem` (
    `playerId` CHAR(36) NOT NULL,
    `itemId` VARCHAR(128) NOT NULL,
    `purchasedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlayerOwnedItem_playerId_purchasedAt_idx`(`playerId`, `purchasedAt`),
    PRIMARY KEY (`playerId`, `itemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerCollectionUnlock` (
    `playerId` CHAR(36) NOT NULL,
    `level` TINYINT NOT NULL,
    `unlockedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` VARCHAR(32) NOT NULL,

    INDEX `PlayerCollectionUnlock_playerId_unlockedAt_idx`(`playerId`, `unlockedAt`),
    PRIMARY KEY (`playerId`, `level`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerEquipped` (
    `playerId` CHAR(36) NOT NULL,
    `catSkinId` VARCHAR(128) NOT NULL DEFAULT 'cat-skin.default',
    `boardId` VARCHAR(128) NOT NULL DEFAULT 'board.wood',
    `effectId` VARCHAR(128) NOT NULL DEFAULT 'effect.classic',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`playerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunReward` (
    `playerId` CHAR(36) NOT NULL,
    `runId` VARCHAR(64) NOT NULL,
    `score` INTEGER NOT NULL,
    `highestLevel` TINYINT NOT NULL,
    `awardedCoins` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunReward_playerId_createdAt_idx`(`playerId`, `createdAt`),
    PRIMARY KEY (`playerId`, `runId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionRewardClaim` (
    `playerId` CHAR(36) NOT NULL,
    `threshold` TINYINT NOT NULL,
    `awardedCoins` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`playerId`, `threshold`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EconomyOperation` (
    `playerId` CHAR(36) NOT NULL,
    `idempotencyKey` VARCHAR(128) NOT NULL,
    `operationType` VARCHAR(32) NOT NULL,
    `requestPayload` JSON NULL,
    `resultSnapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EconomyOperation_playerId_createdAt_idx`(`playerId`, `createdAt`),
    PRIMARY KEY (`playerId`, `idempotencyKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EconomyMigration` (
    `playerId` CHAR(36) NOT NULL,
    `migrationVersion` INTEGER NOT NULL,
    `migrationId` VARCHAR(128) NOT NULL,
    `importedCoins` INTEGER NOT NULL DEFAULT 0,
    `importedItemCount` INTEGER NOT NULL DEFAULT 0,
    `importedCollectionCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EconomyMigration_playerId_migrationId_key`(`playerId`, `migrationId`),
    PRIMARY KEY (`playerId`, `migrationVersion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EconomyLedger` (
    `id` CHAR(36) NOT NULL,
    `playerId` CHAR(36) NOT NULL,
    `operationType` VARCHAR(32) NOT NULL,
    `deltaCoins` INTEGER NOT NULL DEFAULT 0,
    `referenceId` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EconomyLedger_playerId_createdAt_idx`(`playerId`, `createdAt`),
    INDEX `EconomyLedger_playerId_operationType_idx`(`playerId`, `operationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlayerEconomy` ADD CONSTRAINT `PlayerEconomy_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlayerOwnedItem` ADD CONSTRAINT `PlayerOwnedItem_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlayerCollectionUnlock` ADD CONSTRAINT `PlayerCollectionUnlock_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlayerEquipped` ADD CONSTRAINT `PlayerEquipped_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RunReward` ADD CONSTRAINT `RunReward_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CollectionRewardClaim` ADD CONSTRAINT `CollectionRewardClaim_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EconomyOperation` ADD CONSTRAINT `EconomyOperation_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EconomyMigration` ADD CONSTRAINT `EconomyMigration_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EconomyLedger` ADD CONSTRAINT `EconomyLedger_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `DailyTaskClaim` (
    `playerId` CHAR(36) NOT NULL,
    `date` VARCHAR(10) NOT NULL,
    `taskId` VARCHAR(32) NOT NULL,
    `awardedCoins` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DailyTaskClaim_playerId_date_idx`(`playerId`, `date`),
    PRIMARY KEY (`playerId`, `date`, `taskId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DailyTaskClaim` ADD CONSTRAINT `DailyTaskClaim_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
