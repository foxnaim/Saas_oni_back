import { z } from "zod";

export const createAdminSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    name: z.string().min(1, "Name is required"),
    role: z.enum(["admin", "super_admin"]).optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
  }),
});

export const updateAdminSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Admin ID is required"),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email("Invalid email format").optional(),
    role: z.enum(["admin", "super_admin"]).optional(),
    // Пароль: суперадмин может сбросить без старого пароля
    password: z.string().min(8, "Password must be at least 8 characters").optional(),
  }),
});

/** WhatsApp/телефон: + и цифры, пробелы/дефисы/скобки; после очистки — от 10 до 15 цифр */
const supportPhoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (val === undefined || val === null || val === "") return true;
      const digits = val.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15 && /^\+?[\d\s\-()]+$/.test(val.trim());
    },
    { message: "Invalid support phone number. Use international format, e.g. +7 700 123 4567" },
  );

export const updateAdminSettingsSchema = z.object({
  body: z.object({
    fullscreenMode: z.boolean().optional(),
    language: z.enum(["ru", "en", "kk"]).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    itemsPerPage: z.number().int().min(5).max(100).optional(),
    notificationsEnabled: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    supportWhatsAppNumber: supportPhoneSchema,
  }),
});
