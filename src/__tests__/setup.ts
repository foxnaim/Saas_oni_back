import mongoose from "mongoose";
import dotenv from "dotenv";

// Загружаем переменные окружения из .env файла
dotenv.config();

// Увеличиваем таймаут для Jest (MongoDB подключение может занять время)
jest.setTimeout(60000); // Увеличено до 60 секунд

// Подключение к тестовой БД перед всеми тестами
beforeAll(async () => {
  const testDbUri =
    process.env.TEST_MONGODB_URI ||
    "mongodb://localhost:27017/anonymous-chat-test";

  // Проверяем, не подключены ли уже
  if (
    mongoose.connection.readyState === mongoose.ConnectionStates.disconnected
  ) {
    await mongoose.connect(testDbUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }
});

// Очистка БД после каждого теста
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key]?.deleteMany({});
  }
});

// Отключение от БД после всех тестов
afterAll(async () => {
  if (
    mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected
  ) {
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    } catch (error) {
      // Игнорируем ошибки при закрытии, если БД уже закрыта
      console.error("Ошибка при закрытии MongoDB:", error);
    }
  }
});

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
