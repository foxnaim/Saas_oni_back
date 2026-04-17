import request from "supertest";
import app from "../../app";
import {
  createTestCompanyUser,
  createTestToken,
  createTestUser,
} from "../helpers/testHelpers";
import type { ApiResponse, ApiErrorResponse } from "../helpers/testTypes";

describe("Companies API", () => {
  describe("GET /api/companies", () => {
    it("должен вернуть список компаний для админа", async () => {
      const admin = await createTestUser({ role: "admin" });
      const token = createTestToken(admin);
      await createTestCompanyUser();

      const response = await request(app)
        .get("/api/companies")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const body = response.body as ApiResponse<unknown[]>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(Array.isArray(body.data)).toBe(true);
      }
    });

    it("должен вернуть ошибку для неавторизованного пользователя", async () => {
      const response = await request(app).get("/api/companies").expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });

    it("должен вернуть ошибку для обычного пользователя", async () => {
      const user = await createTestUser({ role: "user" });
      const token = createTestToken(user);

      const response = await request(app)
        .get("/api/companies")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/companies/:id", () => {
    it("должен вернуть компанию по ID для админа", async () => {
      const admin = await createTestUser({ role: "admin" });
      const token = createTestToken(admin);
      const { company } = await createTestCompanyUser();

      const response = await request(app)
        .get(`/api/companies/${String(company._id)}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const body = response.body as ApiResponse<{ code: string }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data.code).toBe(company.code);
      }
    });

    it("должен вернуть компанию для пользователя компании (свою)", async () => {
      const { company, token } = await createTestCompanyUser();

      const response = await request(app)
        .get(`/api/companies/${String(company._id)}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const body = response.body as ApiResponse<{ code: string }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data.code).toBe(company.code);
      }
    });

    it("должен вернуть ошибку при доступе к чужой компании", async () => {
      const { token } = await createTestCompanyUser();
      const { company: otherCompany } = await createTestCompanyUser();

      const response = await request(app)
        .get(`/api/companies/${String(otherCompany._id)}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/companies/code/:code", () => {
    it("должен вернуть компанию по коду (публичный endpoint)", async () => {
      const { company } = await createTestCompanyUser();

      const response = await request(app)
        .get(`/api/companies/code/${company.code}`)
        .expect(200);

      const body = response.body as ApiResponse<{ code: string; name: string }>;
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data.code).toBe(company.code);
        expect(body.data.name).toBe(company.name);
      }
    });

    it("должен вернуть 404 для несуществующего кода", async () => {
      const response = await request(app)
        .get("/api/companies/code/INVALID")
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.success).toBe(false);
    });
  });
});
