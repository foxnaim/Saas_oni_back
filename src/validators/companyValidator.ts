import { z } from "zod";

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Company name is required").max(200),
    code: z
      .string()
      .length(8, "Company code must be exactly 8 characters")
      .regex(/^[A-Z0-9]{8}$/, "Company code must be uppercase alphanumeric"),
    adminEmail: z.string().email("Invalid email format"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .refine((pwd) => /[A-Z]/.test(pwd), {
        message: "Password must contain at least one uppercase letter",
      })
      .refine((pwd) => /[a-z]/.test(pwd), {
        message: "Password must contain at least one lowercase letter",
      })
      .refine((pwd) => /[0-9]/.test(pwd), {
        message: "Password must contain at least one digit",
      })
      .refine((pwd) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pwd), {
        message:
          "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)",
      }),
    plan: z.string().optional(),
    employees: z.number().int().min(0).optional(),
    messagesLimit: z.number().int().min(0).optional(),
    storageLimit: z.number().min(0).optional(),
  }),
});

export const updateCompanySchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    adminEmail: z.string().email().optional(),
    status: z.enum(["Активна", "Пробная", "Заблокирована"]).optional(),
    plan: z.string().optional(),
    employees: z.number().int().min(0).optional(),
    messagesLimit: z.number().int().min(0).optional(),
    storageLimit: z.number().min(0).optional(),
    logoUrl: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (val) => {
          if (!val || val === "") return true;
          // Проверяем, является ли это base64 строкой или URL
          return (
            val.startsWith("data:image/") ||
            val.startsWith("http://") ||
            val.startsWith("https://")
          );
        },
        { message: "Logo must be a valid base64 image string or URL" },
      ),
    fullscreenMode: z.boolean().optional(),
  }),
});

export const getCompanyByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
});

export const getCompanyByCodeSchema = z.object({
  params: z.object({
    code: z.string().length(8, "Company code must be exactly 8 characters"),
  }),
});

export const updateCompanyStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
  body: z.object({
    status: z.enum(["Активна", "Пробная", "Заблокирована"]),
  }),
});

export const updateCompanyPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
  body: z.object({
    plan: z.string().min(1, "Plan is required"),
    planEndDate: z.string().optional(),
  }),
});

export const updateCompanyPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
  body: z.object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .refine((pwd) => /[A-Z]/.test(pwd), {
        message: "Password must contain at least one uppercase letter",
      })
      .refine((pwd) => /[a-z]/.test(pwd), {
        message: "Password must contain at least one lowercase letter",
      })
      .refine((pwd) => /[0-9]/.test(pwd), {
        message: "Password must contain at least one digit",
      })
      .refine((pwd) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pwd), {
        message:
          "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)",
      }),
  }),
});
