import { Logger, Optional } from '@nestjs/common';
import {
  Update,
  Start,
  Command,
  On,
  Ctx,
  Action,
  InjectBot,
} from 'nestjs-telegraf';
import { Context, Telegraf, Markup } from 'telegraf';
import { CallbackQuery, Message } from 'telegraf/typings/core/types/typegram';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { TelegramService } from './telegram.service';
import {
  MESSAGES,
  DEFAULT_LOCALE,
  CALLBACK,
  SESSION_KEY,
  REGISTER_CODE_TTL_MS,
} from './telegram.constants';
import {
  mainMenuKeyboard,
  companyMenuKeyboard,
  cancelKeyboard,
  languageKeyboard,
} from './keyboards/main.keyboard';

// ─────────────────────────────────────────────────────────────────────────────
//  Extend Telegraf Context with a minimal session shape
// ─────────────────────────────────────────────────────────────────────────────

interface BotSession {
  [SESSION_KEY.AWAITING_REPLY_FOR]?: string | null;
  [SESSION_KEY.LINKED_COMPANY_CODE]?: string | null;
  [SESSION_KEY.LANG]?: string;
}

interface BotContext extends Context {
  session: BotSession;
}

// ─────────────────────────────────────────────────────────────────────────────
//  In-memory store for temp registration codes (replace with Redis in prod)
// ─────────────────────────────────────────────────────────────────────────────

const registrationCodes = new Map<string, { chatId: string; expiresAt: number }>();

function generateTempCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F9C1"
}

