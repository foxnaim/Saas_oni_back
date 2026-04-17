import { SimpleCache } from "../../utils/cache";

describe("SimpleCache", () => {
  let cache: SimpleCache;

  beforeEach(() => {
    cache = new SimpleCache();
  });

  afterEach(() => {
    cache.clear();
  });

  describe("get/set", () => {
    it("должен сохранять и получать значение", () => {
      cache.set("test-key", "test-value");
      const value = cache.get<string>("test-key");
      expect(value).toBe("test-value");
    });

    it("должен возвращать null для несуществующего ключа", () => {
      const value = cache.get("non-existent");
      expect(value).toBeNull();
    });

    it("должен перезаписывать существующее значение", () => {
      cache.set("key", "value1");
      cache.set("key", "value2");
      const value = cache.get<string>("key");
      expect(value).toBe("value2");
    });

    it("должен работать с разными типами данных", () => {
      cache.set("string", "test");
      cache.set("number", 123);
      cache.set("object", { key: "value" });
      cache.set("array", [1, 2, 3]);

      expect(cache.get<string>("string")).toBe("test");
      expect(cache.get<number>("number")).toBe(123);
      expect(cache.get<{ key: string }>("object")).toEqual({ key: "value" });
      expect(cache.get<number[]>("array")).toEqual([1, 2, 3]);
    });
  });

  describe("TTL", () => {
    it("должен удалять истекшие записи", async () => {
      cache.set("short-ttl", "value", 100); // 100ms TTL
      expect(cache.get("short-ttl")).toBe("value");

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(cache.get("short-ttl")).toBeNull();
    });

    it("должен использовать разные TTL для разных типов", () => {
      const companyTTL = SimpleCache.getTTL("company");
      const statsTTL = SimpleCache.getTTL("stats");
      const messagesTTL = SimpleCache.getTTL("messages");
      const defaultTTL = SimpleCache.getTTL("default");

      expect(companyTTL).toBe(10 * 60 * 1000); // 10 минут
      expect(statsTTL).toBe(2 * 60 * 1000); // 2 минуты
      expect(messagesTTL).toBe(1 * 60 * 1000); // 1 минута
      expect(defaultTTL).toBe(5 * 60 * 1000); // 5 минут
    });
  });

  describe("delete", () => {
    it("должен удалять значение по ключу", () => {
      cache.set("key", "value");
      cache.delete("key");
      expect(cache.get("key")).toBeNull();
    });

    it("должен безопасно обрабатывать удаление несуществующего ключа", () => {
      expect(() => cache.delete("non-existent")).not.toThrow();
    });
  });

  describe("clear", () => {
    it("должен очищать весь кэш", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();

      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBeNull();
      expect(cache.size()).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("должен удалять истекшие записи", async () => {
      cache.set("expired", "value", 50);
      cache.set("valid", "value", 1000);

      await new Promise((resolve) => setTimeout(resolve, 100));
      const cleaned = cache.cleanup();

      expect(cleaned).toBeGreaterThan(0);
      expect(cache.get("expired")).toBeNull();
      expect(cache.get("valid")).toBe("value");
    });
  });

  describe("statistics", () => {
    it("должен отслеживать hits и misses", () => {
      cache.set("key", "value");

      cache.get("key"); // hit
      cache.get("key"); // hit
      cache.get("non-existent"); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it("должен обновлять размер кэша", () => {
      expect(cache.size()).toBe(0);
      cache.set("key1", "value1");
      expect(cache.size()).toBe(1);
      cache.set("key2", "value2");
      expect(cache.size()).toBe(2);
      cache.delete("key1");
      expect(cache.size()).toBe(1);
    });
  });
});
