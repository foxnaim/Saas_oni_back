/**
 * Простой in-memory кэш для часто запрашиваемых данных
 * В production можно заменить на Redis
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class SimpleCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 минут по умолчанию
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0,
  };

  /**
   * Получить значение из кэша
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Проверяем срок действия
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Обновляем статистику доступа
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    this.updateHitRate();

    return entry.data as T;
  }

  /**
   * Сохранить значение в кэш
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);
    this.cache.set(key, {
      data,
      expiresAt,
      createdAt: now,
      accessCount: 0,
      lastAccessed: now,
    });
    this.stats.size = this.cache.size;
  }

  /**
   * Удалить значение из кэша
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Очистить весь кэш
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0,
    };
  }

  /**
   * Удалить устаревшие записи
   * @returns Количество удаленных записей
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    this.stats.size = this.cache.size;
    return cleaned;
  }

  /**
   * Получить размер кэша
   */
  size(): number {
    return this.cache.size;
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
   */
  static getTTL(type: "company" | "stats" | "messages" | "default"): number {
    const ttlMap: Record<string, number> = {
      company: 10 * 60 * 1000, // 10 минут для данных компании
      stats: 2 * 60 * 1000, // 2 минуты для статистики
      messages: 1 * 60 * 1000, // 1 минута для сообщений
      default: 5 * 60 * 1000, // 5 минут по умолчанию
    };
    return ttlMap[type] || ttlMap.default;
  }
}

// Экспортируем SimpleCache для использования в cacheRedis.ts
// В production используйте cacheRedis вместо этого
export const cache = new SimpleCache();

// Периодическая очистка устаревших записей (каждые 10 минут)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      cache.cleanup();
    },
    10 * 60 * 1000,
  );
}
