import morgan from "morgan";
import { Request, Response } from "express";
import { config } from "../config/env";

/**
 * Morgan middleware для логирования HTTP запросов
 * В production использует упрощенный формат, в development - подробный
 */
export const morganMiddleware = morgan(
  config.nodeEnv === "production" ? "combined" : "dev",
  {
    skip: (req: Request, _res: Response) => {
      // Пропускаем логирование для health check и статических файлов
      return req.path === "/health" || req.path.startsWith("/static");
    },
  },
);
