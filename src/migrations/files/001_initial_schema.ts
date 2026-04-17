import mongoose from "mongoose";

/**
 * Initial schema migration
 * Создает базовые индексы и структуру данных
 */
export const up = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not available");
  }

  // Создаем коллекции если их нет
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  // Убеждаемся, что все коллекции существуют
  const requiredCollections = [
    "users",
    "companies",
    "messages",
    "subscriptionplans",
    "adminusers",
  ];

  for (const collectionName of requiredCollections) {
    if (!collectionNames.includes(collectionName)) {
      await db.createCollection(collectionName);
    }
  }
};

// eslint-disable-next-line @typescript-eslint/require-await
export const down = async (): Promise<void> => {
  // Откат не требуется для начальной миграции
};
