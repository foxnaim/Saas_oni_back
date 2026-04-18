import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface IpRecord {
  lastMessageAt: number;
  /** Messages sent today keyed by date string (YYYY-MM-DD) */
  dailyCount: number;
  dailyCountDate: string;
}

interface FingerprintRecord {
  dailyCount: number;
  dailyCountDate: string;
}

/** Minimum gap (ms) enforced between two messages from the same IP */
const BURST_INTERVAL_MS = 30_000; // 30 seconds

/** Max messages per IP+fingerprint combo per calendar day */
const IP_FINGERPRINT_DAILY_LIMIT = 3;

/** Max messages per fingerprint per calendar day (VPN / rotating-IP detection) */
const FINGERPRINT_DAILY_LIMIT = 5;

/** How often the in-memory store is cleaned up */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

function todayString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

@Injectable()
export class AntispamMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AntispamMiddleware.name);

  /** IP  →  burst + daily counters */
  private readonly ipMap = new Map<string, IpRecord>();

  /** fingerprint  →  daily counter */
  private readonly fpMap = new Map<string, FingerprintRecord>();

  /** IP+fingerprint  →  daily counter */
  private readonly ipFpMap = new Map<string, IpRecord>();

  constructor() {
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const ip = this.extractIp(req);
    const fingerprint: string = (req as any).fingerprint ?? 'unknown';
    const today = todayString();
    const now = Date.now();

    // ── 1. Burst protection: 30-second gap per IP ───────────────────────────
    const ipRecord = this.ipMap.get(ip) ?? this.freshIpRecord(today);
    const elapsed = now - ipRecord.lastMessageAt;

    if (ipRecord.lastMessageAt > 0 && elapsed < BURST_INTERVAL_MS) {
      const retryAfter = Math.ceil((BURST_INTERVAL_MS - elapsed) / 1_000);
      this.logger.warn(`Burst limit exceeded for IP ${ip} – retry in ${retryAfter}s`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Please wait ${retryAfter} seconds before sending again.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── 2. IP + fingerprint daily limit ─────────────────────────────────────
    const ipFpKey = `${ip}::${fingerprint}`;
    const ipFpRecord = this.ipFpMap.get(ipFpKey) ?? this.freshIpRecord(today);
    this.resetDailyIfNeeded(ipFpRecord, today);

    if (ipFpRecord.dailyCount >= IP_FINGERPRINT_DAILY_LIMIT) {
      this.logger.warn(`IP+fingerprint daily limit reached for key ${ipFpKey}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Daily message limit reached for this device and network.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── 3. Fingerprint-only daily limit (VPN detection) ─────────────────────
    const fpRecord = this.fpMap.get(fingerprint) ?? this.freshFpRecord(today);
    this.resetDailyIfNeeded(fpRecord, today);

    if (fpRecord.dailyCount >= FINGERPRINT_DAILY_LIMIT) {
      this.logger.warn(`Fingerprint daily limit reached for fingerprint ${fingerprint}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Daily message limit reached for this device.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── All checks passed – update counters ──────────────────────────────────
    this.resetDailyIfNeeded(ipRecord, today);
    ipRecord.lastMessageAt = now;
    ipRecord.dailyCount += 1;
    this.ipMap.set(ip, ipRecord);

    ipFpRecord.dailyCount += 1;
    this.ipFpMap.set(ipFpKey, ipFpRecord);

    fpRecord.dailyCount += 1;
    this.fpMap.set(fingerprint, fpRecord);

    next();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }

  private freshIpRecord(date: string): IpRecord {
    return { lastMessageAt: 0, dailyCount: 0, dailyCountDate: date };
  }

  private freshFpRecord(date: string): FingerprintRecord {
    return { dailyCount: 0, dailyCountDate: date };
  }

  private resetDailyIfNeeded(record: IpRecord | FingerprintRecord, today: string): void {
    if (record.dailyCountDate !== today) {
      record.dailyCount = 0;
      record.dailyCountDate = today;
    }
  }

  /** Remove entries whose daily window has already passed. */
  private cleanup(): void {
    const today = todayString();

    for (const [key, record] of this.ipMap) {
      if (record.dailyCountDate !== today && record.lastMessageAt === 0) {
        this.ipMap.delete(key);
      }
    }

    for (const [key, record] of this.ipFpMap) {
      if (record.dailyCountDate !== today) {
        this.ipFpMap.delete(key);
      }
    }

    for (const [key, record] of this.fpMap) {
      if (record.dailyCountDate !== today) {
        this.fpMap.delete(key);
      }
    }

    this.logger.debug(
      `Antispam cleanup done. Sizes – ip:${this.ipMap.size} ipFp:${this.ipFpMap.size} fp:${this.fpMap.size}`,
    );
  }
}
