import { hashPassword, comparePassword } from "../../utils/password";

describe("Password Utils", () => {
  const testPassword = "TestPassword123!";

  describe("hashPassword", () => {
    it("должен хешировать пароль", async () => {
      const hashed = await hashPassword(testPassword);
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(testPassword);
      expect(hashed.length).toBeGreaterThan(0);
    });

    it("должен генерировать разные хеши для одного пароля (из-за salt)", async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);
      // Хеши должны быть разными из-за случайной соли
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("comparePassword", () => {
    it("должен успешно сравнивать правильный пароль с хешем", async () => {
      const hashed = await hashPassword(testPassword);
      const isValid = await comparePassword(testPassword, hashed);
      expect(isValid).toBe(true);
    });

    it("должен возвращать false для неправильного пароля", async () => {
      const hashed = await hashPassword(testPassword);
      const isValid = await comparePassword("WrongPassword123!", hashed);
      expect(isValid).toBe(false);
    });

    it("должен корректно работать с разными хешами одного пароля", async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);

      const isValid1 = await comparePassword(testPassword, hash1);
      const isValid2 = await comparePassword(testPassword, hash2);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
  });
});
