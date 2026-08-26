import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth.js";
import { createDatabase } from "../src/database.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { createApp } from "../src/server.js";

describe("knowledge base integration", () => {
  let auth: AuthService;
  beforeEach(async () => { auth = new AuthService(); await auth.seedUser("demo@example.com", "Password123!"); });

  async function adminRepo() {
    const repository = new CustomerRepository(createDatabase(":memory:"));
    return { app: createApp(auth, repository), agent: request.agent(createApp(auth, repository)) };
  }

  it("allows an admin to create, publish, list, view, update, and delete articles", async () => {
    const { agent } = await adminRepo();
    await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
    const created = await agent.post("/api/articles").send({ type: "faq", category: "Billing", title: "Payments", summary: "How to pay.", body: "Use the portal.", status: "draft" });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await agent.get("/api/articles")).body.items).toHaveLength(1);
    expect((await agent.get(`/api/articles/${id}`)).body.status).toBe("draft");
    const published = await agent.patch(`/api/articles/${id}`).send({ type: "faq", category: "Billing", title: "Payments", summary: "How to pay.", body: "Use the portal.", status: "published" });
    expect(published.status).toBe(200);
    expect(published.body.publishedAt).not.toBeNull();
    expect((await agent.get(`/api/public/articles/${id}`)).body.status).toBe("published");
    expect((await agent.delete(`/api/articles/${id}`)).status).toBe(204);
    expect((await agent.get(`/api/articles/${id}`)).status).toBe(404);
  });

  it("rejects invalid article input and non-admin access", async () => {
    const { agent } = await adminRepo();
    await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
    expect((await agent.post("/api/articles").send({ type: "invalid", category: "A", title: "T", summary: "S", body: "B" })).status).toBe(400);
    const created = await agent.post("/api/articles").send({ type: "faq", category: "A", title: "T", summary: "S", body: "B", status: "published" });
    expect((await request(createApp(auth)).get(`/api/articles/${created.body.id}`)).status).toBe(401);
    await agent.post("/api/logout");
    await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
    expect((await agent.get("/api/articles")).status).toBe(200);
  });

  it("returns 404 for draft or absent public articles", async () => {
    const { agent, app } = await adminRepo();
    await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
    const created = await agent.post("/api/articles").send({ type: "faq", category: "A", title: "T", summary: "S", body: "B", status: "draft" });
    expect((await request(app).get(`/api/public/articles/${created.body.id}`)).status).toBe(404);
    expect((await request(app).get("/api/public/articles/999")).status).toBe(404);
  });

  it("searches published articles publicly", async () => {
    const repository = new CustomerRepository(createDatabase(":memory:"));
    const app = createApp(auth, repository);
    const agent = request.agent(app);
    await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
    await agent.post("/api/articles").send({ type: "faq", category: "Billing", title: "Payments", summary: "How to pay.", body: "Use the portal.", status: "published" });
    const response = await request(app).get("/api/public/articles?search=payments");
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].title).toBe("Payments");
  });
});
