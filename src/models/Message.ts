import { Schema, model, Document } from "mongoose";

export type MessageType = "complaint" | "praise" | "suggestion";
export type MessageStatus =
  | "Новое"
  | "В работе"
  | "Решено"
  | "Отклонено"
  | "Спам";

export interface IMessage extends Document {
  id: string; // Кастомный ID в формате FB-YYYY-XXXXXX
  companyCode: string;
  type: MessageType;
  content: string;
  status: MessageStatus;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  lastUpdate?: string; // ISO date string
  companyResponse?: string;
  adminNotes?: string;
  previousStatus?: MessageStatus; // Статус до пометки как спам админом
}

const messageSchema = new Schema<IMessage>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    companyCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["complaint", "praise", "suggestion"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ["Новое", "В работе", "Решено", "Отклонено", "Спам"],
      required: true,
      default: "Новое",
    },
    createdAt: {
      type: String,
      required: true,
    },
    updatedAt: {
      type: String,
      required: true,
    },
    lastUpdate: {
      type: String,
    },
    companyResponse: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    previousStatus: {
      type: String,
      enum: ["Новое", "В работе", "Решено", "Отклонено", "Спам"],
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// Индексы для оптимизации запросов
messageSchema.index({ companyCode: 1, status: 1 });
messageSchema.index({ companyCode: 1, type: 1 });
messageSchema.index({ companyCode: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 }); // Для админских запросов с сортировкой по дате
messageSchema.index({ status: 1, createdAt: -1 }); // Для фильтрации по статусу
// id уже имеет индекс через unique: true, не дублируем

export const Message = model<IMessage>("Message", messageSchema);
