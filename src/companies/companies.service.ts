import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { Company, CompanyStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PayPalService } from './paypal.service';

export { CompanyStatus };

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface CompanyFilters {
  status?: CompanyStatus;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type CompanyWithPlan = Prisma.CompanyGetPayload<{ include: { plan: true } }>;

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payPalService: PayPalService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(randomInt(chars.length));
    }
    return result;
  }

  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = this.generateCode();
      attempts++;
      const existing = await this.prisma.company.findUnique({ where: { code } });
      if (!existing) {
        return code;
      }
    } while (attempts < maxAttempts);

    throw new BadRequestException('Failed to generate a unique company code. Please try again.');
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  async findAll(
    pagination: PaginationOptions = {},
    filters: CompanyFilters = {},
  ): Promise<PaginatedResult<CompanyWithPlan>> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { adminEmail: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: { plan: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<CompanyWithPlan> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID "${id}" not found`);
    }

    return company;
  }

  async findByCode(code: string): Promise<CompanyWithPlan> {
    const company = await this.prisma.company.findUnique({
      where: { code: code.toUpperCase() },
      include: { plan: true },
    });

    if (!company) {
      throw new NotFoundException(`Company with code "${code}" not found`);
    }

    return company;
  }

  async findPublicCompanies(): Promise<Pick<Company, 'id' | 'name' | 'code' | 'logoUrl' | 'fullscreenMode'>[]> {
    return this.prisma.company.findMany({
      where: { status: { not: CompanyStatus.Blocked } },
      select: {
        id: true,
        name: true,
        code: true,
        logoUrl: true,
        fullscreenMode: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  async create(dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.prisma.company.findUnique({
      where: { adminEmail: dto.adminEmail.toLowerCase() },
    });

    if (existing) {
      throw new BadRequestException(`A company with email "${dto.adminEmail}" already exists`);
    }

    const code = await this.generateUniqueCode();

    // Trial expires in 14 days
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    return this.prisma.company.create({
      data: {
        ...dto,
        adminEmail: dto.adminEmail.toLowerCase(),
        code,
        status: CompanyStatus.Trial,
        trialEndDate,
        trialUsed: false,
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<CompanyWithPlan> {
    await this.findById(id);

    return this.prisma.company.update({
      where: { id },
      data: dto,
      include: { plan: true },
    });
  }

  async updateStatus(id: string, status: CompanyStatus): Promise<CompanyWithPlan> {
    await this.findById(id);

    return this.prisma.company.update({
      where: { id },
      data: { status },
      include: { plan: true },
    });
  }

  async updatePlan(
    id: string,
    planId: string,
    endDate: string,
  ): Promise<CompanyWithPlan> {
    await this.findById(id);

    const planEndDate = new Date(endDate);
    if (isNaN(planEndDate.getTime())) {
      throw new BadRequestException(`Invalid plan end date: ${endDate}`);
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        planId,
        planEndDate,
        status: CompanyStatus.Active,
      },
      include: { plan: true },
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.findById(id);

    await this.prisma.company.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async expireTrial(id: string): Promise<CompanyWithPlan> {
    await this.findById(id);

    return this.prisma.company.update({
      where: { id },
      data: {
        status: CompanyStatus.Blocked,
        trialUsed: true,
      },
      include: { plan: true },
    });
  }

  async delete(id: string): Promise<void> {
    const company = await this.findById(id);

    await this.prisma.company.delete({ where: { id: company.id } });

    this.logger.log(`Company "${company.name}" (${id}) deleted`);
  }

  // ─── Counters ────────────────────────────────────────────────────────────────

  async incrementMessageCount(companyId: string): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        messages: { increment: 1 },
        messagesThisMonth: { increment: 1 },
      },
    });
  }

  async decrementMessageCount(companyId: string): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        messages: { decrement: 1 },
        messagesThisMonth: { decrement: 1 },
      },
    });
  }

  // ─── Payment ─────────────────────────────────────────────────────────────────

  async verifyPaymentAndUpgrade(
    id: string,
    orderId: string,
  ): Promise<{ company: CompanyWithPlan; order: { id: string; status: string; amount: { currency_code: string; value: string } | null } }> {
    const company = await this.findById(id);

    this.logger.log(
      `Verifying PayPal order "${orderId}" for company "${company.name}" (${id})`,
    );

    const order = await this.payPalService.verifyOrder(orderId);

    if (order.status === 'COMPLETED') {
      await this.prisma.company.update({
        where: { id },
        data: { status: CompanyStatus.Active },
      });

      const updated = await this.findById(id);
      return { company: updated, order };
    }

    return { company, order };
  }

  // ─── Telegram ────────────────────────────────────────────────────────────────

  async linkTelegram(id: string, telegramChatId: string): Promise<CompanyWithPlan> {
    await this.findById(id);

    const updated = await this.prisma.company.update({
      where: { id },
      data: { telegramChatId },
      include: { plan: true },
    });

    this.logger.log(`Company ${id} linked to Telegram chat ${telegramChatId}`);
    return updated;
  }
}
