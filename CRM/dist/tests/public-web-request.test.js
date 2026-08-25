import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth.js";
import { createDatabase } from "../src/database.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { createApp } from "../src/server.js";
describe("public web requests", () => {
    let auth;
    beforeEach(async () => { auth = new AuthService(); await auth.seedUser("agent@example.com", "Password123!"); });
    function app() {
        return createApp(auth, new CustomerRepository(createDatabase(":memory:")));
    }
    const payload = { email: "ada@example.com", subject: "Printer broken", message: "It will not print.", category: "Hardware", dueDate: "2026-10-01" };
    it("creates a ticket plus web_form communication and returns only the ticket number", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        await repository.createCustomer({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "" });
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "agent@example.com", password: "Password123!" });
        const response = await agent.post("/api/public/web-requests").send(payload);
        expect(response.status).toBe(201);
        expect(Object.keys(response.body)).toEqual(["ticketNumber"]);
        expect(response.body.ticketNumber).toBe("TKT-000001");
        const ticket = (await agent.get("/api/tickets/1")).body;
        expect(ticket.status).toBe("new");
        expect(ticket.priority).toBe("medium");
        expect(ticket.assignedAgent).toBe("Unassigned");
        const communications = (await agent.get("/api/tickets/1/communications")).body;
        expect(communications).toHaveLength(1);
        expect(communications[0].channel).toBe("web_form");
        const history = (await agent.get("/api/tickets/1/history")).body;
        expect(history.filter((entry) => entry.changedBy === "web-form").length).toBeGreaterThanOrEqual(1);
    });
    it("rejects unknown emails and invalid payloads without writes", async () => {
        const instance = app();
        expect((await request(instance).post("/api/public/web-requests").send({ ...payload, email: "ghost@example.com" })).status).toBe(404);
        expect((await request(instance).post("/api/public/web-requests").send({ email: "bad", subject: "", message: "" })).status).toBe(400);
        expect((await request(instance).post("/api/public/web-requests").send({ ...payload, dueDate: "not-a-date" })).status).toBe(400);
    });
    it("rejects submissions when the web form channel is disabled", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        await repository.createCustomer({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "" });
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "agent@example.com", password: "Password123!" });
        await agent.patch("/api/communication-channels/web_form").send({ enabled: false });
        const response = await request(createApp(auth, repository)).post("/api/public/web-requests").send(payload);
        expect(response.status).toBe(403);
        expect((await agent.get("/api/tickets")).body.total).toBe(0);
    });
});
