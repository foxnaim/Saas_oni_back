import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Message, MessageStatus, MessageType, Prisma } from '@prisma/client';
import { TelegramService } from '../telegram/telegram.service';
import { CompaniesService } from '../companies/companies.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import sanitizeHtml from 'sanitize-html';

import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

export interface IWebsocketGateway {
  emitToCompany(companyCode: string, event: string, payload: unknown): void;
  emitToAdmins(event: string, payload: unknown): void;
}

export interface ITelegramService {
  notifyCompanyNewMessage(
    chatId: number | string,
    message: Message,
  ): Promise<number | null>;
  notifyCompanyStatusUpdate(
    chatId: number | string,
    message: Message,
  ): Promise<void>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,

    @Inject(forwardRef(() => CompaniesService))
    private readonly companiesService: any,
    @Inject(forwardRef(() => WebsocketGateway))
    private readonly websocketGateway: any,
    @Optional() @Inject(TelegramService)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly telegramService: ITelegramService | null,
  ) {}

  // -------------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------------

  /** Strip all HTML tags and attributes; collapse excessive whitespace. */
  private sanitizeContent(raw: string): string {
    const stripped = sanitizeHtml(raw, {
      allowedTags: [],
      allowedAttributes: {},
    });
    return stripped.replace(/[ \t]{2,}/g, ' ').trim();
  }

  /**
   * Generate the next sequential message ID for a given year.
   * Format: FB-YYYY-XXXXXX  (zero-padded 6-digit counter)
   */
  private async generateMessageId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FB-${year}-`;

    const latest = await this.prisma.message.findFirst({
      where: { messageId: { startsWith: prefix } },
      orderBy: { messageId: 'desc' },
      select: { messageId: true },
    });

    let nextSeq = 1;
    if (latest?.messageId) {
      const parts = latest.messageId.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }

  // -------------------------------------------------------------------------
  // QUERY
  // -------------------------------------------------------------------------

  async findAll(query: GetMessagesDto): Promise<PaginatedResult<Message>> {
    const {
      page = 1,
      limit = 20,
      companyCode,
      status,
      type,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.MessageWhereInput = {};

    if (companyCode) where.companyCode = companyCode;
    if (status) where.status = status as MessageStatus;
    if (type) where.type = type as MessageType;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(dateTo);
    }

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const skip = (page - 1) * limit;
    const orderBy: Prisma.MessageOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Message> {
    const message = await this.prisma.message.findUnique({
      where: { messageId: id },
    });
    if (!message) {
      throw new NotFoundException(`Message with id "${id}" not found`);
    }
    return message;
  }

  async getByCompany(
    companyCode: string,
    pagination: Pick<GetMessagesDto, 'page' | 'limit' | 'sortBy' | 'sortOrder'>,
  ): Promise<PaginatedResult<Message>> {
    return this.findAll({ ...pagination, companyCode });
  }

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  async create(dto: CreateMessageDto): Promise<Message> {
    const { companyCode, type, content } = dto;

    // 1. Verify company exists
    const company = await this.companiesService.findByCode(companyCode);
    if (!company) {
      throw new NotFoundException(`Company with code "${companyCode}" not found`);
    }

    // 2. Check trial expiration
    if (company.trialEndDate && new Date() > new Date(company.trialEndDate)) {
      throw new ForbiddenException(
        'Your trial period has expired. Please upgrade your plan to continue receiving messages.',
      );
    }

    // 3. Check message limit
    if (
      company.messagesLimit != null &&
      company.messagesThisMonth != null &&
      company.messagesThisMonth >= company.messagesLimit
    ) {
      throw new ForbiddenException(
        'Monthly message limit reached. Please upgrade your plan to receive more messages.',
      );
    }

    // 4. Sanitize content
    const sanitizedContent = this.sanitizeContent(content);
    if (!sanitizedContent) {
      throw new BadRequestException('Message content is empty after sanitization.');
    }

    // 5. Generate unique FB-YYYY-XXXXXX id
    const messageId = await this.generateMessageId();

    // 6. Persist
    const created = await this.prisma.message.create({
      data: {
        messageId,
        companyCode,
        type: type as MessageType,
        content: sanitizedContent,
        status: MessageStatus.New,
      },
    });

    // 7. Increment company counter (fire-and-forget; log on failure)
    this.companiesService.incrementMessageCount(company.id).catch((err: unknown) =>
      this.logger.error(
        `Failed to increment counter for company ${companyCode}: ${(err as Error).message}`,
      ),
    );

    // 8. Emit WebSocket event to company room and admins
    try {
      this.websocketGateway.emitToCompany(companyCode, 'message:new', created);
      this.websocketGateway.emitToAdmins('message:new', created);
    } catch (err) {
      this.logger.error(`WebSocket emit failed: ${(err as Error).message}`);
    }

    // 9. Send Telegram notification to the company
    if (company.telegramChatId && this.telegramService) {
      this.telegramService
        .notifyCompanyNewMessage(company.telegramChatId, created)
        .then((tgMsgId) => {
          if (tgMsgId != null) {
            return this.prisma.message.update({
              where: { messageId },
              data: { telegramMessageId: BigInt(tgMsgId) },
            });
          }
        })
        .catch((err: unknown) =>
          this.logger.error(
            `Telegram notification failed for message ${messageId}: ${(err as Error).message}`,
          ),
        );
    }

    return created;
  }

  // -------------------------------------------------------------------------
  // UPDATE STATUS
  // -------------------------------------------------------------------------

  async updateStatus(id: string, dto: UpdateMessageDto): Promise<Message> {
    const { status, companyResponse } = dto;

    const existing = await this.prisma.message.findUnique({
      where: { messageId: id },
    });
    if (!existing) {
      throw new NotFoundException(`Message with id "${id}" not found`);
    }

    const previousStatus = existing.status;

    const updateData: Prisma.MessageUpdateInput = {
      status: status as MessageStatus,
      previousStatus: previousStatus as string,
    };

    if (companyResponse !== undefined) {
      updateData.companyResponse = sanitizeHtml(companyResponse, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();
    }

    const updated = await this.prisma.message.update({
      where: { messageId: id },
      data: updateData,
    });

    // Emit WebSocket
    try {
      this.websocketGateway.emitToCompany(
        updated.companyCode,
        'message:statusUpdated',
        updated,
      );
      this.websocketGateway.emitToAdmins('message:statusUpdated', updated);
    } catch (err) {
      this.logger.error(`WebSocket emit failed: ${(err as Error).message}`);
    }

    // Telegram notification
    const company = await this.companiesService
      .findByCode(updated.companyCode)
      .catch(() => null);

    if (company?.telegramChatId && this.telegramService) {
      this.telegramService
        .notifyCompanyStatusUpdate(company.telegramChatId, updated)
        .catch((err: unknown) =>
          this.logger.error(
            `Telegram status update notification failed for ${id}: ${(err as Error).message}`,
          ),
        );
    }

    return updated;
  }

  // -------------------------------------------------------------------------
  // MODERATION (admin)
  // -------------------------------------------------------------------------

  async moderate(id: string, action: 'approve' | 'reject'): Promise<Message> {
    const existing = await this.prisma.message.findUnique({
      where: { messageId: id },
    });
    if (!existing) {
      throw new NotFoundException(`Message with id "${id}" not found`);
    }

    const newStatus =
      action === 'approve' ? MessageStatus.InProgress : MessageStatus.Rejected;

    const updated = await this.prisma.message.update({
      where: { messageId: id },
      data: {
        previousStatus: existing.status as string,
        status: newStatus,
      },
    });

    try {
      this.websocketGateway.emitToCompany(
        updated.companyCode,
        'message:moderated',
        updated,
      );
      this.websocketGateway.emitToAdmins('message:moderated', updated);
    } catch (err) {
      this.logger.error(`WebSocket emit failed: ${(err as Error).message}`);
    }

    return updated;
  }

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.message.findUnique({
      where: { messageId: id },
    });
    if (!existing) {
      throw new NotFoundException(`Message with id "${id}" not found`);
    }

    await this.prisma.message.delete({ where: { messageId: id } });

    // Decrement company counter (fire-and-forget)
    // Find company by code to get its id
    this.companiesService.findByCode(existing.companyCode)
      .then((company: any) => {
        if (company) {
          return this.companiesService.decrementMessageCount(company.id);
        }
      })
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to decrement counter for company ${existing.companyCode}: ${(err as Error).message}`,
        ),
      );

    // Emit WebSocket deletion event
    try {
      this.websocketGateway.emitToCompany(existing.companyCode, 'message:deleted', { id });
      this.websocketGateway.emitToAdmins('message:deleted', { id });
    } catch (err) {
      this.logger.error(`WebSocket emit failed: ${(err as Error).message}`);
    }
  }
}
