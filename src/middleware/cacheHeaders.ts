import { Request, Response, NextFunction } from "express";

/**
 * Middleware для установки cache headers
 * Улучшает производительность за счет кэширования статических и редко меняющихся данных
 */
export const cacheHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Для статических данных (GET запросы без параметров)
  if (req.method === "GET" && !req.query.page && !req.query.limit) {
    // Публичные endpoints (компании, планы) - кэшируем на 30 минут (агрессивное кэширование)
    if (
      req.path.includes("/companies/code/") ||
      req.path.includes("/companies/public") ||
      req.path.includes("/plans")
    ) {
      res.set({
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600", // 30 минут + 1 час stale
        ETag: `"${Date.now()}"`, // Простой ETag для валидации
      });
    }
    // Health check - кэшируем на 30 секунд
    else if (req.path === "/api/v1/health" || req.path === "/api/health") {
      res.set({
        "Cache-Control": "public, max-age=30",
      });
    }
    // Для остальных GET запросов - короткое кэширование
    else if (req.path.startsWith("/api/")) {
      res.set({
        "Cache-Control": "private, max-age=60, must-revalidate",
      });
    }
  }

  next();
};
