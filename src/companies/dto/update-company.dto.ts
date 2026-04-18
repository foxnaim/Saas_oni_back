import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CompanyStatus } from '@prisma/client';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme Corp Updated' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'admin@acme.com' })
  @IsEmail()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  adminEmail?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  fullscreenMode?: boolean;

  @ApiPropertyOptional({ example: '+77001234567' })
  @IsString()
  @IsOptional()
  supportWhatsApp?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  messagesLimit?: number;

  @ApiPropertyOptional({ example: 2147483648 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  storageLimit?: number;

  @ApiPropertyOptional({ example: '-100123456789' })
  @IsString()
  @IsOptional()
  telegramChatId?: string;
}

export class UpdateStatusDto {
  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsEnum(CompanyStatus)
  status: CompanyStatus;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: '664f1b2e-8f1b-2c3d-4e5f-6a7b8c9d0e1f' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59.000Z' })
  @IsString()
  planEndDate: string;
}

export class UpdatePasswordDto {
  @ApiPropertyOptional({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class VerifyPaymentDto {
  @ApiPropertyOptional({ example: 'PAY-1AB23456CD789012EF345678' })
  @IsString()
  orderId: string;
}

export class LinkTelegramDto {
  @ApiPropertyOptional({ example: '-100123456789' })
  @IsString()
  telegramChatId: string;
}

export class DeleteCompanyDto {
  @ApiPropertyOptional({ example: 'CurrentPass123!' })
  @IsString()
  @IsOptional()
  password?: string;
}
