import mongoose from "mongoose";
import { config } from "./env";
import { logger } from "../utils/logger";
import { Migrator } from "../migrations/migrator";

export const connectDatabase = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000, // Таймаут выбора сервера 5 секунд
      socketTimeoutMS: 45000, // Таймаут сокета 45 секунд
      connectTimeoutMS: 10000, // Таймаут подключения 10 секунд
      // Connection pooling оптимизация
      maxPoolSize: 10, // Максимум соединений в пуле
      minPoolSize: 2, // Минимум соединений в пуле
      maxIdleTimeMS: 30000, // Закрывать неиспользуемые соединения через 30 секунд
      // Отключаем SSL для локального MongoDB
      ssl: false,
      // Для локального MongoDB не нужна проверка сертификата
      tlsAllowInvalidCertificates: false,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Запускаем миграции после подключения
    if (config.nodeEnv !== "test") {
      try {
        const migrator = new Migrator();
        await migrator.run();
      } catch (error) {
        logger.error("Migration error:", error);
        // Не останавливаем сервер при ошибке миграций, только логируем
      }
    }
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
  logger.error("MongoDB error:", error);
});
