import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateFreeSettingsDto {
  @ApiPropertyOptional({ example: 10, description: 'Max messages allowed on the free plan' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  messagesLimit?: number;

  @ApiPropertyOptional({ example: 1, description: 'Storage limit in GB for the free plan' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  storageLimit?: number;

  @ApiPropertyOptional({ example: 22, description: 'Free/trial period duration in days' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  freePeriodDays?: number;
}
