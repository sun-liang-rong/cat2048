import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { SubmitScoreDto } from './submit-score.dto';

/** 批量提交成绩：一次请求最多 20 条，超出请分批发送。 */
export class SubmitScoresBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SubmitScoreDto)
  public scores!: SubmitScoreDto[];
}
