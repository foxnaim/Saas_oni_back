import mongoose from "mongoose";
import { logger } from "../../utils/logger";

/**
 * Migration: Add admin settings collection
 * Создает коллекцию для хранения настроек админов
 */
export const up = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not available");
  }

  // Создаем коллекцию adminsettings если её нет
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  if (!collectionNames.includes("adminsettings")) {
    await db.createCollection("adminsettings");
    logger.info("Created collection: adminsettings");

    // Создаем индекс на adminId для быстрого поиска
    const collection = db.collection("adminsettings");
    await collection.createIndex({ adminId: 1 }, { unique: true });
    logger.info("Created index on adminId for adminsettings collection");
  }

  logger.info("Admin settings migration completed");
};

// eslint-disable-next-line @typescript-eslint/require-await
export const down = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not available");
  }

  // Удаляем коллекцию при откате
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  if (collectionNames.includes("adminsettings")) {
    await db.collection("adminsettings").drop();
    logger.info("Dropped collection: adminsettings");
  }

  logger.info("Admin settings migration rolled back");
};
