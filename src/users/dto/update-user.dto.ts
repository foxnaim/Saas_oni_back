import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}

// ─── Admin-specific DTOs ──────────────────────────────────────────────────────

export class CreateAdminDto {
  @ApiPropertyOptional({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Admin Name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: ['admin', 'super_admin'], default: 'admin' })
  @IsEnum(['admin', 'super_admin'])
  @IsOptional()
  role?: 'admin' | 'super_admin';

  @ApiPropertyOptional({ example: 123456789 })
  @IsNumber()
  @IsOptional()
  telegramId?: number;
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'newemail@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ['admin', 'super_admin'] })
  @IsEnum(['admin', 'super_admin'])
  @IsOptional()
  role?: 'admin' | 'super_admin';

  @ApiPropertyOptional({ example: 987654321 })
  @IsNumber()
  @IsOptional()
  telegramId?: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsNumber()
  @IsOptional()
  limit?: number = 20;
}
