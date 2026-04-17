import { z } from "zod";

export const createMessageSchema = z.object({
  body: z.object({
    companyCode: z
      .string()
      .length(8, "Company code must be exactly 8 characters"),
    type: z.enum(["complaint", "praise", "suggestion"]),
    content: z
      .string()
      .min(1, "Content is required")
      .max(5000, "Content is too long"),
  }),
});

export const updateMessageStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Message ID is required"),
  }),
  body: z.object({
    status: z.enum(["Новое", "В работе", "Решено", "Отклонено", "Спам"]),
    response: z.string().max(2000, "Response is too long").optional(),
  }),
});

// Общая схема пагинации для переиспользования (limit до 500 для админ-аналитики)
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50).optional(),
});

export const getMessagesSchema = z.object({
  query: paginationSchema.extend({
    companyCode: z
      .string()
      .length(8, "Company code must be exactly 8 characters")
      .optional(),
    messageId: z.string().min(1, "Message ID must not be empty").optional(),
    fromDate: z.string().optional(),
  }),
});

export const getMessageByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Message ID is required"),
  }),
});

export const moderateMessageSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Message ID is required"),
  }),
  body: z.object({
    action: z.enum(["approve", "reject"], {
      errorMap: () => ({ message: 'Action must be "approve" or "reject"' }),
    }),
  }),
});
