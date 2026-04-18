import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageStatus, MessageType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

// ── Achievement definition types (mirror of frontend lib/achievements.ts) ─────

type AchievementCategory =
  | 'reviews'
  | 'resolved'
  | 'response_speed'
  | 'activity'
  | 'quality'
  | 'longevity';

interface Achievement {
  id: string;
  category: AchievementCategory;
  titleKey: string;
  descriptionKey: string;
  target: number;
  order: number;
  level: number;
}

export interface AchievementProgress {
  achievement: Achievement;
  current: number;
  progress: number;
  completed: boolean;
  completedAt?: string;
}

export interface GroupedAchievements {
  category: AchievementCategory;
  categoryTitleKey: string;
  achievements: AchievementProgress[];
  currentLevel: number;
  maxLevel: number;
}

// ── Static achievement definitions ────────────────────────────────────────────

function makeLevels(
  category: AchievementCategory,
  targets: number[],
  titleKey: string,
  descriptionKey: string,
  baseOrder: number,
): Achievement[] {
  return targets.map((target, i) => ({
    id: `${category}_level_${i + 1}`,
    category,
    titleKey,
    descriptionKey,
    target,
    order: baseOrder + i,
    level: i + 1,
  }));
}

const ACHIEVEMENTS: Achievement[] = [
  // reviews – 10 levels
  ...makeLevels(
    'reviews',
    [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    'company.achievement.reviews.level',
    'company.achievement.reviews.description',
    1,
  ),
  // resolved – 10 levels
  ...makeLevels(
    'resolved',
    [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    'company.achievement.resolved.level',
    'company.achievement.resolved.description',
    100,
  ),
  // response_speed – 6 levels
  ...makeLevels(
    'response_speed',
    [10, 25, 50, 100, 250, 500],
    'company.achievement.responseSpeed.level',
    'company.achievement.responseSpeed.description',
    200,
  ),
  // activity – 4 levels
  ...makeLevels(
    'activity',
    [1, 1, 1, 3],
    'company.achievement.activity.week',
    'company.achievement.activity.description',
    300,
  ),
  // quality – 7 levels
  ...makeLevels(
    'quality',
    [20, 50, 100, 50, 70, 80, 90],
    'company.achievement.quality.manyPraises',
    'company.achievement.quality.description',
    400,
  ),
  // longevity – 5 levels (months)
  ...makeLevels(
    'longevity',
    [3, 6, 12, 24, 36],
    'company.achievement.longevity.level',
    'company.achievement.longevity.description',
    500,
  ),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Company stats (count by status) ──────────────────────────────────────

  async getCompanyStats(companyId: string): Promise<{
    new: number;
    inProgress: number;
    resolved: number;
    rejected: number;
    spam: number;
    total: number;
  }> {
    const company = await this.requireCompany(companyId);

    const results = await this.prisma.message.groupBy({
      by: ['status'],
      where: { companyCode: company.code },
      _count: { status: true },
    });

    const map = new Map(results.map((r) => [r.status, r._count.status]));

    const counts = {
      new: map.get(MessageStatus.New) ?? 0,
      inProgress: map.get(MessageStatus.InProgress) ?? 0,
      resolved: map.get(MessageStatus.Resolved) ?? 0,
      rejected: map.get(MessageStatus.Rejected) ?? 0,
      spam: map.get(MessageStatus.Spam) ?? 0,
      total: 0,
    };
    counts.total =
      counts.new + counts.inProgress + counts.resolved + counts.rejected + counts.spam;

    return counts;
  }

  // ── 2. Message distribution (count by type) ─────────────────────────────────

  async getMessageDistribution(companyId: string): Promise<{
    complaints: number;
    praises: number;
    suggestions: number;
  }> {
    const company = await this.requireCompany(companyId);

    const results = await this.prisma.message.groupBy({
      by: ['type'],
      where: { companyCode: company.code },
      _count: { type: true },
    });

    const map = new Map(results.map((r) => [r.type, r._count.type]));

    return {
      complaints: map.get(MessageType.complaint) ?? 0,
      praises: map.get(MessageType.praise) ?? 0,
      suggestions: map.get(MessageType.suggestion) ?? 0,
    };
  }

  // ── 3. Growth metrics (composite 10-point rating) ───────────────────────────

  async getGrowthMetrics(companyId: string): Promise<{
    rating: number;
    mood: 'Positive' | 'Neutral' | 'Negative';
    trend: 'up' | 'down' | 'stable';
    pointsBreakdown: {
      totalMessages: number;
      resolvedCases: number;
      responseSpeed: number;
      activityBonus: number;
      achievementsBonus: number;
      praiseBonus: number;
    };
    nextLevel: {
      current: number;
      next: number;
      progress: number;
    };
  }> {
    const company = await this.requireCompany(companyId);

    // ── Fetch all raw stats in parallel ──────────────────────────────────────
    const [statusCounts, typeCounts, allMessages, recentMessages] = await Promise.all([
      // status counts
      this.prisma.message.groupBy({
        by: ['status'],
        where: { companyCode: company.code },
        _count: { status: true },
      }),

      // type counts
      this.prisma.message.groupBy({
        by: ['type'],
        where: { companyCode: company.code },
        _count: { type: true },
      }),

      // All responded messages for response-speed calculation
      this.prisma.message.findMany({
        where: {
          companyCode: company.code,
          companyResponse: { not: null },
        },
        select: { createdAt: true, updatedAt: true },
      }),

      // recent messages for activity (last 3 months)
      this.prisma.message.findMany({
        where: {
          companyCode: company.code,
          createdAt: { gte: monthsAgo(3) },
        },
        select: { createdAt: true, type: true },
      }),
    ]);

    // ── Map raw aggregations ──────────────────────────────────────────────────
    const statusMap = new Map(statusCounts.map((r) => [r.status, r._count.status]));
    const typeMap = new Map(typeCounts.map((r) => [r.type, r._count.type]));

    const totalMessages =
      (statusMap.get(MessageStatus.New) ?? 0) +
      (statusMap.get(MessageStatus.InProgress) ?? 0) +
      (statusMap.get(MessageStatus.Resolved) ?? 0) +
      (statusMap.get(MessageStatus.Rejected) ?? 0) +
      (statusMap.get(MessageStatus.Spam) ?? 0);

    const resolvedCount = statusMap.get(MessageStatus.Resolved) ?? 0;
    const complaints = typeMap.get(MessageType.complaint) ?? 0;
    const praises = typeMap.get(MessageType.praise) ?? 0;
    const suggestions = typeMap.get(MessageType.suggestion) ?? 0;

    // Response speed buckets
    let fastResponses = 0, mediumResponses = 0, normalResponses = 0, slowResponses = 0;
    for (const msg of allMessages) {
      const daysDiff = (msg.updatedAt.getTime() - msg.createdAt.getTime()) / 86400000;
      if (daysDiff <= 1) fastResponses++;
      else if (daysDiff <= 3) mediumResponses++;
      else if (daysDiff <= 7) normalResponses++;
      else slowResponses++;
    }
    const totalResponded = fastResponses + mediumResponses + normalResponses + slowResponses;

    // ── Activity per-month lookup ─────────────────────────────────────────────
    const now = new Date();
    const monthKeys = (offset: number): string => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return `${d.getFullYear()}-${d.getMonth() + 1}`;
    };
    const thisMonthKey = monthKeys(0);
    const lastMonthKey = monthKeys(1);
    const twoMonthsAgoKey = monthKeys(2);

    const activityMap = new Map<string, number>();
    const complaintsMap = new Map<string, number>();

    for (const msg of recentMessages) {
      const key = `${msg.createdAt.getFullYear()}-${msg.createdAt.getMonth() + 1}`;
      activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
      if (msg.type === MessageType.complaint) {
        complaintsMap.set(key, (complaintsMap.get(key) ?? 0) + 1);
      }
    }

    const msThisMonth = activityMap.get(thisMonthKey) ?? 0;
    const msLastMonth = activityMap.get(lastMonthKey) ?? 0;
    const msTwoMonthsAgo = activityMap.get(twoMonthsAgoKey) ?? 0;
    const complaintsThisMonth = complaintsMap.get(thisMonthKey) ?? 0;

    // ── Achievements bonus (% of unlocked) ────────────────────────────────
    const achievementsData = await this.computeAchievements(companyId, {
      totalMessages,
      resolvedCount,
      fastResponses,
      msThisMonth,
      msLastMonth,
      msTwoMonthsAgo,
      complaintsThisMonth,
      complaintsLastMonth: complaintsMap.get(lastMonthKey) ?? 0,
      praises,
      suggestions,
      resolutionRate:
        complaints > 0
          ? Math.round(
              ((statusMap.get(MessageStatus.Resolved) ?? 0) / complaints) * 100,
            )
          : 0,
      positiveRatio:
        totalMessages > 0
          ? Math.round(((praises + suggestions) / totalMessages) * 100)
          : 0,
      longevityMonths: await this.getLongevityMonths(company),
    });

    const completedCount = achievementsData.filter((a) => a.completed).length;
    const achievementsPercent =
      ACHIEVEMENTS.length > 0 ? completedCount / ACHIEVEMENTS.length : 0;

    // ── Scoring ───────────────────────────────────────────────────────────────

    // 1. Resolved Cases – 3 pts
    const resolvable = complaints + suggestions;
    const resolvedResolvable =
      resolvable > 0 ? Math.min(resolvedCount / resolvable, 1) : 0;
    const resolvedCasesScore = resolvedResolvable * 3;

    // 2. Response Speed – 2 pts
    let responseSpeedScore = 0;
    if (totalResponded > 0) {
      const fastRatio = fastResponses / totalResponded;
      const mediumRatio = mediumResponses / totalResponded;
      const normalRatio = normalResponses / totalResponded;
      responseSpeedScore = Math.min(
        fastRatio * 2 + mediumRatio * 1.5 + normalRatio * 1,
        2,
      );
    }

    // 3. Praise Bonus – 2 pts
    const praiseRatio = totalMessages > 0 ? praises / totalMessages : 0;
    const praiseToComplaint = complaints > 0 ? praises / complaints : praises > 0 ? 1.5 : 0;
    const praiseBonusScore =
      Math.min(praiseRatio / 0.2, 1) * 1 + Math.min(praiseToComplaint / 1.5, 1) * 1;

    // 4. Activity Bonus – 1.5 pts
    let activityBonusScore = 0;
    if (totalMessages >= 100) activityBonusScore = 1.5;
    else if (totalMessages >= 50) activityBonusScore = 1.0;
    else if (totalMessages >= 10) activityBonusScore = 0.5;

    // 5. Achievements Bonus – 1.5 pts
    const achievementsBonusScore = achievementsPercent * 1.5;

    const rawRating =
      resolvedCasesScore +
      responseSpeedScore +
      praiseBonusScore +
      activityBonusScore +
      achievementsBonusScore;

    const rating = Math.min(Math.round(rawRating * 10) / 10, 10);

    // ── Mood & Trend ──────────────────────────────────────────────────────────
    const mood: 'Positive' | 'Neutral' | 'Negative' =
      rating >= 6.5 ? 'Positive' : rating >= 4 ? 'Neutral' : 'Negative';

    const trend: 'up' | 'down' | 'stable' =
      msThisMonth > msLastMonth
        ? 'up'
        : msThisMonth < msLastMonth
          ? 'down'
          : 'stable';

    // ── Level progression ─────────────────────────────────────────────────────
    const LEVELS = [0, 2, 4, 6, 8, 10];
    let lvIdx = 0;
    for (let i = 0; i < LEVELS.length - 1; i++) {
      if (rating >= LEVELS[i] && rating < LEVELS[i + 1]) {
        lvIdx = i;
        break;
      }
      if (rating >= 10) lvIdx = LEVELS.length - 2;
    }
    const currentLvMin = LEVELS[lvIdx];
    const nextLvMin = LEVELS[lvIdx + 1] ?? 10;
    const levelProgress =
      nextLvMin > currentLvMin
        ? Math.round(((rating - currentLvMin) / (nextLvMin - currentLvMin)) * 100)
        : 100;

    return {
      rating,
      mood,
      trend,
      pointsBreakdown: {
        totalMessages,
        resolvedCases: Math.round(resolvedCasesScore * 100) / 100,
        responseSpeed: Math.round(responseSpeedScore * 100) / 100,
        activityBonus: Math.round(activityBonusScore * 100) / 100,
        achievementsBonus: Math.round(achievementsBonusScore * 100) / 100,
        praiseBonus: Math.round(praiseBonusScore * 100) / 100,
      },
      nextLevel: {
        current: currentLvMin,
        next: nextLvMin,
        progress: Math.min(Math.max(levelProgress, 0), 100),
      },
    };
  }

  // ── 4. Achievements ─────────────────────────────────────────────────────────

  async getAchievements(companyId: string): Promise<AchievementProgress[]> {
    await this.requireCompany(companyId);
    const ctx = await this.buildAchievementContext(companyId);
    return this.computeAchievements(companyId, ctx);
  }

  // ── 5. Grouped achievements ─────────────────────────────────────────────────

  async getGroupedAchievements(companyId: string): Promise<GroupedAchievements[]> {
    const allProgress = await this.getAchievements(companyId);

    const categoryTitles: Record<AchievementCategory, string> = {
      reviews: 'company.achievement.category.reviews',
      resolved: 'company.achievement.category.resolved',
      response_speed: 'company.achievement.category.responseSpeed',
      activity: 'company.achievement.category.activity',
      quality: 'company.achievement.category.quality',
      longevity: 'company.achievement.category.longevity',
    };

    const grouped = new Map<AchievementCategory, AchievementProgress[]>();
    for (const p of allProgress) {
      const cat = p.achievement.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(p);
    }

    const result: GroupedAchievements[] = [];

    for (const [category, achievements] of grouped) {
      achievements.sort((a, b) => (a.achievement.level ?? 0) - (b.achievement.level ?? 0));

      let currentLevel = 0;
      for (const ach of achievements) {
        if (ach.completed) {
          currentLevel = Math.max(currentLevel, ach.achievement.level ?? 0);
        }
      }
      const nextIncomplete = achievements.find((a) => !a.completed);
      if (nextIncomplete) {
        currentLevel = Math.max(
          currentLevel,
          (nextIncomplete.achievement.level ?? 1) - 1,
        );
      }

      const maxLevel = Math.max(...achievements.map((a) => a.achievement.level ?? 0));

      result.push({
        category,
        categoryTitleKey: categoryTitles[category],
        achievements,
        currentLevel,
        maxLevel,
      });
    }

    // Sort: categories with progress first
    return result.sort((a, b) => {
      const aHas = a.achievements.some((ac) => ac.progress > 0);
      const bHas = b.achievements.some((ac) => ac.progress > 0);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.category.localeCompare(b.category);
    });
  }

  // ── 6. Platform stats ────────────────────────────────────────────────────────

  async getPlatformStats(): Promise<{
    totalCompanies: number;
    totalMessages: number;
    totalUsers: number;
    rooms: number;
    latency: string;
    retention: string;
  }> {
    const [totalCompanies, totalMessages, totalUsers] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.message.count(),
      this.prisma.user.count(),
    ]);

    return {
      totalCompanies,
      totalMessages,
      totalUsers,
      rooms: totalCompanies,
      latency: '< 50ms',
      retention: `${totalUsers}`,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async requireCompany(companyId: string): Promise<{ id: string; code: string; createdAt: Date }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, code: true, createdAt: true },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }
    return company;
  }

  private async getLongevityMonths(company: { createdAt: Date }): Promise<number> {
    const now = new Date();
    const created = new Date(company.createdAt);
    return Math.max(
      0,
      (now.getFullYear() - created.getFullYear()) * 12 +
        (now.getMonth() - created.getMonth()),
    );
  }

  private async buildAchievementContext(companyId: string): Promise<AchievementContext> {
    const company = await this.requireCompany(companyId);

    const [statusCounts, typeCounts, allMessages, recentMessages] = await Promise.all([
      this.prisma.message.groupBy({
        by: ['status'],
        where: { companyCode: company.code },
        _count: { status: true },
      }),

      this.prisma.message.groupBy({
        by: ['type'],
        where: { companyCode: company.code },
        _count: { type: true },
      }),

      this.prisma.message.findMany({
        where: {
          companyCode: company.code,
          companyResponse: { not: null },
        },
        select: { createdAt: true, updatedAt: true },
      }),

      this.prisma.message.findMany({
        where: {
          companyCode: company.code,
          createdAt: { gte: monthsAgo(3) },
        },
        select: { createdAt: true, type: true },
      }),
    ]);

    const statusMap = new Map(statusCounts.map((r) => [r.status, r._count.status]));
    const typeMap = new Map(typeCounts.map((r) => [r.type, r._count.type]));

    const totalMessages =
      (statusMap.get(MessageStatus.New) ?? 0) +
      (statusMap.get(MessageStatus.InProgress) ?? 0) +
      (statusMap.get(MessageStatus.Resolved) ?? 0) +
      (statusMap.get(MessageStatus.Rejected) ?? 0) +
      (statusMap.get(MessageStatus.Spam) ?? 0);

    const resolvedCount = statusMap.get(MessageStatus.Resolved) ?? 0;
    const complaints = typeMap.get(MessageType.complaint) ?? 0;
    const praises = typeMap.get(MessageType.praise) ?? 0;
    const suggestions = typeMap.get(MessageType.suggestion) ?? 0;

    // Response speed buckets
    let fastResponses = 0;
    for (const msg of allMessages) {
      const daysDiff = (msg.updatedAt.getTime() - msg.createdAt.getTime()) / 86400000;
      if (daysDiff <= 1) fastResponses++;
    }

    const now = new Date();
    const keyOf = (offset: number): string => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return `${d.getFullYear()}-${d.getMonth() + 1}`;
    };

    const activityMap = new Map<string, number>();
    const complaintsMap = new Map<string, number>();
    for (const msg of recentMessages) {
      const key = `${msg.createdAt.getFullYear()}-${msg.createdAt.getMonth() + 1}`;
      activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
      if (msg.type === MessageType.complaint) {
        complaintsMap.set(key, (complaintsMap.get(key) ?? 0) + 1);
      }
    }

    return {
      totalMessages,
      resolvedCount,
      fastResponses,
      msThisMonth: activityMap.get(keyOf(0)) ?? 0,
      msLastMonth: activityMap.get(keyOf(1)) ?? 0,
      msTwoMonthsAgo: activityMap.get(keyOf(2)) ?? 0,
      complaintsThisMonth: complaintsMap.get(keyOf(0)) ?? 0,
      complaintsLastMonth: complaintsMap.get(keyOf(1)) ?? 0,
      praises,
      suggestions,
      resolutionRate:
        complaints > 0
          ? Math.round((resolvedCount / complaints) * 100)
          : 0,
      positiveRatio:
        totalMessages > 0
          ? Math.round(((praises + suggestions) / totalMessages) * 100)
          : 0,
      longevityMonths: await this.getLongevityMonths(company),
    };
  }

  private async computeAchievements(
    _companyId: string,
    ctx: AchievementContext,
  ): Promise<AchievementProgress[]> {
    const results: AchievementProgress[] = [];

    for (const ach of ACHIEVEMENTS) {
      let current = 0;

      switch (ach.category) {
        case 'reviews':
          current = ctx.totalMessages;
          break;

        case 'resolved':
          current = ctx.resolvedCount;
          break;

        case 'response_speed':
          current = ctx.fastResponses;
          break;

        case 'activity':
          if (ach.id === 'activity_level_1') {
            current = ctx.msThisMonth >= 5 ? 1 : 0;
          } else if (ach.id === 'activity_level_2') {
            current = ctx.msThisMonth >= 10 ? 1 : 0;
          } else if (ach.id === 'activity_level_3') {
            current = ctx.complaintsThisMonth === 0 ? 1 : 0;
          } else if (ach.id === 'activity_level_4') {
            const consistent =
              ctx.msThisMonth >= 5 && ctx.msLastMonth >= 5 && ctx.msTwoMonthsAgo >= 5;
            current = consistent ? 3 : 0;
          }
          break;

        case 'quality':
          if (
            ach.id === 'quality_level_1' ||
            ach.id === 'quality_level_2' ||
            ach.id === 'quality_level_3'
          ) {
            current = ctx.praises;
          } else if (ach.id === 'quality_level_4' || ach.id === 'quality_level_5') {
            current = ctx.positiveRatio;
          } else if (ach.id === 'quality_level_6' || ach.id === 'quality_level_7') {
            current = ctx.resolutionRate;
          }
          break;

        case 'longevity':
          current = ctx.longevityMonths;
          break;
      }

      const completed = current >= ach.target;
      const progress = completed
        ? 100
        : ach.target > 0
          ? Math.min(100, Math.round((current / ach.target) * 100))
          : 0;

      results.push({
        achievement: ach,
        current,
        progress,
        completed,
        completedAt: completed ? new Date().toISOString().split('T')[0] : undefined,
      });
    }

    // Sort: completed first, then by progress desc, then by order asc
    return results.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      if (a.progress !== b.progress) return b.progress - a.progress;
      return a.achievement.order - b.achievement.order;
    });
  }
}

// ── Internal context type ─────────────────────────────────────────────────────

interface AchievementContext {
  totalMessages: number;
  resolvedCount: number;
  fastResponses: number;
  msThisMonth: number;
  msLastMonth: number;
  msTwoMonthsAgo: number;
  complaintsThisMonth: number;
  complaintsLastMonth: number;
  praises: number;
  suggestions: number;
  resolutionRate: number;
  positiveRatio: number;
  longevityMonths: number;
}
