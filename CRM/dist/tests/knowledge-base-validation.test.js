import { describe, expect, it } from "vitest";
import { validateKnowledgeArticle, validatePortalAccess, validateTicketFeedback } from "../src/knowledge-base-validation.js";
describe("knowledge base validation", () => {
    describe("validateKnowledgeArticle", () => {
        it("accepts valid article input", () => {
            const result = validateKnowledgeArticle({ type: "faq", category: "Billing", title: "How to pay", summary: "Pay online.", body: "Visit the portal.", status: "published" });
            expect(result.value.type).toBe("faq");
            expect(result.value.category).toBe("Billing");
            expect(result.value.title).toBe("How to pay");
            expect(result.value.status).toBe("published");
            expect(Object.keys(result.errors)).toHaveLength(0);
        });
        it("normalizes and validates every article type", () => {
            for (const type of ["faq", "help", "solution", "guide"]) {
                const result = validateKnowledgeArticle({ type, category: "General", title: "Title", summary: "Summary", body: "Body" });
                expect(result.value.type).toBe(type);
                expect(result.errors.type).toBeUndefined();
            }
        });
        it("rejects unknown article types and statuses", () => {
            const result = validateKnowledgeArticle({ type: "invalid", category: "General", title: "Title", summary: "Summary", body: "Body" });
            expect(result.errors.type).toBeDefined();
            expect(result.errors.status).toBeDefined();
        });
        it("rejects missing or oversize fields", () => {
            const result = validateKnowledgeArticle({ type: "faq", category: "", title: "", summary: "", body: "" });
            expect(result.errors.category).toBeDefined();
            expect(result.errors.title).toBeDefined();
            expect(result.errors.summary).toBeDefined();
            expect(result.errors.body).toBeDefined();
            const long = validateKnowledgeArticle({ type: "faq", category: "x".repeat(101), title: "x".repeat(201), summary: "x".repeat(501), body: "x".repeat(10001) });
            expect(long.errors.category).toBeDefined();
            expect(long.errors.title).toBeDefined();
            expect(long.errors.summary).toBeDefined();
            expect(long.errors.body).toBeDefined();
        });
    });
    describe("validatePortalAccess", () => {
        it("accepts normalized email and ticket number", () => {
            const result = validatePortalAccess({ email: "Ada@Example.com ", ticketNumber: "tkt-123456" });
            expect(result.value.email).toBe("ada@example.com");
            expect(result.value.ticketNumber).toBe("TKT-123456");
            expect(Object.keys(result.errors)).toHaveLength(0);
        });
        it("rejects invalid emails and malformed ticket numbers", () => {
            expect(validatePortalAccess({ email: "bad", ticketNumber: "123" }).errors.email).toBeDefined();
            expect(validatePortalAccess({ email: "bad", ticketNumber: "123" }).errors.ticketNumber).toBeDefined();
            expect(validatePortalAccess({ email: "ada@example.com", ticketNumber: "TKT-12345" }).errors.ticketNumber).toBeDefined();
            expect(validatePortalAccess({ email: "ada@example.com", ticketNumber: "not-a-tkt" }).errors.ticketNumber).toBeDefined();
        });
    });
    describe("validateTicketFeedback", () => {
        it("accepts valid feedback", () => {
            const result = validateTicketFeedback({ rating: 3, message: "Good help" });
            expect(result.value.rating).toBe(3);
            expect(result.value.message).toBe("Good help");
            expect(Object.keys(result.errors)).toHaveLength(0);
        });
        it("rejects invalid ratings and empty or oversize messages", () => {
            expect(validateTicketFeedback({ rating: 0, message: "Hi" }).errors.rating).toBeDefined();
            expect(validateTicketFeedback({ rating: 6, message: "Hi" }).errors.rating).toBeDefined();
            expect(validateTicketFeedback({ rating: 3, message: "" }).errors.message).toBeDefined();
            expect(validateTicketFeedback({ rating: 3, message: "x".repeat(2001) }).errors.message).toBeDefined();
        });
    });
});
