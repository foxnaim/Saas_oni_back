import { Injectable, Logger } from '@nestjs/common';
import { AdminSettings } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  settings: AdminSettings;
  expiresAt: number;
}

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  // ─── Get settings (with cache) ────────────────────────────────────────────

  async getSettings(adminId: string): Promise<AdminSettings> {
    const cached = this.fromCache(adminId);
    if (cached) return cached;

    let settings = await this.prisma.adminSettings.findUnique({
      where: { adminId },
    });

    if (!settings) {
      // Auto-create with defaults on first access
      settings = await this.prisma.adminSettings.create({
        data: { adminId },
      });
      this.logger.log(`Created default settings for admin ${adminId}`);
    }

    this.toCache(adminId, settings);
    return settings;
  }

  // ─── Get first available settings (for system-level lookups) ────────────────

  async getFirstSettings(): Promise<AdminSettings | null> {
    return this.prisma.adminSettings.findFirst();
  }

  // ─── Update settings ──────────────────────────────────────────────────────

  async updateSettings(
    adminId: string,
    dto: UpdateSettingsDto,
  ): Promise<AdminSettings> {
    const updated = await this.prisma.adminSettings.upsert({
      where: { adminId },
      update: dto as any,
      create: { adminId, ...dto } as any,
    });

    this.invalidateCache(adminId);
    this.logger.log(`Settings updated for admin ${adminId}`);

    return updated;
  }

  // ─── Cache helpers ────────────────────────────────────────────────────────

  private fromCache(adminId: string): AdminSettings | null {
    const entry = this.cache.get(adminId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(adminId);
      return null;
    }
    return entry.settings;
  }

  private toCache(adminId: string, settings: AdminSettings): void {
    this.cache.set(adminId, {
      settings,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  private invalidateCache(adminId: string): void {
    this.cache.delete(adminId);
  }
}
