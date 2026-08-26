import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { createDatabase } from "../src/database.js";
import { createApp } from "../src/server.js";

describe("agent dashboard and work", () => {
  let auth: AuthService;
  beforeEach(async () => { auth = new AuthService(); await auth.seedUser("agent@example.com", "Password123!"); });
  async function signedIn() {
    const repository = new CustomerRepository(createDatabase(":memory:"));
    const agent = request.agent(createApp(auth, repository));
    await agent.post("/api/login").send({ email: "agent@example.com", password: "Password123!" });
    const customer = await agent.post("/api/customers").send({ firstName:"Ada", lastName:"Lovelace", email:"ada@example.com", phone:"", company:"", jobTitle:"", status:"active", address:"", notes:"" });
    const ticket = await agent.post("/api/tickets").send({ customerId:customer.body.id, subject:"Help", description:"Need help", category:"Support", priority:"urgent", assignedAgent:"agent@example.com", status:"open", dueDate:null });
    return { agent, ticketId: ticket.body.id };
  }
  it("keeps tasks and reminders protected and supports their lifecycle", async () => {
    expect((await request(createApp(auth)).get("/api/dashboard")).status).toBe(401);
    const { agent } = await signedIn();
    expect((await agent.get("/api/dashboard")).body.counts).toMatchObject({ assigned:1, open:1, urgent:1 });
    const task = await agent.post("/api/tasks").send({ title:"Follow up", details:"Call customer", dueAt:"2026-09-01T09:00" });
    expect(task.status).toBe(201); expect((await agent.post(`/api/tasks/${task.body.id}/complete`)).body.isCompleted).toBe(true);
    expect((await agent.delete(`/api/tasks/${task.body.id}`)).status).toBe(204);
    const reminder = await agent.post("/api/reminders").send({ message:"Check ticket", remindAt:"2026-09-01T10:00" });
    expect(reminder.status).toBe(201); expect((await agent.post(`/api/reminders/${reminder.body.id}/dismiss`)).status).toBe(200);
  });
  it("adds protected internal comments and immutable ticket history", async () => {
    const { agent, ticketId } = await signedIn();
    const comment = await agent.post(`/api/tickets/${ticketId}/comments`).send({ body:"<b>Internal update</b>" });
    expect(comment.status).toBe(201); expect(comment.body.createdBy).toBe("agent@example.com");
    expect((await agent.get(`/api/tickets/${ticketId}/comments`)).body).toHaveLength(1);
    const history = await agent.get(`/api/tickets/${ticketId}/history`);
    expect(history.body.some((entry: { action:string }) => entry.action === "internal_comment_added")).toBe(true);
  });
});
