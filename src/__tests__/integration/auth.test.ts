import request from "supertest";
import app from "../../app";
import { hashPassword } from "../../utils/password";
import { createTestUser } from "../helpers/testHelpers";
import type { ApiResponse, ApiErrorResponse } from "../helpers/testTypes";

describe("Auth API", () => {
  describe("POST /api/auth/register", () => {
    it("должен зарегистрировать нового пользователя", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "newuser@example.com",
          password: "TestPassword123!",
          name: "Test User",
        })
        .expect(201);

      const body = response.body as ApiResponse<{
        token: string;
        user: { email: string };
      }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data).toHaveProperty("token");
        expect(body.data.user).toHaveProperty("email", "newuser@example.com");
        expect(body.data.user).not.toHaveProperty("password");
      }
    });

    it("должен вернуть ошибку при регистрации с существующим email", async () => {
      const user = await createTestUser({ email: "existing@example.com" });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: user.email,
          password: "TestPassword123!",
        })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.message).toContain("already exists");
    });

    it("должен вернуть ошибку при невалидных данных", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "invalid-email",
          password: "123",
        })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    it("должен авторизовать пользователя с правильными credentials", async () => {
      const password = "TestPassword123!";
      const hashedPassword = await hashPassword(password);
      const user = await createTestUser({
        email: "login@example.com",
        password: hashedPassword,
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: password,
        })
        .expect(200);

      const body = response.body as ApiResponse<{
        token: string;
        user: { email: string };
      }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data).toHaveProperty("token");
        expect(body.data.user.email).toBe(user.email);
      }
    });

    it("должен вернуть ошибку при неправильном пароле", async () => {
      const user = await createTestUser({ email: "wrongpass@example.com" });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: "WrongPassword123!",
        })
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });

    it("должен вернуть ошибку при несуществующем пользователе", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "TestPassword123!",
        })
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/auth/check-session", () => {
    it("должен вернуть данные пользователя при валидном токене", async () => {
      const user = await createTestUser();
      const { generateToken } = await import("../../utils/jwt");
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .post("/api/auth/check-session")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const body = response.body as ApiResponse<{ user: { email: string } }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data.user.email).toBe(user.email);
      }
    });

    it("должен вернуть ошибку при отсутствии токена", async () => {
      const response = await request(app)
        .post("/api/auth/check-session")
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });

    it("должен вернуть ошибку при истекшем токене", async () => {
      const expiredToken = "expired.token.here";

      const response = await request(app)
        .post("/api/auth/check-session")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });
  });
});
