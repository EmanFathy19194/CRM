export type AgentTask = { id: number; title: string; details: string | null; dueAt: string | null; isCompleted: boolean; completedAt: string | null; createdAt: string; updatedAt: string };
export type AgentReminder = { id: number; message: string; remindAt: string; isDismissed: boolean; createdAt: string };
export type InternalTicketComment = { id: number; ticketId: number; body: string; createdBy: string; createdAt: string };
export type AgentActivity = { id: number; kind: "task_created" | "task_completed" | "reminder_created" | "comment_added"; detail: string; ticketId: number | null; createdAt: string };
export type CreateTaskInput = { title: string; details: string | null; dueAt: string | null };
export type CreateReminderInput = { message: string; remindAt: string };
