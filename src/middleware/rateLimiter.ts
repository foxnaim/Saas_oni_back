import rateLimit from "express-rate-limit";
import { config } from "../config/env";

/**
 * Rate limiter для API endpoints
 * Защита от злоупотреблений и DDoS атак
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: config.nodeEnv === "production" ? 100 : 1000, // Максимум запросов за окно
  message: {
    success: false,
    error: {
      message: "Too many requests from this IP, please try again later.",
      code: "TOO_MANY_REQUESTS",
    },
  },
  standardHeaders: true, // Возвращает информацию о лимите в заголовках `RateLimit-*`
  legacyHeaders: false, // Отключает заголовки `X-RateLimit-*`
  // Настраиваем keyGenerator для правильной работы с trust proxy
  keyGenerator: (req) => {
    // Используем IP из X-Forwarded-For, если доступен (через trust proxy)
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  // Отключаем валидацию trust proxy, так как мы уже настроили его правильно
  validate: {
    trustProxy: false, // Отключаем валидацию, так как trust proxy настроен правильно
  },
});

/**
 * Строгий rate limiter для auth endpoints
 * Защита от brute-force атак на login, регистрацию и сброс пароля
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: config.nodeEnv === "production" ? 10 : 100, // Максимум 10 попыток в production
  message: {
    success: false,
    error: {
      message: "Too many authentication attempts, please try again later.",
      code: "TOO_MANY_AUTH_ATTEMPTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  validate: {
    trustProxy: false,
  },
  // Пропускаем успешные запросы для избежания блокировки легитимных пользователей
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter для создания сообщений (POST /messages)
 * Ограничение: 3 сообщения в день с одного IP - защита от спама
 */
export const messageCreateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 часа
  max: config.nodeEnv === "production" ? 3 : 100, // 3 в production, 100 в dev для тестов
  message: {
    success: false,
    error: {
      message: "Daily message limit exceeded. Try again tomorrow.",
      code: "TOO_MANY_MESSAGES",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  validate: {
    trustProxy: false,
  },
});

/**
 * Очень строгий rate limiter для password reset
 * Защита от email enumeration и spam
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: config.nodeEnv === "production" ? 3 : 50, // Максимум 3 попытки в час
  message: {
    success: false,
    error: {
      message: "Too many password reset attempts, please try again later.",
      code: "TOO_MANY_RESET_ATTEMPTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  validate: {
    trustProxy: false,
  },
});
