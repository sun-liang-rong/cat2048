-- CreateTable
CREATE TABLE `Player` (
    `id` CHAR(36) NOT NULL,
    `openid` VARCHAR(128) NOT NULL,
    `nickname` VARCHAR(32) NULL,
    `avatarUrl` VARCHAR(512) NULL,
    `highScore` INTEGER NOT NULL DEFAULT 0,
    `highScoreAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Player_openid_key`(`openid`),
    INDEX `Player_highScore_highScoreAt_id_idx`(`highScore`, `highScoreAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoreSubmission` (
    `id` CHAR(36) NOT NULL,
    `playerId` CHAR(36) NOT NULL,
    `runId` VARCHAR(64) NOT NULL,
    `score` INTEGER NOT NULL,
    `highestLevel` TINYINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ScoreSubmission_playerId_createdAt_idx`(`playerId`, `createdAt`),
    UNIQUE INDEX `ScoreSubmission_playerId_runId_key`(`playerId`, `runId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ScoreSubmission` ADD CONSTRAINT `ScoreSubmission_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
