import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError, ErrorCode } from "../utils/AppError";
import { AdminSettings } from "../models/AdminSettings";
import mongoose from "mongoose";
import { cache, CacheManager } from "../utils/cacheRedis";

/**
 * Получить настройки админа
 */
export const getAdminSettings = asyncHandler(
  async (req: Request, res: Response) => {
    // Только админы могут получать свои настройки
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    // Извлекаем userId из JWT payload
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("User ID not found", 400, ErrorCode.BAD_REQUEST);
    }

    // Преобразуем userId в ObjectId
    const adminId = new mongoose.Types.ObjectId(userId);

    // Проверяем кэш
    const cacheKey = `admin-settings:${userId}`;
    const cached = await cache.get<typeof AdminSettings>(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: cached,
      });
      return;
    }

    // Ищем настройки или создаем дефолтные
    let settings = await AdminSettings.findOne({ adminId });

    if (!settings) {
      // Создаем дефолтные настройки
      settings = await AdminSettings.create({
        adminId,
        fullscreenMode: false,
        language: "ru",
        theme: "system",
        itemsPerPage: 10,
        notificationsEnabled: true,
        emailNotifications: true,
      });
    }

    // Кэшируем на 5 минут (статистика)
    await cache.set(cacheKey, settings, CacheManager.getTTL("stats"));

    res.json({
      success: true,
      data: settings,
    });
  },
);

/**
 * Обновить настройки админа
 */
export const updateAdminSettings = asyncHandler(
  async (req: Request, res: Response) => {
    // Только админы могут обновлять свои настройки
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    // Извлекаем userId из JWT payload
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("User ID not found", 400, ErrorCode.BAD_REQUEST);
    }

    // Преобразуем userId в ObjectId
    const adminId = new mongoose.Types.ObjectId(userId);

    const body = req.body as {
      fullscreenMode?: boolean;
      language?: "ru" | "en" | "kk";
      theme?: "light" | "dark" | "system";
      itemsPerPage?: number;
      notificationsEnabled?: boolean;
      emailNotifications?: boolean;
      supportWhatsAppNumber?: string;
    };

    // Валидация
    if (body.language && !["ru", "en", "kk"].includes(body.language)) {
      throw new AppError("Invalid language", 400, ErrorCode.BAD_REQUEST);
    }

    if (body.theme && !["light", "dark", "system"].includes(body.theme)) {
      throw new AppError("Invalid theme", 400, ErrorCode.BAD_REQUEST);
    }

    if (body.itemsPerPage !== undefined) {
      if (body.itemsPerPage < 5 || body.itemsPerPage > 100) {
        throw new AppError(
          "Items per page must be between 5 and 100",
          400,
          ErrorCode.BAD_REQUEST,
        );
      }
    }

    // Ищем существующие настройки или создаем новые
    let settings = await AdminSettings.findOne({ adminId });

    if (!settings) {
      settings = await AdminSettings.create({
        adminId,
        fullscreenMode: body.fullscreenMode ?? false,
        language: body.language ?? "ru",
        theme: body.theme ?? "system",
        itemsPerPage: body.itemsPerPage ?? 10,
        notificationsEnabled: body.notificationsEnabled ?? true,
        emailNotifications: body.emailNotifications ?? true,
        supportWhatsAppNumber: body.supportWhatsAppNumber,
      });
    } else {
      // Обновляем только переданные поля
      if (body.fullscreenMode !== undefined) {
        settings.fullscreenMode = body.fullscreenMode;
      }
      if (body.language !== undefined) {
        settings.language = body.language;
      }
      if (body.theme !== undefined) {
        settings.theme = body.theme;
      }
      if (body.itemsPerPage !== undefined) {
        settings.itemsPerPage = body.itemsPerPage;
      }
      if (body.notificationsEnabled !== undefined) {
        settings.notificationsEnabled = body.notificationsEnabled;
      }
      if (body.emailNotifications !== undefined) {
        settings.emailNotifications = body.emailNotifications;
      }
      if (body.supportWhatsAppNumber !== undefined) {
        settings.supportWhatsAppNumber = body.supportWhatsAppNumber;
      }

      await settings.save();
    }

    // Инвалидируем кэш
    const cacheKey = `admin-settings:${userId}`;
    await cache.delete(cacheKey);
    // Кэшируем обновленные настройки на 5 минут
    await cache.set(cacheKey, settings, CacheManager.getTTL("stats"));

    res.json({
      success: true,
      data: settings,
    });
  },
);
