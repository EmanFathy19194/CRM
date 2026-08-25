import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/database.js";
import { CommunicationRepository } from "../src/communication-repository.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { TicketRepository } from "../src/ticket-repository.js";
describe("communication repository", () => {
    let database;
    let communications;
    let tickets;
    let customerId;
    beforeEach(() => {
        database = createDatabase(":memory:");
        const customers = new CustomerRepository(database);
        customerId = customers.createCustomer({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "" }).id;
        communications = new CommunicationRepository(database);
        tickets = new TicketRepository(database);
    });
    it("seeds the five default channels idempotently and persists enabled state", () => {
        const channels = communications.listChannels();
        expect(channels.map((channel) => channel.type)).toEqual(["email", "whatsapp", "live_chat", "sms", "web_form"]);
        expect(channels.every((channel) => channel.isEnabled)).toBe(true);
        const fresh = createDatabase(":memory:");
        expect(new CommunicationRepository(fresh).listChannels()).toHaveLength(5);
        communications.setEnabled("sms", false);
        expect(communications.channel("sms")?.isEnabled).toBe(false);
        expect(communications.channel("email")?.isEnabled).toBe(true);
    });
    it("creates communications with nullable ticket links and deterministic ordering", () => {
        const first = communications.create({ customerId, ticketId: null, channel: "email", message: "first" });
        expect(first.ticketId).toBeNull();
        const ticket = tickets.createTicket({ customerId, subject: "S", description: "D", category: "C", priority: "medium", assignedAgent: "Unassigned", status: "new", dueDate: null }, "tester");
        const linked = communications.create({ customerId, ticketId: ticket.id, channel: "web_form", message: "second" });
        expect(linked.ticketId).toBe(ticket.id);
        const rows = communications.list(customerId);
        expect(rows.map((row) => row.message)).toEqual(["second", "first"]);
        expect(communications.list(undefined, ticket.id)).toHaveLength(1);
        expect(communications.list(customerId, undefined, "email")).toHaveLength(1);
    });
});
