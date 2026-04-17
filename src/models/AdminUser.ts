import { Schema, model, Document } from "mongoose";

export type AdminRole = "admin" | "super_admin";

export interface IAdminUser extends Document {
  email: string;
  name: string;
  role: AdminRole;
  createdAt: string; // ISO date string
  lastLogin?: string | null; // ISO date string
}

const adminUserSchema = new Schema<IAdminUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "super_admin"],
      required: true,
      default: "admin",
    },
    createdAt: {
      type: String,
      required: true,
    },
    lastLogin: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// Индексы для оптимизации запросов
// email уже имеет индекс через unique: true, не дублируем
adminUserSchema.index({ role: 1 });
adminUserSchema.index({ createdAt: -1 }); // Для сортировки по дате создания

export const AdminUser = model<IAdminUser>("AdminUser", adminUserSchema);
