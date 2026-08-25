import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth.js";
import { createDatabase } from "../src/database.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { createApp } from "../src/server.js";

describe("support tickets", () => {
  let auth: AuthService;
  beforeEach(async () => { auth = new AuthService(); await auth.seedUser("agent@example.com", "Password123!"); });

  async function signedInAgent() {
    const repository = new CustomerRepository(createDatabase(":memory:"));
    const agent = request.agent(createApp(auth, repository));
    await agent.post("/api/login").send({ email: "agent@example.com", password: "Password123!" });
    const customer = await agent.post("/api/customers").send({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "555-000-0000", company: "Analytical", jobTitle: "Founder", status: "active", address: "London", notes: "" });
    return { agent, customerId: customer.body.id };
  }
  const ticketInput = (customerId: number) => ({ customerId, subject: "Cannot sign in", description: "The customer cannot access the dashboard.", category: "Access", priority: "high", assignedAgent: "agent@example.com", status: "new", dueDate: "2026-09-01" });

  it("creates, lists, updates, escalates, and records immutable history", async () => {
    const { agent, customerId } = await signedInAgent();
    const created = await agent.post("/api/tickets").send(ticketInput(customerId));
    expect(created.status).toBe(201); expect(created.body.ticketNumber).toBe("TKT-000001"); expect(created.body.customerName).toBe("Ada Lovelace");
    expect((await agent.get("/api/tickets?status=new&priority=high")).body.items).toHaveLength(1);
    const updated = await agent.patch(`/api/tickets/${created.body.id}`).send({ ...ticketInput(customerId), status: "in_progress", priority: "urgent", assignedAgent: "owner@example.com" });
    expect(updated.status).toBe(200); expect(updated.body.status).toBe("in_progress");
    expect((await agent.post(`/api/tickets/${created.body.id}/escalate`)).body.isEscalated).toBe(true);
    await agent.post(`/api/tickets/${created.body.id}/escalate`);
    const history = await agent.get(`/api/tickets/${created.body.id}/history`);
    expect(history.status).toBe(200); expect(history.body.map((entry: { action: string }) => entry.action)).toEqual(expect.arrayContaining(["created", "status_changed", "priority_changed", "assignment_changed", "escalated"]));
    expect(history.body.filter((entry: { action: string }) => entry.action === "escalated")).toHaveLength(1);
  });

  it("rejects unauthenticated, malformed, and missing ticket requests", async () => {
    expect((await request(createApp(auth)).get("/api/tickets")).status).toBe(401);
    const { agent, customerId } = await signedInAgent();
    expect((await agent.post("/api/tickets").send({ ...ticketInput(customerId), priority: "critical" })).status).toBe(400);
    expect((await agent.post("/api/tickets").send(ticketInput(999))).status).toBe(404);
    expect((await agent.get("/api/tickets/0")).status).toBe(400);
    expect((await agent.get("/api/tickets/999")).status).toBe(404);
  });
});
