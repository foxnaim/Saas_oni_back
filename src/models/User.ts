import { Schema, model, Types } from "mongoose";
import { BaseDocument, baseSchemaOptions } from "./BaseModel";

export type UserRole = "user" | "company" | "admin" | "super_admin";

export interface IUser extends BaseDocument {
  _id: Types.ObjectId;
  email: string;
  password: string;
  role: UserRole;
  companyId?: Types.ObjectId;
  name?: string;
  lastLogin?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  isVerified?: boolean;
  verificationToken?: string;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Не возвращать пароль по умолчанию
    },
    role: {
      type: String,
      enum: ["user", "company", "admin", "super_admin"],
      required: true,
      default: "user",
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    name: {
      type: String,
      trim: true,
    },
    lastLogin: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
  },
  baseSchemaOptions,
);

// Индексы для оптимизации запросов
// email уже имеет индекс через unique: true, не дублируем
userSchema.index({ role: 1 });
userSchema.index({ companyId: 1 });
// Составной индекс для частых запросов: найти пользователей компании с определенной ролью
userSchema.index({ companyId: 1, role: 1 });

export const User = model<IUser>("User", userSchema);
