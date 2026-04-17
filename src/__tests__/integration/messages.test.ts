import request from "supertest";
import app from "../../app";
import { Message } from "../../models/Message";
import {
  createTestCompanyUser,
  createTestToken,
  createTestUser,
} from "../helpers/testHelpers";
import type { ApiResponse, ApiErrorResponse } from "../helpers/testTypes";

describe("Messages API", () => {
  describe("POST /api/messages", () => {
    it("должен создать новое сообщение", async () => {
      const { company } = await createTestCompanyUser();

      const response = await request(app)
        .post("/api/messages")
        .send({
          companyCode: company.code,
          type: "complaint",
          content: "Test message content",
        })
        .expect(201);

      const body = response.body as ApiResponse<{
        id: string;
        content: string;
        companyCode: string;
      }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data).toHaveProperty("id");
        expect(body.data.content).toBe("Test message content");
        expect(body.data.companyCode).toBe(company.code);
      }
    });

    it("должен вернуть ошибку при невалидных данных", async () => {
      const response = await request(app)
        .post("/api/messages")
        .send({
          companyCode: "INVALID",
          type: "invalid-type",
          content: "",
        })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/messages", () => {
    it("должен вернуть список сообщений для админа", async () => {
      const admin = await createTestUser({ role: "admin" });
      const token = createTestToken(admin);
      const { company } = await createTestCompanyUser();

      // Создаем тестовое сообщение
      const message = new Message({
        id: `FB-2024-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        companyCode: company.code,
        type: "complaint",
        content: "Test message",
        status: "Новое",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await message.save();

      const response = await request(app)
        .get("/api/messages")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const body = response.body as ApiResponse<unknown[]>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(Array.isArray(body.data)).toBe(true);
      }
    });

    it("должен вернуть только сообщения своей компании для пользователя компании", async () => {
      const { company, token } = await createTestCompanyUser();
      const { company: otherCompany } = await createTestCompanyUser();

      // Создаем сообщение для своей компании
      const ownMessage = new Message({
        id: `FB-2024-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        companyCode: company.code,
        type: "complaint",
        content: "Own message",
        status: "Новое",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await ownMessage.save();

      // Создаем сообщение для другой компании
      const otherMessage = new Message({
        id: `FB-2024-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        companyCode: otherCompany.code,
        type: "complaint",
        content: "Other message",
        status: "Новое",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await otherMessage.save();

      const response = await request(app)
        .get("/api/messages")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const body = response.body as ApiResponse<Array<{ companyCode: string }>>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data.length).toBe(1);
        expect(body.data[0]?.companyCode).toBe(company.code);
      }
    });
  });
});
