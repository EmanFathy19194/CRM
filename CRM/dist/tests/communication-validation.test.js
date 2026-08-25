import { describe, expect, it } from "vitest";
import { validateCommunication, validatePublicWebRequest } from "../src/communication-validation.js";
const base = { customerId: 1, channel: "email", message: "Hello" };
describe("communication validation", () => {
    it("accepts all five channel types", () => {
        for (const channel of ["email", "whatsapp", "live_chat", "sms", "web_form"]) {
            const result = validateCommunication({ ...base, channel });
            expect(Object.keys(result.errors)).toHaveLength(0);
            expect(result.value.channel).toBe(channel);
        }
    });
    it("rejects unknown channels and missing customer/message", () => {
        const result = validateCommunication({ customerId: "", channel: "pigeon", message: "   " });
        expect(result.errors.customerId).toBeDefined();
        expect(result.errors.channel).toBeDefined();
        expect(result.errors.message).toBeDefined();
    });
    it("enforces maximum message length", () => {
        const result = validateCommunication({ ...base, message: "x".repeat(2001) });
        expect(result.errors.message).toBe("Message must be 2000 characters or fewer.");
        expect(validateCommunication({ ...base, message: "x".repeat(2000) }).errors.message).toBeUndefined();
    });
    it("validates ticket ids and normalizes empty optionals to null", () => {
        expect(validateCommunication({ ...base, ticketId: "abc" }).errors.ticketId).toBeDefined();
        expect(validateCommunication({ ...base, ticketId: "0" }).errors.ticketId).toBeDefined();
        const clean = validateCommunication({ ...base, ticketId: "", sourceReference: "  " });
        expect(clean.value.ticketId).toBeNull();
        expect(clean.value.sourceReference).toBeNull();
        expect(validateCommunication({ ...base, ticketId: "7" }).value.ticketId).toBe(7);
    });
    it("bounds source reference length", () => {
        expect(validateCommunication({ ...base, sourceReference: "x".repeat(201) }).errors.sourceReference).toBeDefined();
        expect(validateCommunication({ ...base, sourceReference: "x".repeat(200) }).errors.sourceReference).toBeUndefined();
    });
});
describe("public web request validation", () => {
    const valid = { email: "Ada@Example.com ", subject: "Help", message: "Please help me" };
    it("normalizes email and optional fields", () => {
        const result = validatePublicWebRequest(valid);
        expect(result.value.email).toBe("ada@example.com");
        expect(result.value.category).toBeNull();
        expect(result.value.dueDate).toBeNull();
        expect(Object.keys(result.errors)).toHaveLength(0);
    });
    it("rejects invalid emails, subjects, and messages", () => {
        expect(validatePublicWebRequest({ ...valid, email: "not-an-email" }).errors.email).toBeDefined();
        expect(validatePublicWebRequest({ ...valid, subject: "" }).errors.subject).toBeDefined();
        expect(validatePublicWebRequest({ ...valid, message: "" }).errors.message).toBeDefined();
        expect(validatePublicWebRequest({ ...valid, message: "x".repeat(2001) }).errors.message).toBeDefined();
    });
    it("validates due date format and category bounds", () => {
        expect(validatePublicWebRequest({ ...valid, dueDate: "2026-13-40" }).errors.dueDate).toBeDefined();
        expect(validatePublicWebRequest({ ...valid, dueDate: "2026-09-01" }).errors.dueDate).toBeUndefined();
        expect(validatePublicWebRequest({ ...valid, category: "x".repeat(101) }).errors.category).toBeDefined();
    });
});
