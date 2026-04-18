import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token received via email' })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;
}
