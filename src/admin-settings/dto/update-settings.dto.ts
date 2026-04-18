import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export enum Language {
  RU = 'ru',
  EN = 'en',
  KK = 'kk',
}

export enum Theme {
  LIGHT  = 'light',
  DARK   = 'dark',
  SYSTEM = 'system',
}

/**
 * All fields are optional — only supplied fields are applied (PATCH semantics).
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Enable fullscreen mode in the admin panel' })
  @IsOptional()
  @IsBoolean()
  fullscreenMode?: boolean;

  @ApiPropertyOptional({
    enum:    Language,
    example: Language.EN,
    description: 'UI language preference',
  })
  @IsOptional()
  @IsEnum(Language, { message: 'language must be one of: ru, en, kk' })
  language?: Language;

  @ApiPropertyOptional({
    enum:    Theme,
    example: Theme.SYSTEM,
    description: 'UI colour theme preference',
  })
  @IsOptional()
  @IsEnum(Theme, { message: 'theme must be one of: light, dark, system' })
  theme?: Theme;

  @ApiPropertyOptional({
    description: 'Number of items per page (5 – 100)',
    minimum:     5,
    maximum:     100,
    example:     20,
  })
  @IsOptional()
  @IsInt({ message: 'itemsPerPage must be an integer' })
  @Min(5,   { message: 'itemsPerPage must be at least 5' })
  @Max(100, { message: 'itemsPerPage must not exceed 100' })
  itemsPerPage?: number;

  @ApiPropertyOptional({ description: 'Enable in-app notifications' })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Receive notifications via email' })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    description:
      'WhatsApp number used for support contact (international format, e.g. +77001234567). ' +
      'Send null or omit to clear.',
    example: '+77001234567',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'supportWhatsAppNumber must not exceed 20 characters' })
  @Matches(/^\+?[0-9\s\-().]{7,20}$/, {
    message: 'supportWhatsAppNumber must be a valid phone number',
  })
  supportWhatsAppNumber?: string;

  @ApiPropertyOptional({ description: 'Receive notifications via Telegram', default: true })
  @IsOptional()
  @IsBoolean()
  telegramNotifications?: boolean;
}
