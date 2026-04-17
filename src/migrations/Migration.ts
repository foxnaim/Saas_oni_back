import mongoose, { Document, Model } from "mongoose";

export interface IMigration extends Document {
  name: string;
  timestamp: Date;
  appliedAt: Date;
}

const migrationSchema = new mongoose.Schema<IMigration>({
  name: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true },
  appliedAt: { type: Date, default: Date.now },
});

export const Migration: Model<IMigration> =
  (mongoose.models.Migration as Model<IMigration>) ||
  mongoose.model<IMigration>("Migration", migrationSchema);
