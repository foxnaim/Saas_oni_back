import { z } from "zod";

const translatedStringSchema = z.object({
  ru: z.string(),
  en: z.string(),
  kk: z.string(),
});

export const createPlanSchema = z.object({
  body: z.object({
    name: z.union([z.string(), translatedStringSchema]),
    price: z.number().min(0),
    messagesLimit: z.number().int().min(0),
    storageLimit: z.number().min(0),
    features: z.array(z.union([z.string(), translatedStringSchema])),
    isFree: z.boolean().optional(),
    freePeriodDays: z.number().int().min(0).optional(),
  }),
});

export const updateFreePlanSettingsSchema = z.object({
  body: z.object({
    messagesLimit: z.number().int().min(1).optional(),
    storageLimit: z.number().min(0).optional(),
    freePeriodDays: z.number().int().min(0).optional(),
  }),
});
