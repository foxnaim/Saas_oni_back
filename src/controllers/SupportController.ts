import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AdminSettings } from "../models/AdminSettings";

/**
 * Получить публичную информацию о поддержке
 * Публичный endpoint - доступен без аутентификации
 */
export const getSupportInfo = asyncHandler(
  async (_req: Request, res: Response) => {
    // Пытаемся найти настройки с указанным номером (если админов несколько)
    const settingsWithNumber = await AdminSettings.findOne({
      supportWhatsAppNumber: { $exists: true, $ne: "" },
    })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    // Если номер не задан нигде — берем последние настройки (на случай единственного админа)
    const settings =
      settingsWithNumber ||
      (await AdminSettings.findOne().sort({ updatedAt: -1 }).lean().exec());

    res.json({
      success: true,
      data: {
        supportWhatsAppNumber: settings?.supportWhatsAppNumber || null,
      },
    });
  },
);
