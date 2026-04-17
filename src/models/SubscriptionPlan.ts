import { Schema, model } from "mongoose";
import { BaseDocument, baseSchemaOptions } from "./BaseModel";

export interface TranslatedString {
  ru: string;
  en: string;
  kk: string;
}

export interface ISubscriptionPlan extends BaseDocument {
  id: string;
  name: string | TranslatedString;
  price: number;
  messagesLimit: number;
  storageLimit: number;
  features: string[] | TranslatedString[];
  isFree?: boolean;
  freePeriodDays?: number;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: Schema.Types.Mixed,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    messagesLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    storageLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    features: {
      type: Schema.Types.Mixed,
      default: [],
    },
    isFree: {
      type: Boolean,
      default: false,
    },
    freePeriodDays: {
      type: Number,
      min: 0,
    },
  },
  baseSchemaOptions,
);

export const SubscriptionPlan = model<ISubscriptionPlan>(
  "SubscriptionPlan",
  subscriptionPlanSchema,
);
