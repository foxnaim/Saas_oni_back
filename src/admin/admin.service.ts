import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

const BCRYPT_ROUNDS = 12;

export interface PaginatedAdmins {
  data: Omit<User, 'password' | 'verificationToken' | 'resetPasswordToken'>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── List admins (paginated) ──────────────────────────────────────────────

  async findAll(page = 1, limit = 20): Promise<PaginatedAdmins> {
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip      = (safePage - 1) * safeLimit;

    const where = {
      role: { in: [UserRole.admin, UserRole.super_admin] as UserRole[] },
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          companyId: true,
          lastLogin: true,
          isVerified: true,
          resetPasswordExpires: true,
          telegramId: true,
          telegramUsername: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data as any[],
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  // ─── Create admin with auto-generated password ────────────────────────────

  async create(dto: CreateAdminDto): Promise<{ admin: User; plainPassword: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(`Email '${dto.email}' is already registered`);
    }

    const plainPassword = this.generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

    const admin = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: (dto.role ?? UserRole.admin) as UserRole,
        password: hashedPassword,
        isVerified: true,
      },
    });

    this.logger.log(`Admin created: ${admin.email} (${admin.role})`);
    return { admin, plainPassword };
  }

  // ─── Update admin ─────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateAdminDto): Promise<User> {
    // Check email uniqueness if being changed
    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`Email '${dto.email}' is already in use`);
      }
    }

    const updateData: Partial<{
      name: string;
      email: string;
      role: UserRole;
      password: string;
    }> = {};

    if (dto.name)     updateData.name  = dto.name;
    if (dto.email)    updateData.email = dto.email;
    if (dto.role)     updateData.role  = dto.role as UserRole;
    if (dto.password) updateData.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    if (!updated) {
      throw new NotFoundException(`Admin with id '${id}' not found`);
    }

    this.logger.log(`Admin updated: ${updated.email}`);
    return updated;
  }

  // ─── Delete admin + their associated users ────────────────────────────────

  async remove(id: string): Promise<{ deletedAdmin: string; associatedUsersDeleted: number }> {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: { in: [UserRole.admin, UserRole.super_admin] } },
    });

    if (!admin) {
      throw new NotFoundException(`Admin with id '${id}' not found`);
    }

    // Delete users associated with this admin
    const deletionResult = await this.prisma.user.deleteMany({
      where: {
        role: UserRole.user,
        companyId: id,
      },
    });

    await this.prisma.user.delete({ where: { id } });

    this.logger.warn(
      `Admin deleted: ${admin.email} (${id}). Associated users removed: ${deletionResult.count}`,
    );

    return {
      deletedAdmin: id,
      associatedUsersDeleted: deletionResult.count ?? 0,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private generatePassword(): string {
    const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower   = 'abcdefghijklmnopqrstuvwxyz';
    const digits  = '0123456789';
    const special = '!@#$%^&*()_+-=';
    const all     = upper + lower + digits + special;

    const rand = (charset: string) =>
      charset[randomBytes(1)[0] % charset.length];

    const core = [rand(upper), rand(lower), rand(digits), rand(special)];
    const rest = Array.from({ length: 8 }, () => rand(all));

    const chars = [...core, ...rest];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomBytes(1)[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }
}
