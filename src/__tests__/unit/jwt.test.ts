import { generateToken, verifyToken, TokenError } from "../../utils/jwt";
import { config } from "../../config/env";
import jwt from "jsonwebtoken";

describe("JWT Utils", () => {
  const mockPayload = {
    userId: "123",
    email: "test@example.com",
    role: "user",
    companyId: "456",
  };

  describe("generateToken", () => {
    it("должен генерировать валидный JWT токен", () => {
      const token = generateToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT состоит из 3 частей
    });

    it("должен включать все поля payload в токен", () => {
      const token = generateToken(mockPayload);
      const decoded = jwt.decode(token) as typeof mockPayload;
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.companyId).toBe(mockPayload.companyId);
    });
  });

  describe("verifyToken", () => {
    it("должен успешно верифицировать валидный токен", () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.companyId).toBe(mockPayload.companyId);
    });

    it("должен выбрасывать TokenError с кодом EXPIRED для истекшего токена", () => {
      const expiredToken = jwt.sign(mockPayload, config.jwtSecret, {
        expiresIn: "-1h", // Токен уже истек
      });

      expect(() => verifyToken(expiredToken)).toThrow(TokenError);
      try {
        verifyToken(expiredToken);
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        if (error instanceof TokenError) {
          expect(error.code).toBe("EXPIRED");
        }
      }
    });

    it("должен выбрасывать TokenError с кодом MALFORMED для невалидного токена", () => {
      const invalidToken = "invalid.token.here";

      expect(() => verifyToken(invalidToken)).toThrow(TokenError);
      try {
        verifyToken(invalidToken);
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        if (error instanceof TokenError) {
          expect(error.code).toBe("MALFORMED");
        }
      }
    });

    it("должен выбрасывать TokenError с кодом MALFORMED для неправильно сформированного токена", () => {
      const malformedToken = "not.a.valid.jwt.token.structure";

      expect(() => verifyToken(malformedToken)).toThrow(TokenError);
      try {
        verifyToken(malformedToken);
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        if (error instanceof TokenError) {
          expect(["INVALID", "MALFORMED"]).toContain(error.code);
        }
      }
    });

    it("должен выбрасывать TokenError для токена с неправильным секретом", () => {
      const tokenWithWrongSecret = jwt.sign(mockPayload, "wrong-secret");

      expect(() => verifyToken(tokenWithWrongSecret)).toThrow(TokenError);
      try {
        verifyToken(tokenWithWrongSecret);
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        if (error instanceof TokenError) {
          // JWT с неправильным секретом вызывает "invalid signature" - это MALFORMED
          expect(["INVALID", "MALFORMED"]).toContain(error.code);
        }
      }
    });
  });
});
