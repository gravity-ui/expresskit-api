import request from "supertest";
import type { Express } from "express";
import app from "../example/index";

describe("Example Application Integration Tests", () => {
  let expressApp: Express;

  beforeAll(() => {
    expressApp = app.express;
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
