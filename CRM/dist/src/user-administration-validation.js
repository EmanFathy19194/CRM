import { staffRoles } from "./user-administration.js";
import { ticketPriorities } from "./ticket.js";
const text = (value) => typeof value === "string" ? value.trim() : "";
const email = (value) => text(value).toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function validateStaffUser(input, editing = false) {
    const password = text(input.password);
    const value = (editing ? { name: text(input.name), email: email(input.email), role: text(input.role), password: password || null } : { name: text(input.name), email: email(input.email), role: text(input.role), password });
    const errors = {};
    if (!value.name || value.name.length > 100)
        errors.name = "Enter a name of 100 characters or fewer.";
    if (!validEmail(value.email) || value.email.length > 320)
        errors.email = "Enter a valid email address.";
    if (!staffRoles.includes(value.role))
        errors.role = "Choose a valid staff role.";
    if (!editing && (password.length < 8))
        errors.password = "Password must be at least 8 characters.";
    if (editing && password && password.length < 8)
        errors.password = "Password must be at least 8 characters.";
    return { value, errors };
}
export function validateSettings(input) { const value = { organizationName: text(input.organizationName), supportEmail: email(input.supportEmail), defaultTicketPriority: text(input.defaultTicketPriority) }; const errors = {}; if (!value.organizationName || value.organizationName.length > 120)
    errors.organizationName = "Enter an organization name of 120 characters or fewer."; if (!validEmail(value.supportEmail))
    errors.supportEmail = "Enter a valid support email."; if (!ticketPriorities.includes(value.defaultTicketPriority))
    errors.defaultTicketPriority = "Choose a valid default priority."; return { value, errors }; }
export function validateReportRange(input) { const from = text(input.from) || null, to = text(input.to) || null, errors = {}; for (const [name, value] of [["from", from], ["to", to]])
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())))
        errors[name] = "Enter a valid date."; if (from && to && from > to)
    errors.to = "End date must not be before start date."; return { value: { from, to }, errors }; }
