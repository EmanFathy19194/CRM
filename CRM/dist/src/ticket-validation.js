import { ticketPriorities, ticketStatuses } from "./ticket.js";
export function parsePositiveInteger(input) {
    const value = typeof input === "number" ? input : typeof input === "string" && /^\d+$/.test(input) ? Number(input) : NaN;
    return Number.isInteger(value) && value > 0 ? value : undefined;
}
function text(input) { return typeof input === "string" ? input.trim() : ""; }
export function validateTicket(input) {
    const dueDateInput = text(input.dueDate);
    const value = {
        customerId: parsePositiveInteger(input.customerId) ?? 0,
        subject: text(input.subject), description: text(input.description), category: text(input.category),
        priority: text(input.priority), assignedAgent: text(input.assignedAgent),
        status: text(input.status), dueDate: dueDateInput || null
    };
    const errors = {};
    if (!value.customerId)
        errors.customerId = "Choose a customer.";
    for (const [field, label, limit] of [["subject", "Subject", 200], ["description", "Description", 2000], ["category", "Category", 100], ["assignedAgent", "Assigned agent", 200]]) {
        const fieldValue = value[field];
        if (!fieldValue)
            errors[field] = `${label} is required.`;
        else if (fieldValue.length > limit)
            errors[field] = `${label} must be ${limit} characters or fewer.`;
    }
    if (!ticketPriorities.includes(value.priority))
        errors.priority = "Choose a valid priority.";
    if (!ticketStatuses.includes(value.status))
        errors.status = "Choose a valid status.";
    if (value.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate) || Number.isNaN(Date.parse(`${value.dueDate}T00:00:00.000Z`))))
        errors.dueDate = "Enter a valid due date.";
    return { value, errors };
}
