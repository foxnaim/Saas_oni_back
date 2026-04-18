import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SubscriptionPlan, FreePlanSettings } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdateFreeSettingsDto } from './dto/update-free-settings.dto';

// ---------------------------------------------------------------------------
// Feature matrix returned by getPlanPermissions()
// ---------------------------------------------------------------------------
export interface PlanPermissions {
  analytics: boolean;
  export: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
  multipleAdmins: boolean;
  advancedReports: boolean;
  webhooks: false | boolean;
  unlimitedStorage: boolean;
  unlimitedMessages: boolean;
}

// ---------------------------------------------------------------------------
// Shape of an enriched plan returned by findAll()
// ---------------------------------------------------------------------------
export interface PlanWithStats {
  plan: SubscriptionPlan;
  companyCount: number;
  expiredCount: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
@Injectable()
export class PlansService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  // Ensure the singleton free-plan settings document exists on startup
  async onModuleInit(): Promise<void> {
    await this.prisma.freePlanSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  // ---------------------------------------------------------------------------
  // findAll — returns every plan with company counts and expiry stats
  // ---------------------------------------------------------------------------
  async findAll(): Promise<PlanWithStats[]> {
    const plans = await this.prisma.subscriptionPlan.findMany();
    const now = new Date();

    const results: PlanWithStats[] = await Promise.all(
      plans.map(async (plan) => {
        const [companyCount, expiredCount] = await Promise.all([
          this.prisma.company.count({ where: { planId: plan.id } }),
          this.prisma.company.count({
            where: { planId: plan.id, planEndDate: { lt: now } },
          }),
        ]);

        return {
          plan,
          companyCount,
          expiredCount,
        };
      }),
    );

    return results;
  }

  // ---------------------------------------------------------------------------
  // create — admin only (enforced at controller level)
  // ---------------------------------------------------------------------------
  async create(dto: CreatePlanDto): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.create({ data: dto as any });
  }

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------
  async findById(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Plan with id "${planId}" not found`);
    }
    return plan;
  }

  // ---------------------------------------------------------------------------
  // Free-plan settings (singleton document)
  // ---------------------------------------------------------------------------
  async getFreePlanSettings(): Promise<FreePlanSettings> {
    const settings = await this.prisma.freePlanSettings.findUnique({
      where: { id: 'default' },
    });

    // Should never happen after onModuleInit, but guard anyway
    if (!settings) {
      return this.prisma.freePlanSettings.create({
        data: { id: 'default' },
      });
    }

    return settings;
  }

  async updateFreePlanSettings(
    dto: UpdateFreeSettingsDto,
  ): Promise<FreePlanSettings> {
    return this.prisma.freePlanSettings.upsert({
      where: { id: 'default' },
      update: dto as any,
      create: { id: 'default', ...dto } as any,
    });
  }

  // ---------------------------------------------------------------------------
  // isTrialPlan — returns true when the given plan id belongs to a free/trial plan
  // ---------------------------------------------------------------------------
  async isTrialPlan(planId: string): Promise<boolean> {
    try {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: planId },
        select: { isFree: true },
      });
      return plan?.isFree === true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // isTrialExpired — compares company.trialEndDate against the current timestamp
  // ---------------------------------------------------------------------------
  isTrialExpired(company: { trialEndDate?: Date | null }): boolean {
    if (!company.trialEndDate) return false;
    return new Date() > new Date(company.trialEndDate);
  }

  // ---------------------------------------------------------------------------
  // isPlanExpired — compares company.planEndDate against the current timestamp
  // ---------------------------------------------------------------------------
  isPlanExpired(company: { planEndDate?: Date | null }): boolean {
    if (!company.planEndDate) return false;
    return new Date() > new Date(company.planEndDate);
  }

  // ---------------------------------------------------------------------------
  // getPlanPermissions — returns the feature matrix for a given plan name.
  // Accepts a plain string or a multilingual name object {ru, en, kk}.
  // Tiers:  Free/trial → limited  |  Standard → mid  |  Pro → full
  // ---------------------------------------------------------------------------
  getPlanPermissions(
    planName: string | { en?: string; ru?: string; kk?: string },
  ): PlanPermissions {
    const raw =
      typeof planName === 'string'
        ? planName
        : (planName.en ?? planName.ru ?? planName.kk ?? '');

    const normalized = raw.trim().toLowerCase();

    if (normalized === 'pro') {
      return {
        analytics: true,
        export: true,
        apiAccess: true,
        prioritySupport: true,
        customBranding: true,
        multipleAdmins: true,
        advancedReports: true,
        webhooks: true,
        unlimitedStorage: true,
        unlimitedMessages: true,
      };
    }

    if (normalized === 'standard') {
      return {
        analytics: true,
        export: true,
        apiAccess: false,
        prioritySupport: false,
        customBranding: false,
        multipleAdmins: true,
        advancedReports: false,
        webhooks: false,
        unlimitedStorage: false,
        unlimitedMessages: false,
      };
    }

    // Free / trial / unknown — most restricted
    return {
      analytics: false,
      export: false,
      apiAccess: false,
      prioritySupport: false,
      customBranding: false,
      multipleAdmins: false,
      advancedReports: false,
      webhooks: false,
      unlimitedStorage: false,
      unlimitedMessages: false,
    };
  }
}
