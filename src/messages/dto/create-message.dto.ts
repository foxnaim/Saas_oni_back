import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { MessageType } from '@prisma/client';

export class CreateMessageDto {
  @ApiProperty({
    example: 'ACME0001',
    description: 'Company code (exactly 8 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'companyCode is required' })
  @Length(8, 8, { message: 'companyCode must be exactly 8 characters' })
  @Matches(/^[A-Za-z0-9]+$/, { message: 'companyCode must be alphanumeric' })
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  companyCode: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.complaint,
    description: 'Message type: complaint | praise | suggestion',
  })
  @IsEnum(MessageType, {
    message: `type must be one of: ${Object.values(MessageType).join(', ')}`,
  })
  type: MessageType;

  @ApiProperty({
    example: 'The service was excellent and the staff very helpful.',
    description: 'Message content (1 – 5000 characters)',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty({ message: 'content is required' })
  @Length(1, 5000, { message: 'content must be between 1 and 5000 characters' })
  content: string;
}
