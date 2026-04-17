import { Document } from "mongoose";

/**
 * Базовый интерфейс для всех документов MongoDB
 * Включает стандартные поля createdAt и updatedAt
 */
export interface BaseDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Базовые опции для всех схем Mongoose
 * Включает автоматическое управление timestamps
 */
export const baseSchemaOptions = {
  timestamps: true, // Автоматически добавляет createdAt и updatedAt
  versionKey: false, // Отключает поле __v
} as const;
