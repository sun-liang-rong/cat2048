export interface ScoreSubmissionInput {
  readonly playerId: string;
  readonly runId: string;
  readonly score: number;
  readonly highestLevel: number;
}

export interface RecordedScore {
  readonly duplicate: boolean;
  readonly accepted: boolean;
  readonly highScore: number;
  readonly highScoreAt: Date | null;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly nickname: string | null;
  readonly avatarUrl: string | null;
  readonly score: number;
  readonly achievedAt: Date;
}

export interface LeaderboardResult {
  readonly entries: readonly LeaderboardEntry[];
  readonly me: {
    readonly rank: number;
    readonly score: number;
  } | null;
}
