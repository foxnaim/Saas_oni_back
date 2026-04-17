import { Schema, model, Types } from "mongoose";
import { BaseDocument, baseSchemaOptions } from "./BaseModel";

export type CompanyStatus = "Активна" | "Пробная" | "Заблокирована";

export interface ICompany extends BaseDocument {
  _id: Types.ObjectId;
  name: string;
  code: string;
  adminEmail: string;
  status: CompanyStatus;
  plan: string;
  registered: string;
  trialEndDate?: string;
  planEndDate?: string; // Дата окончания платного тарифа (ежемесячно)
  trialUsed?: boolean; // Флаг, что пользователь уже использовал пробный тариф
  employees: number;
  messages: number;
  messagesThisMonth?: number;
  messagesLimit?: number;
  storageUsed?: number;
  storageLimit?: number;
  logoUrl?: string;
  fullscreenMode?: boolean;
  supportWhatsApp?: string;
}

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      validate: {
        validator: (v: string): boolean => /^[A-Z0-9]{8}$/.test(v),
        message:
          "Company code must be exactly 8 uppercase alphanumeric characters",
      },
    },
    adminEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Активна", "Пробная", "Заблокирована"],
      required: true,
      default: "Активна",
    },
    plan: {
      type: String,
      required: true,
      default: "Бесплатный",
    },
    registered: {
      type: String,
      required: true,
    },
    trialEndDate: {
      type: String,
    },
    planEndDate: {
      type: String,
    },
    trialUsed: {
      type: Boolean,
      default: false,
    },
    employees: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    messages: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    messagesThisMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    messagesLimit: {
      type: Number,
      min: 0,
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    storageLimit: {
      type: Number,
      min: 0,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    fullscreenMode: {
      type: Boolean,
      default: false,
    },
    supportWhatsApp: {
      type: String,
      trim: true,
    },
  },
  baseSchemaOptions,
);

// Индексы для оптимизации запросов
// code и adminEmail уже имеют индексы через unique: true, не дублируем
companySchema.index({ status: 1 });
companySchema.index({ createdAt: -1 }); // Для сортировки по дате создания
companySchema.index({ name: 1 }); // Для поиска по имени
// Составной индекс для частых запросов: фильтрация по статусу с сортировкой по дате
companySchema.index({ status: 1, createdAt: -1 });

export const Company = model<ICompany>("Company", companySchema);
