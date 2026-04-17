import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError, ErrorCode } from "../utils/AppError";
import { Message, MessageStatus, type IMessage } from "../models/Message";
import { Company } from "../models/Company";
import { sanitizeMessageContent } from "../utils/sanitize";
import { getPlanPermissions, isTrialExpired, isTrialPlanName } from "../utils/planPermissions";
import {
  emitNewMessage,
  emitMessageUpdate,
  emitMessageDelete,
} from "../config/socket";

// Генерация ID сообщения в формате FB-YYYY-XXXXXX
const generateMessageId = (): string => {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FB-${year}-${random}`;
};

export const getAllMessages = asyncHandler(
  async (req: Request, res: Response) => {
    // Запрещаем кеширование ответов, чтобы не получать 304 и всегда видеть свежие сообщения
    res.set("Cache-Control", "no-store");

    const { companyCode, page, limit, messageId, fromDate } = req.query;

    interface MessageQuery {
      companyCode?: string;
      id?: { $regex: string; $options: string };
      createdAt?: { $gte: string };
    }

    const query: MessageQuery = {};

    // Поиск по ID сообщения (без учета регистра и дефисов)
    if (
      messageId &&
      typeof messageId === "string" &&
      messageId.trim().length > 0
    ) {
      // Нормализуем ID: убираем дефисы и пробелы, приводим к верхнему регистру
      const cleanId = messageId
        .replace(/[-_\s]/g, "")
        .toUpperCase()
        .trim();

      if (cleanId.length > 0) {
        // Если ID начинается с FB, пытаемся сформировать regex, который учитывает возможные разделители
        // ID формат: FB-YYYY-CODE, но пользователь может ввести FBYYYYCODE
        if (cleanId.startsWith("FB")) {
          let pattern = "FB";
          const afterFB = cleanId.substring(2);

          if (afterFB.length > 0) {
            pattern += "[-_]?"; // Опциональный разделитель после FB

            // Берем год (следующие 4 символа)
            const year = afterFB.substring(0, 4);
            pattern += year;

            // Если есть символы после года
            const afterYear = afterFB.substring(4);
            if (afterYear.length > 0) {
              pattern += "[-_]?"; // Опциональный разделитель после года
              // Экранируем оставшуюся часть кода на всякий случай
              pattern += afterYear.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            }
          }

          query.id = {
            $regex: pattern,
            $options: "i",
          };
        } else {
          // Если это не FB ID, ищем как есть (частичное совпадение)
          // Например, пользователь ищет просто "2026"
          const escapedId = cleanId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          query.id = {
            $regex: escapedId,
            $options: "i",
          };
        }
      }
    }

    if (companyCode && typeof companyCode === "string") {
      query.companyCode = companyCode.toUpperCase();
    }

    // Фильтр по дате: только сообщения за период (например, за месяц)
    if (fromDate && typeof fromDate === "string" && fromDate.trim().length > 0) {
      const dateStr = fromDate.trim();
      // YYYY-MM-DD — строковое сравнение работает корректно с ISO датами
      query.createdAt = { $gte: dateStr };
    }

    // Если пользователь - компания, показываем только их сообщения
    if (req.user?.role === "company" && req.user.companyId) {
      const CompanyModel = Company;
      const company = await CompanyModel.findById(req.user.companyId);
      if (company) {
        query.companyCode = company.code;
      }
    }

    // Если ищем по ID, не применяем пагинацию или увеличиваем лимит
    const isSearchingById = !!messageId;
    const pageNumber =
      page && typeof page === "string" ? parseInt(page, 10) : 1;
    const pageSize = isSearchingById
      ? 1000 // Большой лимит для поиска по ID
      : limit && typeof limit === "string"
        ? parseInt(limit, 10)
        : 50;
    const skip = isSearchingById ? 0 : (pageNumber - 1) * pageSize;

    // Оптимизация: используем select для исключения ненужных полей и lean() для производительности
    const [messages, total] = await Promise.all([
      Message.find(query)
        .select("-__v") // Исключаем версию документа
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      Message.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  },
);

export const getMessageById = asyncHandler(
  async (req: Request, res: Response) => {
    // Запрещаем кеширование ответа для детального запроса
    res.set("Cache-Control", "no-store");

    const { id } = req.params;

    const message = await Message.findOne({ id });
    if (!message) {
      throw new AppError("Message not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка доступа для компаний
    if (req.user?.role === "company" && req.user.companyId) {
      const CompanyModel = Company;
      const company = await CompanyModel.findById(req.user.companyId);
      if (company && message.companyCode !== company.code) {
        throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
      }
    }

    res.json({
      success: true,
      data: message,
    });
  },
);

export const createMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as {
      companyCode?: string;
      type?: string;
      content?: string;
    };
    const { companyCode, type, content } = body;

    if (!companyCode || !type || !content) {
      throw new AppError(
        "CompanyCode, type, and content are required",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    // Проверяем существование компании
    const CompanyModel = Company;
    const company = await CompanyModel.findOne({
      code: String(companyCode).toUpperCase(),
    });
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверяем, не истек ли пробный период
    if (isTrialPlanName(company.plan) && isTrialExpired(company)) {
      throw new AppError(
        "Trial period has expired. Please upgrade your plan.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    // Проверяем лимиты сообщений
    if (company.messagesLimit && company.messagesLimit !== 999999) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Подсчитываем сообщения за текущий месяц
      const startOfMonth = new Date(currentYear, currentMonth, 1)
        .toISOString()
        .split("T")[0];
      const messagesThisMonth = await Message.countDocuments({
        companyCode: company.code,
        createdAt: { $gte: startOfMonth },
      });

      if (messagesThisMonth >= company.messagesLimit) {
        throw new AppError(
          "Message limit exceeded for this month",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    const nowDate = new Date().toISOString().split("T")[0];
    const nowFull = new Date().toISOString();
    const messageId = generateMessageId();

    // Санитизируем контент сообщения для защиты от XSS
    const sanitizedContent = sanitizeMessageContent(String(content));

    // Создаем сообщение с явным указанием write concern для гарантии сохранения
    const message = await Message.create({
      id: messageId,
      companyCode: companyCode.toUpperCase(),
      type,
      content: sanitizedContent,
      status: "Новое",
      createdAt: nowFull,
      updatedAt: nowFull,
      lastUpdate: nowDate,
    });

    // Обновляем счетчик сообщений компании
    company.messages += 1;
    const currentMonth = new Date().getMonth();
    const messageMonth = new Date(message.createdAt).getMonth();
    if (currentMonth === messageMonth) {
      company.messagesThisMonth = (company.messagesThisMonth || 0) + 1;
    }
    await company.save();

    // Message.create() уже возвращает сохраненный документ
    // Отправляем событие через WebSocket сразу после создания
    // Mongoose гарантирует, что документ сохранен в БД после успешного выполнения create()
    emitNewMessage(JSON.parse(JSON.stringify(message)) as IMessage);

    res.status(201).json({
      success: true,
      data: message,
    });
  },
);

export const updateMessageStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as { status?: string; response?: string };
    const { status, response } = body;

    const message = await Message.findOne({ id });
    if (!message) {
      throw new AppError("Message not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка доступа для компаний
    if (req.user?.role === "company" && req.user.companyId) {
      const CompanyModel = Company;
      const company = await CompanyModel.findById(req.user.companyId);
      if (company && message.companyCode !== company.code) {
        throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
      }

      // Проверка прав плана для компаний
      if (company) {
        const permissions = await getPlanPermissions(company);

        // Проверка права на ответ
        if (
          response !== undefined &&
          response.trim().length > 0 &&
          !permissions.canReply
        ) {
          throw new AppError(
            "Reply to messages is not available in your plan. Please upgrade to Standard or Pro plan.",
            403,
            ErrorCode.FORBIDDEN,
          );
        }

        // Проверка права на смену статуса
        if (status && !permissions.canChangeStatus) {
          throw new AppError(
            "Changing message status is not available in your plan. Please upgrade to Standard or Pro plan.",
            403,
            ErrorCode.FORBIDDEN,
          );
        }
      }
    }

    // Блокируем изменение статуса и ответа для сообщений, отклоненных админом
    // (статус "Спам" с previousStatus означает, что сообщение было отклонено админом)
    const isRejectedByAdmin =
      message.status === "Спам" && message.previousStatus;

    if (isRejectedByAdmin) {
      if (status) {
        throw new AppError(
          "Cannot modify status of message rejected by admin",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
      if (response !== undefined) {
        throw new AppError(
          "Cannot modify response for message rejected by admin",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    // Если компания отправляет ответ, статус не должен оставаться "Новое"
    if (
      req.user?.role === "company" &&
      response !== undefined &&
      response.trim().length > 0 &&
      message.status === "Новое" &&
      (!status || status === "Новое")
    ) {
      throw new AppError(
        "Please change the message status before replying. Status cannot remain 'New'.",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    const nowFull = new Date().toISOString();
    const nowDate = nowFull.split("T")[0];
    if (status && typeof status === "string") {
      const validStatuses: Array<
        "Новое" | "В работе" | "Решено" | "Отклонено" | "Спам"
      > = ["Новое", "В работе", "Решено", "Отклонено", "Спам"];
      if (validStatuses.includes(status as MessageStatus)) {
        message.status = status as MessageStatus;
      }
    }
    message.updatedAt = nowFull;
    message.lastUpdate = nowDate;
    if (response !== undefined && typeof response === "string") {
      // Санитизируем ответ компании для защиты от XSS
      message.companyResponse = sanitizeMessageContent(response);
    }

    await message.save();

    // Отправляем событие через WebSocket
    emitMessageUpdate(JSON.parse(JSON.stringify(message)) as IMessage);

    res.json({
      success: true,
      data: message,
    });
  },
);

export const moderateMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as { action?: string };
    const { action } = body;

    // Только админы могут модерировать сообщения
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    if (!action || (action !== "approve" && action !== "reject")) {
      throw new AppError(
        'Action must be "approve" or "reject"',
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    const message = await Message.findOne({ id });
    if (!message) {
      throw new AppError("Message not found", 404, ErrorCode.NOT_FOUND);
    }

    const nowFull = new Date().toISOString();
    const nowDate = nowFull.split("T")[0];

    if (action === "approve") {
      // При одобрении: если был спам и есть previousStatus, возвращаем предыдущий статус
      if (message.status === "Спам" && message.previousStatus) {
        message.status = message.previousStatus;
        message.previousStatus = undefined;
      }
      // Иначе статус остается как есть
    } else if (action === "reject") {
      // При отклонении: сохраняем текущий статус в previousStatus (если он не "Спам")
      // и помечаем как спам
      if (message.status !== "Спам") {
        message.previousStatus = message.status;
      }
      message.status = "Спам";
    }

    message.updatedAt = nowFull;
    message.lastUpdate = nowDate;

    await message.save();

    // Отправляем событие через WebSocket
    emitMessageUpdate(JSON.parse(JSON.stringify(message)) as IMessage);

    res.json({
      success: true,
      data: message,
      message: action === "approve" ? "Message approved" : "Message rejected",
    });
  },
);

export const deleteMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Только админы могут удалять сообщения
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    const message = await Message.findOne({ id });
    if (!message) {
      throw new AppError("Message not found", 404, ErrorCode.NOT_FOUND);
    }

    // Удаляем сообщение
    await Message.deleteOne({ id });

    // Обновляем счетчик сообщений компании
    const CompanyModel = Company;
    const company = await CompanyModel.findOne({ code: message.companyCode });
    if (company) {
      company.messages = Math.max(0, (company.messages || 0) - 1);

      // Обновляем счетчик сообщений за текущий месяц
      const currentMonth = new Date().getMonth();
      const messageMonth = new Date(message.createdAt).getMonth();
      if (currentMonth === messageMonth) {
        company.messagesThisMonth = Math.max(
          0,
          (company.messagesThisMonth || 0) - 1,
        );
      }

      await company.save();
    }

    // Отправляем событие через WebSocket
    emitMessageDelete(id, message.companyCode);

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  },
);
