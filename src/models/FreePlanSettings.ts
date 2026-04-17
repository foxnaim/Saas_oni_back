import { Schema, model } from "mongoose";
import { BaseDocument, baseSchemaOptions } from "./BaseModel";

export interface IFreePlanSettings extends BaseDocument {
  settingsId: string; // Фиксированный ID для единственной записи
  messagesLimit: number;
  storageLimit: number;
  freePeriodDays: number;
}

const freePlanSettingsSchema = new Schema<IFreePlanSettings>(
  {
    settingsId: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    messagesLimit: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
    },
    storageLimit: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    freePeriodDays: {
      type: Number,
      required: true,
      default: 22,
      min: 0,
    },
  },
  baseSchemaOptions,
);

export const FreePlanSettings = model<IFreePlanSettings>(
  "FreePlanSettings",
  freePlanSettingsSchema,
);
