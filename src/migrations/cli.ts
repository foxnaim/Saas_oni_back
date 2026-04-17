#!/usr/bin/env node

import mongoose from "mongoose";
import { config } from "../config/env";
import { Migrator } from "./migrator";
import { logger } from "../utils/logger";

const command = process.argv[2];

async function main(): Promise<void> {
  try {
    // Подключаемся к БД
    await mongoose.connect(config.mongodbUri);
    logger.info("Connected to database");

    const migrator = new Migrator();

    switch (command) {
      case "status":
        {
          const status = await migrator.status();
          logger.info("Migration status:", {
            applied: status.applied.length,
            pending: status.pending.length,
            appliedMigrations: status.applied,
            pendingMigrations: status.pending,
          });
        }
        break;

      case "rollback":
        {
          const migrationName = process.argv[3];
          if (!migrationName) {
            process.exit(1);
          }
          await migrator.rollbackMigration(migrationName);
        }
        break;

      case "run":
      default:
        {
          await migrator.run();
        }
        break;
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error("Migration CLI error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

void main();
