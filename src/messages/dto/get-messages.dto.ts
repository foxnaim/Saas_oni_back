import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MessageStatus, MessageType } from '@prisma/client';

export class GetMessagesDto {
  // --- Pagination ---

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // --- Filters ---

  @ApiPropertyOptional({
    description: 'Filter by company code (exactly 8 characters)',
    example: 'ACME0001',
  })
  @IsOptional()
  @IsString()
  @Length(8, 8, { message: 'companyCode must be exactly 8 characters' })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  companyCode?: string;

  @ApiPropertyOptional({
    enum: MessageStatus,
    description: 'Filter by message status',
  })
  @IsOptional()
  @IsEnum(MessageStatus, {
    message: `status must be one of: ${Object.values(MessageStatus).join(', ')}`,
  })
  status?: MessageStatus;

  @ApiPropertyOptional({
    enum: MessageType,
    description: 'Filter by message type',
  })
  @IsOptional()
  @IsEnum(MessageType, {
    message: `type must be one of: ${Object.values(MessageType).join(', ')}`,
  })
  type?: MessageType;

  @ApiPropertyOptional({
    description: 'Start of date range (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'dateFrom must be a valid ISO 8601 date string' })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'End of date range (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'dateTo must be a valid ISO 8601 date string' })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Full-text search within message content',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  search?: string;

  // --- Sorting ---

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'status', 'type'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['createdAt', 'updatedAt', 'status', 'type'], {
    message: 'sortBy must be one of: createdAt, updatedAt, status, type',
  })
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'type' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'sortOrder must be asc or desc' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}
