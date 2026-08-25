import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth.js";
import { createDatabase } from "../src/database.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { createApp } from "../src/server.js";
describe("communications", () => {
    let auth;
    beforeEach(async () => { auth = new AuthService(); await auth.seedUser("agent@example.com", "Password123!"); });
    async function signedInAgent() {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "agent@example.com", password: "Password123!" });
        const customer = await agent.post("/api/customers").send({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "" });
        return { agent, customerId: customer.body.id };
    }
    const message = (customerId, overrides = {}) => ({ customerId, channel: "email", message: "Customer called about billing.", ...overrides });
    it("lists and toggles the five configured channels", async () => {
        const { agent } = await signedInAgent();
        const channels = (await agent.get("/api/communication-channels")).body;
        expect(channels).toHaveLength(5);
        expect(channels.every((channel) => channel.isEnabled)).toBe(true);
        const disabled = await agent.patch("/api/communication-channels/sms").send({ enabled: false });
        expect(disabled.status).toBe(200);
        expect(disabled.body.isEnabled).toBe(false);
        expect((await agent.patch("/api/communication-channels/nope").send({ enabled: true })).status).toBe(400);
    });
    it("records incoming messages for every configured channel with history events", async () => {
        const { agent, customerId } = await signedInAgent();
        for (const channel of ["email", "whatsapp", "live_chat", "sms"]) {
            const created = await agent.post("/api/communications").send(message(customerId, { channel }));
            expect(created.status).toBe(201);
            expect(created.body.channel).toBe(channel);
        }
        for (let id = 1; id <= 4; id++) {
            const history = (await agent.get(`/api/tickets/${id}/history`)).body;
            expect(history.filter((entry) => entry.action === "communication_received")).toHaveLength(1);
        }
    });
    it("links to an existing same-customer ticket without changing ticket fields", async () => {
        const { agent, customerId } = await signedInAgent();
        const ticket = (await agent.post("/api/tickets").send({ customerId, subject: "S", description: "D", category: "C", priority: "high", assignedAgent: "agent@example.com", status: "open", dueDate: null })).body;
        const created = await agent.post("/api/communications").send(message(customerId, { ticketId: ticket.id }));
        expect(created.status).toBe(201);
        expect(created.body.ticketId).toBe(ticket.id);
        const updatedTicket = (await agent.get(`/api/tickets/${ticket.id}`)).body;
        expect(updatedTicket.status).toBe("open");
        expect(updatedTicket.priority).toBe("high");
        const history = (await agent.get(`/api/tickets/${ticket.id}/history`)).body;
        expect(history.filter((entry) => entry.action === "communication_received")).toHaveLength(1);
    });
    it("creates a ticket when no ticket id is supplied", async () => {
        const { agent, customerId } = await signedInAgent();
        const created = await agent.post("/api/communications").send(message(customerId));
        expect(created.status).toBe(201);
        const ticket = (await agent.get(`/api/tickets/${created.body.ticketId}`)).body;
        expect(ticket.ticketNumber).toBe("TKT-000001");
        expect((await agent.get(`/api/tickets/${created.body.ticketId}/history`)).body.map((entry) => entry.action)).toEqual(expect.arrayContaining(["created", "communication_received"]));
    });
    it("rejects unauthenticated access, invalid payloads, unknown ids, cross-customer tickets, and disabled channels", async () => {
        expect((await request(createApp(auth)).get("/api/communications")).status).toBe(401);
        expect((await request(createApp(auth)).post("/api/communications").send({})).status).toBe(401);
        const { agent, customerId } = await signedInAgent();
        expect((await agent.post("/api/communications").send({ customerId, channel: "carrier_pigeon", message: "hi" })).status).toBe(400);
        expect((await agent.post("/api/communications").send({ customerId, channel: "email", message: "" })).status).toBe(400);
        expect((await agent.post("/api/communications").send({ customerId: 999, channel: "email", message: "hi" })).status).toBe(404);
        expect((await agent.post("/api/communications").send(message(customerId, { ticketId: 999 }))).status).toBe(404);
        expect((await agent.get("/api/customers/abc/communications")).status).toBe(400);
        expect((await agent.get("/api/customers/999/communications")).status).toBe(404);
        await agent.patch("/api/communication-channels/email").send({ enabled: false });
        expect((await agent.post("/api/communications").send(message(customerId))).status).toBe(403);
    });
    it("rejects cross-customer ticket links without mutation", async () => {
        const first = await signedInAgent();
        const second = await signedInAgent();
        const ticket = (await second.agent.post("/api/tickets").send({ customerId: second.customerId, subject: "S", description: "D", category: "C", priority: "low", assignedAgent: "Unassigned", status: "new", dueDate: null })).body;
        const response = await first.agent.post("/api/communications").send(message(first.customerId, { ticketId: ticket.id }));
        expect(response.status).toBe(404);
        expect(first.agent.get(`/api/tickets/${ticket.id}/history`));
    });
});