// ─────────────────────────────────────────────────────────────────────────────

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
    @Optional() @InjectBot() private readonly bot: Telegraf | null,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private t(ctx: BotContext) {
    const lang = (ctx.session?.[SESSION_KEY.LANG] as string) ?? DEFAULT_LOCALE;
    return MESSAGES[lang as keyof typeof MESSAGES] ?? MESSAGES[DEFAULT_LOCALE];
  }

  private chatId(ctx: BotContext): string {
    return String(ctx.chat?.id ?? ctx.from?.id ?? '');
  }

  private isLinked(ctx: BotContext): boolean {
    return !!ctx.session?.[SESSION_KEY.LINKED_COMPANY_CODE];
  }

  private async replyMd(ctx: BotContext, text: string, extra?: object) {
    return ctx.replyWithMarkdown(text, extra as never);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /start
  // ──────────────────────────────────────────────────────────────────────────

  @Start()
  async handleStart(@Ctx() ctx: BotContext) {
    const t = this.t(ctx);
    const keyboard = this.isLinked(ctx) ? companyMenuKeyboard() : mainMenuKeyboard();
    await this.replyMd(ctx, t.welcome, keyboard);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /register
  // ──────────────────────────────────────────────────────────────────────────

  @Command('register')
  async handleRegister(@Ctx() ctx: BotContext) {
    const t = this.t(ctx);
    const chatId = this.chatId(ctx);

    // Generate a short-lived one-time code
    const code = generateTempCode();
    const expiresAt = Date.now() + REGISTER_CODE_TTL_MS;
    registrationCodes.set(code, { chatId, expiresAt });

    // Clean up expired codes passively
    for (const [k, v] of registrationCodes) {
      if (v.expiresAt < Date.now()) registrationCodes.delete(k);
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'https://sayless.app';

    const registerUrl = `${frontendUrl}/register?telegram_code=${code}&chat_id=${chatId}`;

    await this.replyMd(
      ctx,
      `${t.registerStart}\n${registerUrl}`,
      Markup.removeKeyboard(),
    );

    await this.replyMd(ctx, t.registerCode(code));
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /link <company_code>
  // ──────────────────────────────────────────────────────────────────────────

  @Command('link')
  async handleLink(@Ctx() ctx: BotContext) {
    const t = this.t(ctx);
    const text = (ctx.message as Message.TextMessage)?.text ?? '';
    const parts = text.trim().split(/\s+/);
    const companyCode = parts[1]?.toUpperCase();

    if (!companyCode) {
      await this.replyMd(ctx, t.linkUsage);
      return;
    }

    // ── Attempt to find the company ───────────────────────────────────────
    // NOTE: CompaniesService is not yet injectable here to avoid circular deps
    // while the module is still being scaffolded. The actual DB lookup should
    // be performed once CompaniesModule exports a lookup method.
    // For now we store the code in session and let the website confirm the link.

    // TODO: inject CompaniesService and do:
    //   const company = await this.companiesService.findByCode(companyCode);
    //   if (!company) { ...notFound... return; }
    //   await this.companiesService.setTelegramChatId(company._id, this.chatId(ctx));

    const placeholderFound = companyCode.length === 8; // basic guard

    if (!placeholderFound) {
      await this.replyMd(ctx, t.linkNotFound(companyCode));
      return;
    }

    ctx.session[SESSION_KEY.LINKED_COMPANY_CODE] = companyCode;
    await this.replyMd(
      ctx,
      t.linkSuccess(companyCode), // replace with real company.name once injected
      companyMenuKeyboard(),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /stats
  // ──────────────────────────────────────────────────────────────────────────

  @Command('stats')
  async handleStats(@Ctx() ctx: BotContext) {
    const t = this.t(ctx);

    if (!this.isLinked(ctx)) {
      await this.replyMd(ctx, t.notLinked);
      return;
    }

    // TODO: look up real stats via StatsService / CompaniesService
    // Stub response keeps the bot operational while other modules are built
    await this.telegramService.sendCompanyStats(this.chatId(ctx), {
      companyName: ctx.session[SESSION_KEY.LINKED_COMPANY_CODE] ?? 'Company',
      total: 0,
      pending: 0,
      resolved: 0,
      rejected: 0,
      thisMonth: 0,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /messages
  // ──────────────────────────────────────────────────────────────────────────

  @Command('messages')
  async handleMessages(@Ctx() ctx: BotContext) {
    const t = this.t(ctx);

    if (!this.isLinked(ctx)) {
      await this.replyMd(ctx, t.notLinked);
      return;
    }

    // TODO: inject MessagesService and load recent messages for the company
    await this.replyMd(ctx, t.noMessages);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /help
  // ──────────────────────────────────────────────────────────────────────────

  @Command('help')
  async handleHelp(@Ctx() ctx: BotContext) {
    await this.replyMd(ctx, this.t(ctx).help);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Callback queries (inline buttons)
  // ──────────────────────────────────────────────────────────────────────────

  /** ✅ Resolve */
  @Action(new RegExp(`^${CALLBACK.RESOLVE_MESSAGE}(.+)$`))
  async handleResolve(@Ctx() ctx: BotContext) {
    const query = ctx.callbackQuery as CallbackQuery.DataQuery;
    const messageId = query.data.replace(CALLBACK.RESOLVE_MESSAGE, '');
    const t = this.t(ctx);

    try {
      // TODO: this.messagesService.updateStatus(messageId, 'resolved')
      await ctx.answerCbQuery(t.messageResolved);
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      await ctx.answerCbQuery(t.actionFailed);
    }
  }

  /** ❌ Reject */
  @Action(new RegExp(`^${CALLBACK.REJECT_MESSAGE}(.+)$`))
  async handleReject(@Ctx() ctx: BotContext) {
    const query = ctx.callbackQuery as CallbackQuery.DataQuery;
    const messageId = query.data.replace(CALLBACK.REJECT_MESSAGE, '');
    const t = this.t(ctx);

    try {
      // TODO: this.messagesService.updateStatus(messageId, 'rejected')
      this.logger.debug(`Rejecting message ${messageId}`);
      await ctx.answerCbQuery(t.messageRejected);
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      await ctx.answerCbQuery(t.actionFailed);
    }
  }

  /** 💬 Reply – enters the reply conversation flow */
  @Action(new RegExp(`^${CALLBACK.REPLY_MESSAGE}(.+)$`))
  async handleReplyAction(@Ctx() ctx: BotContext) {
    const query = ctx.callbackQuery as CallbackQuery.DataQuery;
    const messageId = query.data.replace(CALLBACK.REPLY_MESSAGE, '');
    const t = this.t(ctx);

    ctx.session[SESSION_KEY.AWAITING_REPLY_FOR] = messageId;

    await ctx.answerCbQuery();
    await this.replyMd(ctx, t.replyPrompt, cancelKeyboard());
  }

  /** Cancel – exits any active flow */
  @Action('cancel')
  async handleCancel(@Ctx() ctx: BotContext) {
    ctx.session[SESSION_KEY.AWAITING_REPLY_FOR] = null;
    await ctx.answerCbQuery();
    await this.replyMd(
      ctx,
      this.t(ctx).cancel,
      this.isLinked(ctx) ? companyMenuKeyboard() : mainMenuKeyboard(),
    );
  }

  /** Language selection */
  @Action(new RegExp(`^${CALLBACK.LANG_SELECT}(ru|en|kk)$`))
  async handleLangSelect(@Ctx() ctx: BotContext) {
    const query = ctx.callbackQuery as CallbackQuery.DataQuery;
    const lang = query.data.replace(CALLBACK.LANG_SELECT, '');
    ctx.session[SESSION_KEY.LANG] = lang;
    await ctx.answerCbQuery(`Language set to ${lang}`);
    await this.handleStart(ctx);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Text messages – handle keyboard buttons & reply flow
  // ──────────────────────────────────────────────────────────────────────────

  @On('text')
  async handleText(@Ctx() ctx: BotContext) {
    const t = this.t(ctx);
    const text = ((ctx.message as Message.TextMessage)?.text ?? '').trim();

    // ── Reply flow ────────────────────────────────────────────────────────
    const pendingReplyId = ctx.session?.[SESSION_KEY.AWAITING_REPLY_FOR];
    if (pendingReplyId) {
      ctx.session[SESSION_KEY.AWAITING_REPLY_FOR] = null;

      try {
        // TODO: this.messagesService.addCompanyReply(pendingReplyId, text)
        //       then notifyCompanyResponse(company, updatedMessage)
        this.logger.debug(`Company reply for message ${pendingReplyId}: ${text}`);
        await this.replyMd(
          ctx,
          t.replySent,
          this.isLinked(ctx) ? companyMenuKeyboard() : mainMenuKeyboard(),
        );
      } catch {
        await this.replyMd(ctx, t.replyFailed);
      }
      return;
    }

    // ── Main-menu keyboard buttons ────────────────────────────────────────
    if (text === '🏢 Register Company') {
      return this.handleRegister(ctx);
    }
    if (text === '🔗 Link Account') {
      await this.replyMd(ctx, t.linkUsage);
      return;
    }
    if (text === '📊 Stats') {
      return this.handleStats(ctx);
    }
    if (text === '📨 Messages') {
      return this.handleMessages(ctx);
    }
    if (text === '⚙️ Settings') {
      await this.replyMd(ctx, `⚙️ *Settings*\n\nLanguage selection:`, languageKeyboard());
      return;
    }
    if (text === '❓ Help') {
      return this.handleHelp(ctx);
    }

    // ── Fallback ──────────────────────────────────────────────────────────
    await this.replyMd(ctx, t.unknownCommand);
  }
}
