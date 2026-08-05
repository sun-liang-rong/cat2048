export interface PlayerSummary {
  readonly id: string;
  readonly nickname: string | null;
  readonly avatarUrl: string | null;
  readonly highScore: number;
}
