import { articleStatuses, articleTypes } from "./knowledge-base.js";
const text = (value) => typeof value === "string" ? value.trim() : "";
export function validateKnowledgeArticle(input) { const value = { type: text(input.type), category: text(input.category), title: text(input.title), summary: text(input.summary), body: text(input.body), status: text(input.status) }; const errors = {}; if (!articleTypes.includes(value.type))
    errors.type = "Choose a valid article type."; if (!articleStatuses.includes(value.status))
    errors.status = "Choose a valid status."; for (const [key, label, max] of [["category", "Category", 100], ["title", "Title", 200], ["summary", "Summary", 500], ["body", "Body", 10000]]) {
    const v = value[key];
    if (!v)
        errors[key] = `${label} is required.`;
    else if (v.length > max)
        errors[key] = `${label} must be ${max} characters or fewer.`;
} return { value, errors }; }
export function validatePortalAccess(input) { const email = text(input.email).toLowerCase(), ticketNumber = text(input.ticketNumber).toUpperCase(), errors = {}; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
    errors.email = "Enter a valid email address."; if (!/^TKT-\d{6,}$/.test(ticketNumber))
    errors.ticketNumber = "Enter a valid support reference."; return { value: { email, ticketNumber }, errors }; }
export function validateTicketFeedback(input) { const rating = Number(input.rating), message = text(input.message), errors = {}; if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    errors.rating = "Choose a rating from 1 to 5."; if (!message)
    errors.message = "Feedback is required.";
else if (message.length > 2000)
    errors.message = "Feedback must be 2000 characters or fewer."; return { value: { rating, message }, errors }; }
