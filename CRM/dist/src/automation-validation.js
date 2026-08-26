import { automationActions } from "./automation.js";
import { ticketPriorities } from "./ticket.js";
const text = (value) => typeof value === "string" ? value.trim() : "";
const positive = (value) => typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 0;
function condition(input) { const priority = text(input.priority), category = text(input.category); return { priority: priority ? priority : null, category: category || null }; }
export function validateSlaRule(input) { const base = condition(input), value = { ...base, responseTargetMinutes: positive(input.responseTargetMinutes), resolutionTargetMinutes: positive(input.resolutionTargetMinutes) }, errors = {}; if (value.priority && !ticketPriorities.includes(value.priority))
    errors.priority = "Choose a valid priority."; if (value.category && value.category.length > 100)
    errors.category = "Category must be 100 characters or fewer."; if (!Number.isInteger(value.responseTargetMinutes) || value.responseTargetMinutes < 1)
    errors.responseTargetMinutes = "Enter a positive response target in minutes."; if (!Number.isInteger(value.resolutionTargetMinutes) || value.resolutionTargetMinutes < 1)
    errors.resolutionTargetMinutes = "Enter a positive resolution target in minutes."; return { value, errors }; }
export function validateAutomationRule(input) { const base = condition(input), action = text(input.action), recipient = text(input.assignedAgent).toLowerCase(), value = { ...base, action, assignedAgent: recipient || null }, errors = {}; if (value.priority && !ticketPriorities.includes(value.priority))
    errors.priority = "Choose a valid priority."; if (value.category && value.category.length > 100)
    errors.category = "Category must be 100 characters or fewer."; if (!automationActions.includes(action))
    errors.action = "Choose a valid automation action."; if (action === "assign" && (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)))
    errors.assignedAgent = "Enter an assignment email."; if (action === "escalate" && recipient)
    errors.assignedAgent = "Escalation rules cannot have an assigned agent."; return { value, errors }; }
