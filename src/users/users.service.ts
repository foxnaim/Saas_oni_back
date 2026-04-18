import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { User, AdminUser, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateAdminDto, UpdateAdminDto, PaginationDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── User lookups ───────────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ─── User creation ──────────────────────────────────────────────────────────

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(createUserDto.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    return this.prisma.user.create({
      data: {
        ...createUserDto,
        email: createUserDto.email.toLowerCase().trim(),
        role: (createUserDto.role as UserRole) ?? UserRole.user,
        telegramId: createUserDto.telegramId != null
          ? BigInt(createUserDto.telegramId)
          : undefined,
      },
    });
  }

  // ─── Login tracking ─────────────────────────────────────────────────────────

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  // ─── Password reset flow ────────────────────────────────────────────────────

  async setResetToken(email: string, token: string, expires: Date): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException('No user found with that email address');
    }

    return this.prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: expires,
      },
    });
  }

  async resetPassword(hashedToken: string, newPassword: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
  }

  // ─── Profile updates ────────────────────────────────────────────────────────

  async changeEmail(userId: string, newEmail: string): Promise<User> {
    const normalised = newEmail.toLowerCase().trim();

    const conflict = await this.findByEmail(normalised);
    if (conflict && conflict.id !== userId) {
      throw new ConflictException('Email address is already in use');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { email: normalised, isVerified: false, verificationToken: null },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async changePassword(userId: string, hashedPassword: string): Promise<void> {
    const result = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!result) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  // ─── Email verification ──────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Verification token is invalid or has already been used');
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null },
    });
  }

  // ─── Telegram info update ────────────────────────────────────────────────────

  async updateTelegramInfo(
    userId: string,
    telegramId: number | bigint | null,
    telegramUsername?: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramId: telegramId != null ? BigInt(telegramId) : undefined,
        telegramUsername: telegramUsername ?? undefined,
      },
    });
  }

  // ─── Admin management ───────────────────────────────────────────────────────

  async findAdmins(
    pagination: PaginationDto,
  ): Promise<{ data: AdminUser[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination.limit ?? 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.adminUser.count(),
    ]);

    return { data, total, page, limit };
  }

  async createAdmin(dto: CreateAdminDto): Promise<AdminUser> {
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An admin with this email already exists');
    }

    // Also create a corresponding User record so the admin can log in via the
    // standard auth flow with the admin/super_admin role.
    const userExists = await this.findByEmail(dto.email);
    if (!userExists) {
      await this.create({
        email: dto.email,
        password: dto.password,
        role: (dto.role ?? 'admin') as UserRole,
        name: dto.name,
        telegramId: dto.telegramId,
      });
    }

    return this.prisma.adminUser.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        name: dto.name,
        role: dto.role ?? 'admin',
        telegramId: dto.telegramId != null ? BigInt(dto.telegramId) : null,
      },
    });
  }

  async updateAdmin(id: string, dto: UpdateAdminDto): Promise<AdminUser> {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Admin not found');

    const admin = await this.prisma.adminUser.update({
      where: { id },
      data: { ...dto },
    });

    // Keep User record email in sync if it changed
    if (dto.email) {
      const userToUpdate = await this.prisma.user.findFirst({
        where: {
          email: { not: dto.email },
          role: { in: [UserRole.admin, UserRole.super_admin] },
        },
      });
      if (userToUpdate) {
        await this.prisma.user.update({
          where: { id: userToUpdate.id },
          data: { email: dto.email.toLowerCase().trim() },
        });
      }
    }

    return admin;
  }

  async deleteAdmin(id: string): Promise<void> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');

    await this.prisma.adminUser.delete({ where: { id } });

    // Remove corresponding user record as well
    await this.prisma.user.deleteMany({ where: { email: admin.email } });
  }

  async promoteToSuperAdmin(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.super_admin },
    });

    // Upsert the AdminUser mirror record
    await this.prisma.adminUser.upsert({
      where: { email: user.email },
      update: { role: 'super_admin', name: user.name ?? user.email },
      create: {
        email: user.email,
        name: user.name ?? user.email,
        role: 'super_admin',
      },
    });

    return updated;
  }
}
