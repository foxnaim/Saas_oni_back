import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto, ResetPasswordDto, VerifyPasswordDto } from './dto/reset-password.dto';
import { ChangeEmailDto, ChangePasswordDto } from './dto/change-credentials.dto';
import { OauthSyncDto } from './dto/oauth-sync.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

// ─── Response envelope helpers ────────────────────────────────────────────────

function ok<T>(data: T, message?: string) {
  return { success: true, message: message ?? 'OK', data };
}

function message(msg: string) {
  return { success: true, message: msg };
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Public: no JWT required ──────────────────────────────────────────────

  /**
   * POST /auth/login
   * Authenticates with email + password, returns JWT and user profile.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns JWT access token and user profile' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return ok(result, 'Login successful');
  }

  /**
   * POST /auth/register
   * Creates a new user account.  When role === 'company', a Company record is
   * also created.  Returns JWT so the user is immediately authenticated.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user (or company)' })
  @ApiResponse({ status: 201, description: 'Account created, returns JWT and user profile' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return ok(result, 'Account created successfully. Please verify your email.');
  }

  /**
   * POST /auth/verify-email
   * Confirms email ownership via the token sent to the user's inbox.
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using token from email' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(dto.token);
    return message(result.message);
  }

  /**
   * POST /auth/verify-password
   * Checks a daily or stored password for anonymous message access.
   * Accepts a company code + password; does not require authentication.
   */
  @Public()
  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify daily/company password for anonymous access' })
  @ApiResponse({ status: 200, description: 'Returns { valid: boolean, companyId? }' })
  async verifyPassword(@Body() dto: VerifyPasswordDto) {
    const result = await this.authService.verifyPassword(dto.code, dto.password);
    return ok(result);
  }

  /**
   * POST /auth/forgot-password
   * Initiates the password-reset flow. Always returns 200 to prevent email enumeration.
   *
   * Note: the raw reset token is returned in the response body **only in
   * development** so it can be tested without an email server.  In production
   * the token should be emailed and the response body should be a generic message.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password-reset email' })
  @ApiResponse({ status: 200, description: 'Reset link sent if email exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Generic response — never reveal whether the address exists
    return message('If an account with that email exists, a reset link has been sent.');
  }

  /**
   * POST /auth/reset-password
   * Consumes the reset token and sets a new password.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(dto.token, dto.newPassword);
    return message(result.message);
  }

  /**
   * POST /auth/oauth-sync
   * Finds or creates a user from an OAuth provider.
   * Returns a JWT so the client can proceed without a password.
   */
  @Public()
  @Post('oauth-sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync / create user from OAuth provider' })
  @ApiResponse({ status: 200, description: 'Returns JWT and user profile' })
  async oauthSync(@Body() dto: OauthSyncDto) {
    const result = await this.authService.oauthSync(dto);
    return ok(result, 'OAuth sync successful');
  }

  /**
   * POST /auth/telegram-auth
   * Verifies Telegram Login Widget data using HMAC-SHA256 and logs in the user.
   */
  @Public()
  @Post('telegram-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate using Telegram Login Widget' })
  @ApiResponse({ status: 200, description: 'Returns JWT and user profile' })
  @ApiResponse({ status: 401, description: 'Invalid or expired Telegram auth data' })
  async telegramAuth(@Body() dto: TelegramAuthDto) {
    const result = await this.authService.validateTelegramAuth(dto);
    return ok(result, 'Telegram authentication successful');
  }

  // ─── Authenticated: JWT required ─────────────────────────────────────────

  /**
   * GET /auth/me
   * Returns the currently authenticated user's profile.
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: User) {
    const profile = await this.authService.getMe(user.id);
    return ok(profile);
  }

  /**
   * POST /auth/change-email
   * Changes the email of the authenticated user. Requires current password.
   */
  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change email address (requires current password)' })
  @ApiResponse({ status: 200, description: 'Email updated' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async changeEmail(
    @CurrentUser() user: User,
    @Body() dto: ChangeEmailDto,
  ) {
    const result = await this.authService.changeEmail(
      user.id,
      dto.newEmail,
      dto.currentPassword,
    );
    return message(result.message);
  }

  /**
   * POST /auth/change-password
   * Changes the password of the authenticated user.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (requires current password)' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return message(result.message);
  }
}
