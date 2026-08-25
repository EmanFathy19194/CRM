import { communicationChannelTypes } from "./communication.js";
import { parsePositiveInteger } from "./ticket-validation.js";
function text(input) { return typeof input === "string" ? input.trim() : ""; }
export function validateCommunication(input) {
    const value = {
        customerId: parsePositiveInteger(input.customerId) ?? 0,
        ticketId: input.ticketId === undefined || input.ticketId === null || input.ticketId === "" ? null : parsePositiveInteger(input.ticketId) ?? -1,
        channel: text(input.channel),
        message: text(input.message),
        sourceReference: text(input.sourceReference) || null
    };
    const errors = {};
    if (!value.customerId)
        errors.customerId = "Choose a customer.";
    else if (value.customerId < 0)
        errors.customerId = "Choose a valid customer.";
    if (value.ticketId !== null && value.ticketId < 0)
        errors.ticketId = "Enter a valid ticket id.";
    if (!communicationChannelTypes.includes(value.channel))
        errors.channel = "Choose a valid channel.";
    if (!value.message)
        errors.message = "Message is required.";
    else if (value.message.length > 2000)
        errors.message = "Message must be 2000 characters or fewer.";
    if (value.sourceReference && value.sourceReference.length > 200)
        errors.sourceReference = "Source reference must be 200 characters or fewer.";
    return { value, errors };
}
export function validatePublicWebRequest(input) {
    const email = text(input.email).toLowerCase();
    const subject = text(input.subject);
    const message = text(input.message);
    const categoryText = text(input.category);
    const dueDateText = text(input.dueDate);
    const value = {
        email,
        subject,
        category: categoryText || null,
        dueDate: dueDateText || null,
        message
    };
    const errors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
        errors.email = "Enter a valid email address.";
    if (!subject)
        errors.subject = "Subject is required.";
    else if (subject.length > 200)
        errors.subject = "Subject must be 200 characters or fewer.";
    if (!message)
        errors.message = "Message is required.";
    else if (message.length > 2000)
        errors.message = "Message must be 2000 characters or fewer.";
    if (value.category && value.category.length > 100)
        errors.category = "Category must be 100 characters or fewer.";
    if (value.dueDate) {
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value.dueDate) ? new Date(`${value.dueDate}T00:00:00.000Z`) : null;
        if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.dueDate)
            errors.dueDate = "Enter a valid due date.";
    }
    return { value, errors };
}
