// Условный setup файл - определяет нужен ли MongoDB по переменной окружения
import dotenv from "dotenv";

dotenv.config();

// Определяем тип теста по переменной окружения или по пути через stack trace
const isUnitTest =
  process.env.JEST_TEST_TYPE === "unit" ||
  (typeof process.env.JEST_WORKER_ID !== "undefined" &&
    process.cwd().includes("unit"));

// Для unit тестов - не подключаемся к MongoDB
if (isUnitTest || !process.env.TEST_MONGODB_URI) {
  // Мокаем Sentry и logger
  jest.mock("../config/sentry", () => ({
    initializeSentry: jest.fn(),
    setupSentryErrorHandler: jest.fn(),
  }));

  jest.mock("../utils/logger", () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }));

  jest.setTimeout(10000);
} else {
  // Для integration и e2e тестов - подключаемся к MongoDB
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mongoose = require("mongoose") as typeof import("mongoose");

  jest.setTimeout(60000);

  beforeAll(async () => {
    const testDbUri =
      process.env.TEST_MONGODB_URI ||
      "mongodb://localhost:27017/anonymous-chat-test";

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(testDbUri, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
      } catch {
        // Не бросаем ошибку, просто пропускаем тесты
      }
    }
  });

  afterEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (mongoose.connection.readyState !== 0) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        const collection = collections[key];
        if (collection) {
          await collection.deleteMany({});
        }
      }
    }
  });

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
      } catch (error) {
        console.error("Ошибка при закрытии MongoDB:", error);
      }
    }
  });

  // Мокаем Sentry и logger
  jest.mock("../config/sentry", () => ({
    initializeSentry: jest.fn(),
    setupSentryErrorHandler: jest.fn(),
  }));

  jest.mock("../utils/logger", () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }));
}
