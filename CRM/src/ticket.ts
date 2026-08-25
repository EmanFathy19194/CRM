export const ticketStatuses = ["new", "open", "in_progress", "pending", "resolved", "closed"] as const;
export type TicketStatus = (typeof ticketStatuses)[number];
export const ticketPriorities = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof ticketPriorities)[number];
export const ticketHistoryActions = ["created", "updated", "status_changed", "priority_changed", "assignment_changed", "escalated", "communication_received"] as const;
export type TicketHistoryAction = (typeof ticketHistoryActions)[number];

export type CreateTicketInput = {
  customerId: number;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  assignedAgent: string;
  status: TicketStatus;
  dueDate: string | null;
};

export type SupportTicket = CreateTicketInput & {
  id: number;
  ticketNumber: string;
  isEscalated: boolean;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerEmail: string;
};

export type TicketHistoryEntry = {
  id: number;
  ticketId: number;
  action: TicketHistoryAction;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  createdAt: string;
};
