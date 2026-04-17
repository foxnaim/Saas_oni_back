import { Migration } from "./Migration";
import { logger } from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

export interface MigrationFile {
  name: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

export class Migrator {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, "files");
  }

  /**
   * Получить список всех файлов миграций
   */
  private getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      return [];
    }

    return fs
      .readdirSync(this.migrationsPath)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
      .sort();
  }

  /**
   * Загрузить миграцию из файла
   */
  private async loadMigration(fileName: string): Promise<MigrationFile> {
    const filePath = path.join(this.migrationsPath, fileName);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const migration = await import(filePath);
    return {
      name: fileName.replace(/\.(ts|js)$/, ""),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      up: migration.up as () => Promise<void>,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      down: migration.down as (() => Promise<void>) | undefined,
    };
  }

  /**
   * Получить список примененных миграций
   */
  private async getAppliedMigrations(): Promise<string[]> {
    const migrations = await Migration.find().sort({ timestamp: 1 });
    return migrations.map((m) => m.name);
  }

  /**
   * Применить миграцию
   */
  private async applyMigration(migration: MigrationFile): Promise<void> {
    logger.info(`Applying migration: ${migration.name}`);
    await migration.up();

    await Migration.create({
      name: migration.name,
      timestamp: new Date(),
      appliedAt: new Date(),
    });

    logger.info(`Migration ${migration.name} applied successfully`);
  }

  /**
   * Откатить миграцию
   */
  async rollbackMigration(migrationName: string): Promise<void> {
    const migration = await Migration.findOne({ name: migrationName });
    if (!migration) {
      throw new Error(`Migration ${migrationName} not found`);
    }

    const migrationFile = await this.loadMigration(`${migrationName}.ts`);
    if (!migrationFile.down) {
      throw new Error(
        `Migration ${migrationName} does not have a down function`,
      );
    }

    logger.info(`Rolling back migration: ${migrationName}`);
    await migrationFile.down();
    await Migration.deleteOne({ name: migrationName });
    logger.info(`Migration ${migrationName} rolled back successfully`);
  }

  /**
   * Запустить все непримененные миграции
   */
  async run(): Promise<void> {
    try {
      const files = this.getMigrationFiles();
      const applied = await this.getAppliedMigrations();

      const pending = files.filter((file) => {
        const name = file.replace(/\.(ts|js)$/, "");
        return !applied.includes(name);
      });

      if (pending.length === 0) {
        logger.info("No pending migrations");
        return;
      }

      logger.info(`Found ${pending.length} pending migration(s)`);

      for (const file of pending) {
        const migration = await this.loadMigration(file);
        await this.applyMigration(migration);
      }

      logger.info("All migrations completed successfully");
    } catch (error) {
      logger.error("Migration error:", error);
      throw error;
    }
  }

  /**
   * Получить статус миграций
   */
  async status(): Promise<{
    applied: string[];
    pending: string[];
  }> {
    const files = this.getMigrationFiles();
    const applied = await this.getAppliedMigrations();

    const fileNames = files.map((file) => file.replace(/\.(ts|js)$/, ""));
    const pending = fileNames.filter((name) => !applied.includes(name));

    return {
      applied,
      pending,
    };
  }
}
