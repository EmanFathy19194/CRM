import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import { AuthService } from "../src/auth.js";
import { createApp } from "../src/server.js";
import { createDatabase } from "../src/database.js";
import { CustomerRepository } from "../src/customer-repository.js";
import { scheduleCustomerSearch } from "../public/pages/customers.js";
describe("login", () => {
    let auth;
    beforeEach(async () => {
        auth = new AuthService();
        await auth.seedUser("demo@example.com", "Password123!");
    });
    it("authenticates valid credentials and sets an HTTP-only cookie", async () => {
        const response = await request(createApp(auth)).post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe("demo@example.com");
        expect(response.body.user).not.toHaveProperty("passwordHash");
        expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    });
    it("returns the same error for an unknown user and wrong password", async () => {
        const wrongPassword = await request(createApp(auth)).post("/api/login").send({ email: "demo@example.com", password: "wrong" });
        const unknownUser = await request(createApp(auth)).post("/api/login").send({ email: "nobody@example.com", password: "wrong" });
        expect(wrongPassword.status).toBe(401);
        expect(unknownUser.status).toBe(401);
        expect(wrongPassword.body).toEqual(unknownUser.body);
    });
    it("rejects missing and malformed credentials", async () => {
        expect((await request(createApp(auth)).post("/api/login").send({})).status).toBe(400);
        expect((await request(createApp(auth)).post("/api/login").send({ email: "bad", password: "x" })).status).toBe(400);
    });
    it("redirects unauthenticated users from every protected page", async () => {
        for (const path of ["/dashboard", "/customers", "/contacts", "/opportunities", "/tasks", "/activities"]) {
            const response = await request(createApp(auth)).get(path);
            expect(response.status, path).toBe(302);
            expect(response.headers.location, path).toBe("/");
        }
    });
    it("rejects unauthenticated requests to every protected API", async () => {
        for (const path of ["/api/customers", "/api/contacts", "/api/opportunities", "/api/tasks", "/api/activities"]) {
            const response = await request(createApp(auth)).get(path);
            expect(response.status, path).toBe(401);
            expect(response.headers["content-type"], path).toContain("application/json");
        }
    });
    it("allows an authenticated session to access protected pages and APIs", async () => {
        const agent = request.agent(createApp(auth));
        const login = await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        expect(login.status).toBe(200);
        for (const path of ["/dashboard", "/customers", "/contacts", "/opportunities", "/tasks", "/activities"]) {
            expect((await agent.get(path)).status, path).toBe(200);
        }
        for (const path of ["/api/customers", "/api/contacts", "/api/opportunities", "/api/tasks", "/api/activities"]) {
            expect((await agent.get(path)).status, path).toBe(200);
        }
    });
    it("removes protected access after logout", async () => {
        const agent = request.agent(createApp(auth));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const logout = await agent.post("/api/logout");
        expect(logout.status).toBe(204);
        expect(logout.headers["set-cookie"][0]).toContain("crm_session=;");
        expect((await agent.get("/api/customers")).status).toBe(401);
        expect((await agent.get("/dashboard")).status).toBe(302);
    });
    it("prevents protected pages from being cached", async () => {
        const agent = request.agent(createApp(auth));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const response = await agent.get("/dashboard");
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
    });
    it("creates and lists customers for an authenticated session", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const created = await agent.post("/api/customers").send({ firstName: "Ada", lastName: "Lovelace", email: "Ada@Example.com", phone: "+1 555 123 4567", company: "Analytical Engines", jobTitle: "Founder", status: "active", address: "London", notes: "Pioneer" });
        expect(created.status).toBe(201);
        expect(created.body.email).toBe("ada@example.com");
        expect((await agent.get("/api/customers")).body.items).toHaveLength(1);
    });
    it("rejects invalid customer data without persisting it", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const response = await agent.post("/api/customers").send({ firstName: "", lastName: "User", email: "bad", status: "active" });
        expect(response.status).toBe(400);
        expect((await agent.get("/api/customers")).body.items).toHaveLength(0);
    });
    it("supports protected customer view, edit, and delete actions", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const created = await agent.post("/api/customers").send({ firstName: "Grace", lastName: "Hopper", email: "grace@example.com", phone: "555-000-0000", company: "Navy", jobTitle: "Admiral", status: "prospect", address: "Arlington", notes: "Compiler pioneer" });
        const id = created.body.id;
        expect((await agent.get(`/api/customers/${id}`)).body.firstName).toBe("Grace");
        const updated = await agent.patch(`/api/customers/${id}`).send({ ...created.body, firstName: "Rear Admiral Grace" });
        expect(updated.status).toBe(200);
        expect(updated.body.firstName).toBe("Rear Admiral Grace");
        expect((await agent.delete(`/api/customers/${id}`)).status).toBe(204);
        expect((await agent.get(`/api/customers/${id}`)).status).toBe(404);
    });
    it("protects customer detail page navigation", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const created = await agent.post("/api/customers").send({ firstName: "Katherine", lastName: "Johnson", email: "katherine@example.com", phone: "555-000-0000", company: "NASA", jobTitle: "Mathematician", status: "active", address: "Hampton", notes: "" });
        const id = created.body.id;
        expect((await request(createApp(auth, repository)).get(`/customers/${id}`)).status).toBe(302);
        expect((await agent.get(`/customers/${id}`)).headers["cache-control"]).toBe("no-store");
    });
    it("searches customers and paginates results", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const customers = [
            { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: "Analytical Engines" },
            { firstName: "Grace", lastName: "Hopper", email: "grace@example.com", company: "Navy" },
            { firstName: "Alan", lastName: "Turing", email: "alan@example.com", company: "Computing Lab" }
        ];
        for (const customer of customers)
            await agent.post("/api/customers").send({ ...customer, phone: "555-000-0000", jobTitle: "Engineer", status: "active", address: "", notes: "" });
        const secondPage = await agent.get("/api/customers?page=2&pageSize=2");
        expect(secondPage.status).toBe(200);
        expect(secondPage.body.total).toBe(3);
        expect(secondPage.body.totalPages).toBe(2);
        expect(secondPage.body.items).toHaveLength(1);
        const search = await agent.get("/api/customers?search=NAVY");
        expect(search.body.items).toHaveLength(1);
        expect(search.body.items[0].lastName).toBe("Hopper");
    });
    it("uses the latest customer search value when typing quickly", async () => {
        const calls = [];
        const timer = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
        scheduleCustomerSearch((value) => calls.push(value), "gr", 10, timer.setTimeout, timer.clearTimeout);
        scheduleCustomerSearch((value) => calls.push(value), "gra", 10, timer.setTimeout, timer.clearTimeout);
        scheduleCustomerSearch((value) => calls.push(value), "grac", 10, timer.setTimeout, timer.clearTimeout);
        await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
        expect(calls).toEqual(["grac"]);
    });
    it("manages customer-scoped notes, interactions, and attachments", async () => {
        const repository = new CustomerRepository(createDatabase(":memory:"));
        const agent = request.agent(createApp(auth, repository));
        await agent.post("/api/login").send({ email: "demo@example.com", password: "Password123!" });
        const created = await agent.post("/api/customers").send({ firstName: "Marie", lastName: "Curie", email: "marie@example.com", phone: "555-000-0000", company: "Laboratory", jobTitle: "Scientist", status: "active", address: "Paris", notes: "Profile" });
        const id = created.body.id;
        const note = await agent.post(`/api/customers/${id}/notes`).send({ content: "Follow up next week" });
        expect(note.status).toBe(201);
        expect((await agent.patch(`/api/customers/${id}/notes/${note.body.id}`).send({ content: "Follow up tomorrow" })).status).toBe(200);
        expect((await agent.get(`/api/customers/${id}/notes`)).body[0].content).toBe("Follow up tomorrow");
        const interaction = await agent.post(`/api/customers/${id}/interactions`).send({ type: "meeting", content: "Product review" });
        expect(interaction.status).toBe(201);
        expect((await agent.get(`/api/customers/${id}/interactions`)).body[0].type).toBe("meeting");
        expect((await agent.post(`/api/customers/${id}/interactions`).send({ type: "invalid", content: "No" })).status).toBe(400);
        const attachment = await agent.post(`/api/customers/${id}/attachments`).attach("file", Buffer.from("hello"), { filename: "brief.txt", contentType: "text/plain" });
        expect(attachment.status).toBe(201);
        expect(attachment.body).not.toHaveProperty("storageName");
        expect((await agent.get(`/api/customers/${id}/attachments`)).body[0].fileName).toBe("brief.txt");
        expect((await agent.get(`/api/customers/${id}/attachments/${attachment.body.id}`)).text).toBe("hello");
    });
});
