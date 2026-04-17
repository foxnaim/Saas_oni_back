import { Schema, model, Types } from "mongoose";
import { BaseDocument, baseSchemaOptions } from "./BaseModel";

export interface IAdminSettings extends BaseDocument {
  adminId: Types.ObjectId; // ID админа (ссылка на User)
  fullscreenMode: boolean;
  language: string; // 'ru' | 'en' | 'kk'
  theme?: string; // 'light' | 'dark' | 'system'
  itemsPerPage?: number; // Количество элементов на странице
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
  supportWhatsAppNumber?: string;
}

const adminSettingsSchema = new Schema<IAdminSettings>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullscreenMode: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      enum: ["ru", "en", "kk"],
      default: "ru",
    },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    itemsPerPage: {
      type: Number,
      default: 10,
      min: 5,
      max: 100,
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    supportWhatsAppNumber: {
      type: String,
      trim: true,
    },
  },
  baseSchemaOptions,
);

// Индекс на adminId уже создается автоматически через unique: true в определении поля
// adminSettingsSchema.index({ adminId: 1 }); // Удалено - дублирует unique: true

export const AdminSettings = model<IAdminSettings>(
  "AdminSettings",
  adminSettingsSchema,
);
