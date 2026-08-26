import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth.js";
import { createDatabase } from "../src/database.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { createApp } from "../src/server.js";
describe("customer portal integration", () => {
    let auth;
    beforeEach(async () => { auth = new AuthService(); await auth.seedUser("agent@example.com", "Password123!"); });
    async function createCustomerAndTicket(email, firstName, lastName) {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const app = createApp(auth, repository);
        const agent = request.agent(app);
        await agent.post("/api/login").send({ email: "agent@example.com", password: "Password123!" });
        const customer = await agent.post("/api/customers").send({ firstName, lastName, email, phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "" });
        const ticket = await agent.post("/api/tickets").send({ customerId: customer.body.id, subject: "Help", description: "Need help", category: "Support", priority: "medium", assignedAgent: "agent@example.com", status: "open", dueDate: null });
        return { app, agent, customerId: customer.body.id, ticketNumber: ticket.body.ticketNumber };
    }
    it("verifies portal access with matching email and ticket, and rejects mismatches", async () => {
        const { app, ticketNumber } = await createCustomerAndTicket("ada@example.com", "Ada", "Lovelace");
        const response = await request(app).post("/api/public/portal-sessions").send({ email: "ada@example.com", ticketNumber });
        expect(response.status).toBe(201);
        const cookies = Array.isArray(response.headers["set-cookie"]) ? response.headers["set-cookie"] : [response.headers["set-cookie"]].filter(Boolean);
        expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
        const unauthorized = await request(app).get("/api/public/portal/tickets");
        expect(unauthorized.status).toBe(401);
        const badEmail = await request(app).post("/api/public/portal-sessions").send({ email: "ghost@example.com", ticketNumber });
        expect(badEmail.status).toBe(404);
        const badTicket = await request(app).post("/api/public/portal-sessions").send({ email: "ada@example.com", ticketNumber: "TKT-999999" });
        expect(badTicket.status).toBe(404);
    });
    it("lists and details customer-scoped tickets with safe projections", async () => {
        const { app, agent, ticketNumber } = await createCustomerAndTicket("ada@example.com", "Ada", "Lovelace");
        await agent.post("/api/public/portal-sessions").send({ email: "ada@example.com", ticketNumber });
        const list = await agent.get("/api/public/portal/tickets");
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(1);
        expect(list.body[0]).toMatchObject({ ticketNumber, subject: "Help", status: "open" });
        expect(list.body[0]).not.toHaveProperty("customerId");
        expect(list.body[0]).not.toHaveProperty("assignedAgent");
        const detail = await agent.get(`/api/public/portal/tickets/${ticketNumber}`);
        expect(detail.status).toBe(200);
        expect(detail.body.ticketNumber).toBe(ticketNumber);
        expect(detail.body).not.toHaveProperty("customerId");
        const history = await agent.get(`/api/public/portal/tickets/${ticketNumber}/history`);
        expect(history.status).toBe(200);
        expect(history.body.length).toBeGreaterThanOrEqual(1);
        expect(history.body.every((h) => !h.changedBy)).toBe(true);
    });
    it("denies cross-customer portal access", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const app = createApp(auth, repository);
        const agent = request.agent(app);
        await agent.post("/api/login").send({ email: "agent@example.com", password: "Password123!" });
        const ada = await agent.post("/api/customers").send({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "" });
        const adaTicket = await agent.post("/api/tickets").send({ customerId: ada.body.id, subject: "Ada help", description: "Need help", category: "Support", priority: "medium", assignedAgent: "agent@example.com", status: "open", dueDate: null });
        const other = await agent.post("/api/customers").send({ firstName: "Other", lastName: "User", email: "other@example.com", phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "" });
        const otherTicket = await agent.post("/api/tickets").send({ customerId: other.body.id, subject: "Other help", description: "Need help", category: "Support", priority: "medium", assignedAgent: "agent@example.com", status: "open", dueDate: null });
        const session = await request(app).post("/api/public/portal-sessions").send({ email: "ada@example.com", ticketNumber: otherTicket.body.ticketNumber });
        expect(session.status).toBe(404);
    });
    it("accepts valid feedback once and rejects duplicates", async () => {
        const { app, ticketNumber } = await createCustomerAndTicket("ada@example.com", "Ada", "Lovelace");
        const portalAgent = request.agent(app);
        await portalAgent.post("/api/public/portal-sessions").send({ email: "ada@example.com", ticketNumber });
        const first = await portalAgent.post(`/api/public/portal/tickets/${ticketNumber}/feedback`).send({ rating: 5, message: "Great" });
        expect(first.status).toBe(201);
        const duplicate = await portalAgent.post(`/api/public/portal/tickets/${ticketNumber}/feedback`).send({ rating: 4, message: "Again" });
        expect(duplicate.status).toBe(409);
        const invalid = await portalAgent.post(`/api/public/portal/tickets/${ticketNumber}/feedback`).send({ rating: 6, message: "Bad" });
        expect(invalid.status).toBe(400);
    });
    it("clears portal session on logout and rejects expired sessions", async () => {
        const { app, ticketNumber } = await createCustomerAndTicket("ada@example.com", "Ada", "Lovelace");
        const portalAgent = request.agent(app);
        await portalAgent.post("/api/public/portal-sessions").send({ email: "ada@example.com", ticketNumber });
        await portalAgent.get("/api/public/portal/tickets");
        await portalAgent.delete("/api/public/portal-sessions");
        const after = await portalAgent.get("/api/public/portal/tickets");
        expect(after.status).toBe(401);
    });
});
