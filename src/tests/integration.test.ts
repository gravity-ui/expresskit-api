import request from "supertest";
import type { Express } from "express";
import app from "../example/index";

describe("Example Application Integration Tests", () => {
  let expressApp: Express;

  beforeAll(() => {
    expressApp = app.express;
  });

  describe("GET /users/:userId", () => {
    const validUserId = "123e4567-e89b-12d3-a456-426614174000";
    const invalidUserId = "00000000-0000-0000-0000-000000000000";

    it("should return 401 without authorization header", async () => {
      const response = await request(expressApp)
        .get(`/users/${validUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(expressApp)
        .get(`/users/${validUserId}`)
        .set("Authorization", "Bearer invalid_token")
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 200 with valid token and valid user ID", async () => {
      const response = await request(expressApp)
        .get(`/users/${validUserId}`)
        .set("Authorization", "Bearer valid_token")
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("email");
      expect(response.body.id).toBe(validUserId);
    });

    it("should return 404 with valid token but non-existent user", async () => {
      const response = await request(expressApp)
        .get(`/users/${invalidUserId}`)
        .set("Authorization", "Bearer valid_token")
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body).toHaveProperty("code");
      expect(response.body.code).toBe("USER_NOT_FOUND");
    });

    it("should return 400 with invalid UUID format", async () => {
      const response = await request(expressApp)
        .get("/users/invalid-uuid")
        .set("Authorization", "Bearer valid_token")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /items", () => {
    it("should return 401 without API key", async () => {
      const response = await request(expressApp)
        .post("/items")
        .send({ itemName: "Test Item", quantity: 10 })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 401 with invalid API key", async () => {
      const response = await request(expressApp)
        .post("/items")
        .set("X-API-Key", "invalid_api_key")
        .send({ itemName: "Test Item", quantity: 10 })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 201 with valid API key and valid data", async () => {
      const response = await request(expressApp)
        .post("/items")
        .set("X-API-Key", "valid_api_key")
        .send({ itemName: "My New Item", quantity: 10 })
        .expect(201);

      expect(response.body).toHaveProperty("itemId");
      expect(response.body).toHaveProperty("itemName");
      expect(response.body).toHaveProperty("quantity");
      expect(response.body.itemId).toBe("123e4567-e89b-12d3-a456-426614174000");
    });

    it("should return 422 with forbidden item name", async () => {
      const response = await request(expressApp)
        .post("/items")
        .set("X-API-Key", "valid_api_key")
        .send({ itemName: "forbidden_item", quantity: 1 })
        .expect(422);

      expect(response.body).toHaveProperty("error");
      expect(response.body).toHaveProperty("code");
      expect(response.body.code).toBe("ITEM_FORBIDDEN");
    });

    it("should return 400 with invalid request body", async () => {
      const response = await request(expressApp)
        .post("/items")
        .set("X-API-Key", "valid_api_key")
        .send({ itemName: "AB", quantity: -1 }) // Too short name and negative quantity
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("PUT /users/:userId/email", () => {
    const validUserId = "123e4567-e89b-12d3-a456-426614174000";

    it("should return 401 without authorization header", async () => {
      const response = await request(expressApp)
        .put(`/users/${validUserId}/email`)
        .send({ email: "new@example.com", confirmEmail: "new@example.com" })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 200 with valid token and matching emails", async () => {
      const response = await request(expressApp)
        .put(`/users/${validUserId}/email`)
        .set("Authorization", "Bearer valid_token")
        .send({ email: "new@example.com", confirmEmail: "new@example.com" })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("details");
      expect(response.body.message).toBe("Email updated successfully");
    });

    it("should return 400 with non-matching emails", async () => {
      const response = await request(expressApp)
        .put(`/users/${validUserId}/email`)
        .set("Authorization", "Bearer valid_token")
        .send({ email: "new@example.com", confirmEmail: "other@example.com" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 with invalid email format", async () => {
      const response = await request(expressApp)
        .put(`/users/${validUserId}/email`)
        .set("Authorization", "Bearer valid_token")
        .send({ email: "invalid-email", confirmEmail: "invalid-email" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("DELETE /items/:itemId", () => {
    const validItemId = "123e4567-e89b-12d3-a456-426614174000";

    it("should return 401 without API key", async () => {
      const response = await request(expressApp)
        .delete(`/items/${validItemId}`)
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 204 with valid API key", async () => {
      const response = await request(expressApp)
        .delete(`/items/${validItemId}`)
        .set("X-API-Key", "valid_api_key")
        .expect(204);

      expect(response.body).toEqual({});
    });

    it("should return 400 with invalid UUID format", async () => {
      const response = await request(expressApp)
        .delete("/items/invalid-uuid")
        .set("X-API-Key", "valid_api_key")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /items", () => {
    it("should return 200 without authentication (public route)", async () => {
      const response = await request(expressApp).get("/items").expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty("itemId");
      expect(response.body[0]).toHaveProperty("itemName");
      expect(response.body[0]).toHaveProperty("quantity");
    });

    it("should return 200 with query parameters", async () => {
      const response = await request(expressApp)
        .get("/items")
        .query({ limit: 3, includeDetails: false })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(3);
    });

    it("should return 400 with invalid query parameters", async () => {
      const response = await request(expressApp)
        .get("/items")
        .query({ limit: 100 }) // Exceeds max of 10
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/docs", () => {
    it("should serve Swagger UI", async () => {
      // Swagger UI may redirect, so follow redirects
      const response = await request(expressApp)
        .get("/api/docs")
        .redirects(1)
        .expect(200);

      // Swagger UI should return HTML
      expect(response.headers["content-type"]).toMatch(/text\/html/);
    });
  });
});
