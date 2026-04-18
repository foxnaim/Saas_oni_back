import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Company display name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'admin@acme.com', description: 'Admin email address' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  adminEmail: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Company admin password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png', description: 'Company logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: false, description: 'Enable fullscreen mode for the feedback widget' })
  @IsBoolean()
  @IsOptional()
  fullscreenMode?: boolean;

  @ApiPropertyOptional({ example: '+77001234567', description: 'WhatsApp support number' })
  @IsString()
  @IsOptional()
  supportWhatsApp?: string;

  @ApiPropertyOptional({ example: 500, description: 'Monthly message limit' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  messagesLimit?: number;

  @ApiPropertyOptional({ example: 1073741824, description: 'Storage limit in bytes' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  storageLimit?: number;

  @ApiPropertyOptional({ example: '-100123456789', description: 'Telegram chat ID for notifications' })
  @IsString()
  @IsOptional()
  telegramChatId?: string;
}
