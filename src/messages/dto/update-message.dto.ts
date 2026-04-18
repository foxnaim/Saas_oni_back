import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MessageStatus } from '@prisma/client';

export class UpdateMessageDto {
  @ApiProperty({
    enum: MessageStatus,
    example: MessageStatus.InProgress,
    description: 'New status for the message',
  })
  @IsEnum(MessageStatus, {
    message: `status must be one of: ${Object.values(MessageStatus).join(', ')}`,
  })
  status: MessageStatus;

  @ApiPropertyOptional({
    example: 'Thank you for your feedback. We are looking into this.',
    description: 'Optional company response (max 2000 characters)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'companyResponse must not exceed 2000 characters' })
  companyResponse?: string;
}
