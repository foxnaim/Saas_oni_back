import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PlanNameDto {
  @ApiProperty({ example: 'Стандарт' })
  @IsString()
  @IsNotEmpty()
  ru: string;

  @ApiProperty({ example: 'Standard' })
  @IsString()
  @IsNotEmpty()
  en: string;

  @ApiProperty({ example: 'Стандарт' })
  @IsString()
  @IsNotEmpty()
  kk: string;
}

export class CreatePlanDto {
  @ApiProperty({
    description: 'Plan name — either a plain string or a multilingual object',
    oneOf: [
      { type: 'string', example: 'Standard' },
      { $ref: '#/components/schemas/PlanNameDto' },
    ],
  })
  @IsNotEmpty()
  name: string | PlanNameDto;

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  messagesLimit: number;

  @ApiProperty({ example: 5, description: 'Storage limit in GB' })
  @IsNumber()
  @Min(0)
  storageLimit: number;

  @ApiPropertyOptional({ example: ['analytics', 'export', 'api_access'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ example: 14, description: 'Trial/free period in days' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  freePeriodDays?: number;
}
