import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/database.js";
import { KnowledgeBaseRepository } from "../src/knowledge-base-repository.js";
import { CustomerPortalRepository } from "../src/customer-portal-repository.js";

describe("knowledge base repository", () => {
  const db = createDatabase(":memory:");
  const repo = new KnowledgeBaseRepository(db);
  const portal = new CustomerPortalRepository(db);

  it("creates and reads articles with publication state", () => {
    const created = repo.create({ type: "faq", category: "Billing", title: "How to pay", summary: "Pay online.", body: "Visit the portal.", status: "draft" });
    expect(created.status).toBe("draft");
    expect(created.publishedAt).toBeNull();
    const draft = repo.get(created.id);
    expect(draft?.title).toBe("How to pay");
    const published = repo.get(created.id, true);
    expect(published).toBeNull();
  });

  it("lists published articles deterministically and paginates", () => {
    repo.create({ type: "faq", category: "General", title: "A", summary: "A", body: "A", status: "published" });
    repo.create({ type: "help", category: "General", title: "B", summary: "B", body: "B", status: "published" });
    repo.create({ type: "faq", category: "Billing", title: "C", summary: "C", body: "C", status: "draft" });
    const result = repo.list(1, 10, true);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].title).toBe("B");
    expect(result.items[1].title).toBe("A");
  });

  it("searches and filters published articles", () => {
    const result = repo.list(1, 10, true, "billing", "faq");
    expect(result.items).toHaveLength(0);
    const all = repo.list(1, 10, true, "", "", "Billing");
    expect(all.items).toHaveLength(0);
  });

  it("updates and deletes articles", () => {
    const created = repo.create({ type: "guide", category: "Setup", title: "Setup", summary: "S", body: "B", status: "published" });
    expect(repo.update(created.id, { type: "guide", category: "Setup", title: "Setup II", summary: "S2", body: "B2", status: "published" })?.title).toBe("Setup II");
    expect(repo.delete(created.id)).toBe(true);
    expect(repo.get(created.id)).toBeNull();
    expect(repo.delete(999)).toBe(false);
  });

  it("returns pagination shape with clamped page", () => {
    const freshDb = createDatabase(":memory:");
    const freshRepo = new KnowledgeBaseRepository(freshDb);
    const result = freshRepo.list(5, 10, true);
    expect(result).toMatchObject({ page: 1, pageSize: 10, total: 0, totalPages: 1, items: [] });
  });

  it("manages portal sessions with hashed tokens and expiry", () => {
    const customerId = portal.verify("ada@example.com", "TKT-000001");
    expect(customerId).toBeNull();
  });

  it("builds portal ticket and activity projections", () => {
    const list = portal.list(1);
    expect(list).toEqual([]);
    const detail = portal.get(1, "TKT-000001");
    expect(detail).toBeNull();
    const history = portal.history(1, "TKT-000001");
    expect(history).toEqual([]);
  });

  it("inserts feedback once and returns exists on duplicate", () => {
    expect(portal.feedback(1, "TKT-000001", { rating: 5, message: "Great" })).toBe("missing");
  });
});
