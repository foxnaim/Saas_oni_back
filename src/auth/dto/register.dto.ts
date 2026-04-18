import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum UserRole {
  USER = 'user',
  COMPANY = 'company',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// Only roles that may be self-assigned during public registration.
// ADMIN and SUPER_ADMIN are intentionally excluded to prevent privilege escalation.
const REGISTERABLE_ROLES = [UserRole.USER, UserRole.COMPANY] as const;
export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description:
      'Min 8 chars, at least one uppercase letter, one lowercase letter, one digit, and one special character',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/(?=.*[a-z])/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/(?=.*[A-Z])/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/(?=.*\d)/, { message: 'Password must contain at least one digit' })
  @Matches(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least one special character',
  })
  password: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Transform(({ value }: { value: string }) => value?.trim())
  name: string;

  @ApiProperty({ enum: REGISTERABLE_ROLES, example: UserRole.USER })
  @IsIn(REGISTERABLE_ROLES, { message: 'Role must be one of: user, company' })
  role: RegisterableRole;

  // --- Optional company fields (required when role === 'company') ---

  @ApiPropertyOptional({ example: 'Acme Corporation' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  companyName?: string;

  @ApiPropertyOptional({ example: 'We build awesome software.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  companyDescription?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl({}, { message: 'Company website must be a valid URL' })
  companyWebsite?: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyIndustry?: string;

  @ApiPropertyOptional({ example: '50-200' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companySize?: string;
}
