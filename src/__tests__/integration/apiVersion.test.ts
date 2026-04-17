import request from "supertest";
import app from "../../app";
import type { ApiResponse, ApiErrorResponse } from "../helpers/testTypes";

describe("API Versioning", () => {
  describe("V1 API", () => {
    it("должен работать через /api/v1/health", async () => {
      const response = await request(app).get("/api/v1/health").expect(200);
      const body = response.body as ApiResponse<{ message: string }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data).toHaveProperty("message", "OK");
      }
    });

    it("должен работать через /api/health (обратная совместимость)", async () => {
      const response = await request(app).get("/api/health").expect(200);
      const body = response.body as ApiResponse<{ message: string }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data).toHaveProperty("message", "OK");
      }
    });
  });

  describe("Root endpoint", () => {
    it("должен возвращать информацию о версии API", async () => {
      const response = await request(app).get("/").expect(200);
      const body = response.body as {
        success: boolean;
        version?: string;
        documentation?: string;
      };
      expect(body.success).toBe(true);
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("documentation");
    });
  });

  describe("404 handling", () => {
    it("должен возвращать 404 для несуществующего маршрута", async () => {
      const response = await request(app)
        .get("/api/v1/nonexistent")
        .expect(404);
      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
