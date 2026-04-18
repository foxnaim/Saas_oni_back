import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { RegisterDto } from './dto/register.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { OauthSyncDto } from './dto/oauth-sync.dto';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: SafeUser;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string | null | undefined;
  role: string;
  isVerified: boolean;
  lastLogin: Date | null | undefined;
  companyId: string | null | undefined;
}

export interface VerifyPasswordResult {
  valid: boolean;
  companyId?: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** bcrypt rounds — tuned for ~100 ms on typical hardware */
  private readonly SALT_ROUNDS = 12;

  /** Reset token validity window */
  private readonly RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

  /** Telegram auth_date freshness window */
  private readonly TELEGRAM_AUTH_TTL_SECONDS = 3600; // 1 hour

  constructor(
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Validate raw credentials — used by LocalStrategy.
   * Returns the user or null (never throws, Passport handles the rest).
   */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) return null;

      const valid = await this.comparePassword(password, user.password);
      return valid ? user : null;
    } catch {
      return null;
    }
  }

  /**
   * Full login flow: validate credentials, issue JWT, update lastLogin.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.usersService.updateLastLogin(user.id);

    const token = this.generateToken(user);
    return { accessToken: token, user: this.toSafeUser(user) };
  }

  /**
   * Register a new user.
   * When role === 'company', a Company document is also created.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (dto.role === UserRole.company && !dto.companyName) {
      throw new BadRequestException('Company name is required when registering as a company');
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      role: dto.role as unknown as UserRole,
      name: dto.name,
      verificationToken,
    });

    if (dto.role === UserRole.company) {
      try {
        await this.companiesService.create({
          name: dto.companyName!,
          adminEmail: dto.email,
          password: hashedPassword,
        });
      } catch (err) {
        this.logger.error(`Company creation failed during registration for ${dto.email}`, err);
        throw err;
      }
    }

    const token = this.generateToken(user);
    return { accessToken: token, user: this.toSafeUser(user) };
  }

  /**
   * Confirm email ownership via the token sent to the user's inbox.
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    await this.usersService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  /**
   * Initiate password-reset flow.
   */
  async forgotPassword(email: string): Promise<{ rawToken: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { rawToken: '' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + this.RESET_TOKEN_TTL_MS);

    await this.usersService.setResetToken(email, hashedToken, expires);

    return { rawToken };
  }

  /**
   * Consume a reset token and set the new password.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hashedPassword = await this.hashPassword(newPassword);
    await this.usersService.resetPassword(hashedToken, hashedPassword);
    return { message: 'Password has been reset successfully' };
  }

  /**
   * Change the email address of an authenticated user.
   */
  async changeEmail(
    userId: string,
    newEmail: string,
    currentPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const valid = await this.comparePassword(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const conflict = await this.usersService.findByEmail(newEmail);
    if (conflict && conflict.id !== userId) {
      throw new ConflictException('Email address is already in use');
    }

    await this.usersService.changeEmail(userId, newEmail);
    return { message: 'Email address updated. Please verify your new email.' };
  }

  /**
   * Change the password of an authenticated user.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const valid = await this.comparePassword(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const hashedPassword = await this.hashPassword(newPassword);
    await this.usersService.changePassword(userId, hashedPassword);
    return { message: 'Password changed successfully' };
  }

  /**
   * Verify anonymous access password.
   */
  async verifyPassword(code: string, password: string): Promise<VerifyPasswordResult> {
    const dailyPassword = this.generateDailyPassword();
    if (password === dailyPassword) {
      return { valid: true };
    }

    try {
      const company = await this.companiesService.findByCode(code);
      const valid = await this.comparePassword(password, company.password);
      if (valid) {
        return { valid: true, companyId: company.id };
      }
    } catch {
      // Company not found — fall through
    }

    return { valid: false };
  }

  /**
   * OAuth sync: find an existing user or create a new OAuth-only user.
   */
  async oauthSync(dto: OauthSyncDto): Promise<AuthResponse> {
    let user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      const unusableHash = await this.hashPassword(crypto.randomBytes(32).toString('hex'));
      user = await this.usersService.create({
        email: dto.email,
        password: unusableHash,
        role: UserRole.user,
        name: dto.name ?? undefined,
        verificationToken: undefined,
      });
    }

    await this.usersService.updateLastLogin(user.id);
    const token = this.generateToken(user);
    return { accessToken: token, user: this.toSafeUser(user) };
  }

  /**
   * Validate Telegram Login Widget data.
   */
  async validateTelegramAuth(dto: TelegramAuthDto): Promise<AuthResponse> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('Telegram authentication is not configured on this server');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - dto.auth_date > this.TELEGRAM_AUTH_TTL_SECONDS) {
      throw new UnauthorizedException('Telegram authentication data has expired');
    }

    const { hash, ...fields } = dto;
    const dataCheckString = Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (
      hashBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Telegram authentication hash is invalid');
    }

    const syntheticEmail = `telegram_${dto.id}@telegram.local`;
    let user = await this.usersService.findByEmail(syntheticEmail);

    if (!user) {
      const unusableHash = await this.hashPassword(crypto.randomBytes(32).toString('hex'));
      user = await this.usersService.create({
        email: syntheticEmail,
        password: unusableHash,
        role: UserRole.user,
        name: dto.first_name,
        verificationToken: undefined,
      });
    }

    // Persist Telegram-specific fields if they changed
    const telegramId = dto.id;
    const telegramUsername = dto.username;
    const needsUpdate =
      (user.telegramId == null || user.telegramId.toString() !== String(telegramId)) ||
      (telegramUsername && user.telegramUsername !== telegramUsername);

    if (needsUpdate) {
      try {
        await this.usersService.updateTelegramInfo(user.id, telegramId, telegramUsername);
      } catch {
        /* best-effort */
      }
    }

    await this.usersService.updateLastLogin(user.id);
    const token = this.generateToken(user);
    return { accessToken: token, user: this.toSafeUser(user) };
  }

  /**
   * Return the currently authenticated user's profile.
   */
  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.toSafeUser(user);
  }

  // ─── Daily Password ──────────────────────────────────────────────────────────

  generateDailyPassword(date?: Date): string {
    const secret = this.configService.get<string>('JWT_SECRET') ?? '';
    const dateStr = (date ?? new Date()).toISOString().slice(0, 10);
    return crypto
      .createHmac('sha256', secret)
      .update(`daily:${dateStr}`)
      .digest('hex')
      .slice(0, 16);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  private async hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.SALT_ROUNDS);
  }

  private async comparePassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
      companyId: user.companyId ?? null,
    };
  }
}
