import request from "supertest";
import app from "../../app";
import { createTestCompanyUser } from "../helpers/testHelpers";

describe("E2E API Tests", () => {
  describe("Complete User Flow", () => {
    it("should complete full user registration and login flow", async () => {
      // 1. Register new user
      const registerResponse = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "e2e@example.com",
          password: "TestPassword123!",
          name: "E2E User",
        })
        .expect(201);

      expect((registerResponse.body as { success: boolean }).success).toBe(
        true,
      );
      expect(
        (registerResponse.body as { data: { token?: string } }).data.token,
      ).toBeDefined();

      const token = (registerResponse.body as { data: { token: string } }).data
        .token;

      // 2. Check session
      const sessionResponse = await request(app)
        .post("/api/v1/auth/check-session")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect((sessionResponse.body as { success: boolean }).success).toBe(true);
      expect(
        (sessionResponse.body as { data: { user: { email: string } } }).data
          .user.email,
      ).toBe("e2e@example.com");
    });

    it("should complete company message flow", async () => {
      const { company, token } = await createTestCompanyUser();

      // 1. Create message
      const messageResponse = await request(app)
        .post("/api/v1/messages")
        .send({
          companyCode: company.code,
          type: "complaint",
          content: "E2E test message",
        })
        .expect(201);

      expect((messageResponse.body as { success: boolean }).success).toBe(true);
      const messageId = (messageResponse.body as { data: { id: string } }).data
        .id;

      // 2. Get message
      const getMessageResponse = await request(app)
        .get(`/api/v1/messages/${messageId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect((getMessageResponse.body as { success: boolean }).success).toBe(
        true,
      );
      expect(
        (getMessageResponse.body as { data: { content: string } }).data.content,
      ).toBe("E2E test message");

      // 3. Update message status
      const updateResponse = await request(app)
        .put(`/api/v1/messages/${messageId}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "В работе" })
        .expect(200);

      expect((updateResponse.body as { success: boolean }).success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid routes gracefully", async () => {
      const response = await request(app)
        .get("/api/v1/nonexistent")
        .expect(404);

      expect((response.body as { success: boolean }).success).toBe(false);
      expect((response.body as { error: { code: string } }).error.code).toBe(
        "NOT_FOUND",
      );
    });

    it("should handle authentication errors", async () => {
      const response = await request(app).get("/api/v1/companies").expect(401);

      expect((response.body as { success: boolean }).success).toBe(false);
    });
  });
});
