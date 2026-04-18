import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import * as crypto from 'crypto';

import {
  MESSAGES,
  DEFAULT_LOCALE,
  SupportedLocale,
} from './telegram.constants';
import { messageActionsKeyboard } from './keyboards/main.keyboard';

// ─────────────────────────────────────────────────────────────────────────────
//  Lightweight interfaces so TelegramService compiles without importing the
//  full Company / Message Mongoose documents (those modules are still being
//  built out). Replace with real document types once schemas are finalized.
// ─────────────────────────────────────────────────────────────────────────────

export interface CompanyLike {
  _id: unknown;
  name: string;
  telegramChatId?: string | null;
  code: string;
}

export interface MessageLike {
  _id: unknown;
  text: string;
  status: string;
  senderTelegramChatId?: string | null;
  companyReply?: string | null;
  createdAt?: Date;
}

export interface CompanyStats {
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
  thisMonth: number;
}

export interface TelegramAuthData {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly loc: SupportedLocale;

  constructor(
    private readonly configService: ConfigService,
    // The bot may not exist when TELEGRAM_BOT_TOKEN is absent – use @Optional()
    @Optional() @InjectBot() private readonly bot: Telegraf | null,
  ) {
    this.loc = DEFAULT_LOCALE;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Core send helper
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Send a plain-text (Markdown) message to any Telegram chat.
   */
  async sendNotification(chatId: string | number, message: string): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('sendNotification called but bot is not initialised');
      return false;
    }

    try {
      await this.bot.telegram.sendMessage(String(chatId), message, {
        parse_mode: 'Markdown',
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send notification to ${chatId}: ${(err as Error).message}`);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Domain-level notification helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Notify the company's Telegram chat about a new anonymous feedback message.
   * Attaches inline Resolve / Reply / Reject buttons.
   */
  async notifyNewMessage(company: CompanyLike, message: MessageLike): Promise<void> {
    if (!company.telegramChatId || !this.bot) return;

    const msgId = String(message._id);
    const text = MESSAGES[this.loc].newMessage(
      company.name,
      message.text,
      msgId,
    );

    try {
      await this.bot.telegram.sendMessage(company.telegramChatId, text, {
        parse_mode: 'Markdown',
        reply_markup: messageActionsKeyboard(msgId).reply_markup,
      });
    } catch (err) {
      this.logger.error(
        `notifyNewMessage failed for company ${company.code}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Notify the company's Telegram chat when a message status changes.
   */
  async notifyMessageUpdate(company: CompanyLike, message: MessageLike): Promise<void> {
    if (!company.telegramChatId || !this.bot) return;

    const text = MESSAGES[this.loc].messageStatusChanged(
      company.name,
      String(message._id),
      message.status,
    );

    await this.sendNotification(company.telegramChatId, text);
  }

  /**
   * Notify an anonymous user (if they submitted via Telegram) about the
   * company's reply.
   */
  async notifyCompanyResponse(company: CompanyLike, message: MessageLike): Promise<void> {
    if (!message.senderTelegramChatId || !message.companyReply || !this.bot) {
      return;
    }

    const text = MESSAGES[this.loc].companyReply(
      company.name,
      message.companyReply,
    );

    await this.sendNotification(message.senderTelegramChatId, text);
  }

  /**
   * Send a formatted statistics summary to a chat.
   */
  async sendCompanyStats(chatId: string | number, stats: CompanyStats & { companyName: string }): Promise<void> {
    const text = MESSAGES[this.loc].stats(
      stats.companyName,
      stats.total,
      stats.pending,
      stats.resolved,
      stats.rejected,
      stats.thisMonth,
    );

    await this.sendNotification(chatId, text);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Auth helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verify data received from the Telegram Login Widget using HMAC-SHA256.
   *
   * @see https://core.telegram.org/widgets/login#checking-authorization
   */
  verifyTelegramAuth(authData: TelegramAuthData): boolean {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.warn('Cannot verify Telegram auth: TELEGRAM_BOT_TOKEN not set');
      return false;
    }

    const { hash, ...rest } = authData;

    // Build the data-check string: sorted key=value pairs joined by \n
    const dataCheckString = Object.entries(rest)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) {
      this.logger.warn('Telegram auth hash mismatch');
      return false;
    }

    // Auth data must not be older than 1 day
    const authDate = Number(authData.auth_date);
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - authDate > 86400) {
      this.logger.warn('Telegram auth data is expired');
      return false;
    }

    return true;
  }

  /**
   * Generate the Telegram Login Widget URL for the website.
   *
   * @param botUsername  The bot's username (without @).
   */
  generateAuthLink(botUsername: string): string {
    const origin =
      this.configService.get<string>('FRONTEND_URL') || 'https://sayless.app';
    return `https://t.me/${botUsername}?start=auth&origin=${encodeURIComponent(origin)}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Utility
  // ──────────────────────────────────────────────────────────────────────────

  /** Returns true when the Telegram bot is available. */
  get isAvailable(): boolean {
    return this.bot !== null;
  }
}
