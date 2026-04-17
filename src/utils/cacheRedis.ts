/**
 * Redis кэш с fallback на in-memory кэш
 * Использует Redis если доступен, иначе fallback на SimpleCache
 */

import Redis from "ioredis";
import { config } from "../config/env";
import { logger } from "./logger";
import { SimpleCache } from "./cache";

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class CacheManager {
  private redis: Redis | null = null;
  private fallbackCache: SimpleCache;
  private useRedis: boolean = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0,
  };

  constructor() {
    this.fallbackCache = new SimpleCache();
    void this.initializeRedis();
  }

  /**
   * Инициализация Redis подключения
   */
  private async initializeRedis(): Promise<void> {
    if (!config.redisEnabled) {
      logger.info("Redis disabled, using in-memory cache");
      return;
    }

    try {
      this.redis = new Redis({
        host: config.redisHost,
        port: config.redisPort,
        password: config.redisPassword,
        retryStrategy: (times: number): number => {
          // Экспоненциальная задержка с максимумом 3 секунды
          const delay = Math.min(times * 50, 3000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on("error", (error: Error) => {
        logger.warn(
          "Redis connection error, falling back to in-memory cache:",
          error,
        );
        this.useRedis = false;
      });

      this.redis.on("connect", () => {
        logger.info("Redis connected successfully");
        this.useRedis = true;
      });

      this.redis.on("ready", () => {
        logger.info("Redis ready");
        this.useRedis = true;
      });

      await this.redis.connect();
    } catch (error) {
      logger.warn("Failed to connect to Redis, using in-memory cache:", error);
      this.useRedis = false;
      if (this.redis) {
        this.redis.disconnect();
        this.redis = null;
      }
    }
  }

  /**
   * Получить значение из кэша
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis && this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          this.stats.hits++;
          this.updateHitRate();
          return JSON.parse(value) as T;
        }
        this.stats.misses++;
        this.updateHitRate();
        return null;
      } catch (error) {
        logger.warn("Redis get error, falling back to in-memory cache:", error);
        this.useRedis = false;
        // Fallback на in-memory
        return this.fallbackCache.get<T>(key);
      }
    }

    // Используем in-memory кэш
    const value = this.fallbackCache.get<T>(key);
    if (value) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    this.updateHitRate();
    return value;
  }

  /**
   * Сохранить значение в кэш
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const ttlMs = ttl || SimpleCache.getTTL("default");
    const ttlSeconds = Math.floor(ttlMs / 1000);

    if (this.useRedis && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
        this.stats.size = await this.redis.dbsize();
        return;
      } catch (error) {
        logger.warn("Redis set error, falling back to in-memory cache:", error);
        this.useRedis = false;
        // Fallback на in-memory
        this.fallbackCache.set(key, data, ttl);
        this.stats.size = this.fallbackCache.size();
        return;
      }
    }

    // Используем in-memory кэш
    this.fallbackCache.set(key, data, ttl);
    this.stats.size = this.fallbackCache.size();
  }

  /**
   * Удалить значение из кэша
   */
  async delete(key: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.del(key);
        this.stats.size = await this.redis.dbsize();
        return;
      } catch (error) {
        logger.warn(
          "Redis delete error, falling back to in-memory cache:",
          error,
        );
        this.useRedis = false;
        // Fallback на in-memory
        this.fallbackCache.delete(key);
        this.stats.size = this.fallbackCache.size();
        return;
      }
    }

    // Используем in-memory кэш
    this.fallbackCache.delete(key);
    this.stats.size = this.fallbackCache.size();
  }

  /**
   * Очистить весь кэш
   */
  async clear(): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.flushdb();
        this.stats.size = 0;
        return;
      } catch (error) {
        logger.warn(
          "Redis clear error, falling back to in-memory cache:",
          error,
        );
        this.useRedis = false;
        // Fallback на in-memory
        this.fallbackCache.clear();
        this.stats.size = 0;
        return;
      }
    }

    // Используем in-memory кэш
    this.fallbackCache.clear();
    this.stats.size = 0;
  }

  /**
   * Получить статистику кэша
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Обновить hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Получить TTL для разных типов данных
   * Увеличены TTL для более агрессивного кэширования
   */
  static getTTL(
    type: "company" | "stats" | "messages" | "default" | "long",
  ): number {
    const ttlMap: Record<string, number> = {
      company: 5 * 60 * 1000, // 5 минут - данные компании могут меняться (статус, план)
      stats: 5 * 60 * 1000, // 5 минут - статистика обновляется не так часто
      messages: 2 * 60 * 1000, // 2 минуты - сообщения могут обновляться часто
      long: 60 * 60 * 1000, // 1 час для очень стабильных данных (планы, настройки)
      default: 5 * 60 * 1000, // 5 минут - общий кэш
    };
    return ttlMap[type] || ttlMap.default;
  }

  /**
   * Закрыть соединение с Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.useRedis = false;
    }
  }
}

// Экспортируем класс для использования статических методов
export { CacheManager };

// Создаем singleton экземпляр
export const cache = new CacheManager();

// Graceful shutdown
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    void cache.disconnect();
  });

  process.on("SIGINT", () => {
    void cache.disconnect();
  });
}
