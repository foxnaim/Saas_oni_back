// Setup файл для UNIT тестов (не требуют MongoDB)
import dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

// Увеличиваем таймаут для Jest
jest.setTimeout(10000);

// Мокаем Sentry для тестов
jest.mock("../config/sentry", () => ({
  initializeSentry: jest.fn(),
  setupSentryErrorHandler: jest.fn(),
}));

// Мокаем logger для чистоты тестов
jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
