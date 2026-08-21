import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class SubmitScoreDto {
  @IsString()
  @Length(1, 64)
  public runId!: string;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  public score!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  public highestLevel!: number;
}
