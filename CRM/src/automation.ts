import type { TicketPriority } from "./ticket.js";

export const automationActions = ["assign", "escalate"] as const;
export type AutomationAction = (typeof automationActions)[number];
export type SlaRule = { id:number; priority:TicketPriority|null; category:string|null; responseTargetMinutes:number; resolutionTargetMinutes:number; createdAt:string; updatedAt:string };
export type AutomationRule = { id:number; priority:TicketPriority|null; category:string|null; action:AutomationAction; assignedAgent:string|null; createdAt:string; updatedAt:string };
export type AgentNotification = { id:number; recipientEmail:string; ticketId:number; kind:string; message:string; dismissedAt:string|null; createdAt:string };
export type SlaRuleInput = { priority:TicketPriority|null; category:string|null; responseTargetMinutes:number; resolutionTargetMinutes:number };
export type AutomationRuleInput = { priority:TicketPriority|null; category:string|null; action:AutomationAction; assignedAgent:string|null };
