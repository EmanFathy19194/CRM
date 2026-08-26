const task = (r) => ({ id: Number(r.id), title: String(r.title), details: r.details === null ? null : String(r.details), dueAt: r.due_at === null ? null : String(r.due_at), isCompleted: Boolean(Number(r.is_completed)), completedAt: r.completed_at === null ? null : String(r.completed_at), createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
const reminder = (r) => ({ id: Number(r.id), message: String(r.message), remindAt: String(r.remind_at), isDismissed: Boolean(Number(r.is_dismissed)), createdAt: String(r.created_at) });
const comment = (r) => ({ id: Number(r.id), ticketId: Number(r.ticket_id), body: String(r.body), createdBy: String(r.created_by), createdAt: String(r.created_at) });
const activity = (r) => ({ id: Number(r.id), kind: String(r.kind), detail: String(r.detail), ticketId: r.ticket_id === null ? null : Number(r.ticket_id), createdAt: String(r.created_at) });
export class AgentWorkRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    addActivity(owner, kind, detail, ticketId = null) { this.database.prepare("INSERT INTO agent_activity (owner_email, kind, detail, ticket_id, created_at) VALUES (?, ?, ?, ?, ?)").run(owner, kind, detail, ticketId, new Date().toISOString()); }
    listTasks(owner) { return this.database.prepare("SELECT * FROM agent_tasks WHERE owner_email = ? ORDER BY is_completed, due_at IS NULL, due_at, created_at DESC, id DESC").all(owner).map(task); }
    getTask(owner, id) { const r = this.database.prepare("SELECT * FROM agent_tasks WHERE owner_email = ? AND id = ?").get(owner, id); return r ? task(r) : null; }
    createTask(owner, input) { const now = new Date().toISOString(), r = this.database.prepare("INSERT INTO agent_tasks (owner_email,title,details,due_at,is_completed,completed_at,created_at,updated_at) VALUES (?, ?, ?, ?, 0, NULL, ?, ?)").run(owner, input.title, input.details, input.dueAt, now, now); this.addActivity(owner, "task_created", input.title); return this.getTask(owner, Number(r.lastInsertRowid)); }
    updateTask(owner, id, input) { const now = new Date().toISOString(), r = this.database.prepare("UPDATE agent_tasks SET title=?, details=?, due_at=?, updated_at=? WHERE owner_email=? AND id=?").run(input.title, input.details, input.dueAt, now, owner, id); return Number(r.changes) ? this.getTask(owner, id) : null; }
    completeTask(owner, id) { const existing = this.getTask(owner, id); if (!existing)
        return null; if (existing.isCompleted)
        return existing; const now = new Date().toISOString(); this.database.prepare("UPDATE agent_tasks SET is_completed=1, completed_at=?, updated_at=? WHERE owner_email=? AND id=?").run(now, now, owner, id); this.addActivity(owner, "task_completed", existing.title); return this.getTask(owner, id); }
    deleteTask(owner, id) { return Boolean(Number(this.database.prepare("DELETE FROM agent_tasks WHERE owner_email=? AND id=?").run(owner, id).changes)); }
    listReminders(owner, includeDismissed = false) { return this.database.prepare(`SELECT * FROM agent_reminders WHERE owner_email = ?${includeDismissed ? "" : " AND is_dismissed = 0"} ORDER BY remind_at, id`).all(owner).map(reminder); }
    getReminder(owner, id) { const r = this.database.prepare("SELECT * FROM agent_reminders WHERE owner_email=? AND id=?").get(owner, id); return r ? reminder(r) : null; }
    createReminder(owner, input) { const now = new Date().toISOString(), r = this.database.prepare("INSERT INTO agent_reminders (owner_email,message,remind_at,is_dismissed,created_at) VALUES (?, ?, ?, 0, ?)").run(owner, input.message, input.remindAt, now); this.addActivity(owner, "reminder_created", input.message); return this.getReminder(owner, Number(r.lastInsertRowid)); }
    dismissReminder(owner, id) { const existing = this.getReminder(owner, id); if (!existing || existing.isDismissed)
        return existing; this.database.prepare("UPDATE agent_reminders SET is_dismissed=1 WHERE owner_email=? AND id=?").run(owner, id); return this.getReminder(owner, id); }
    deleteReminder(owner, id) { return Boolean(Number(this.database.prepare("DELETE FROM agent_reminders WHERE owner_email=? AND id=?").run(owner, id).changes)); }
    createComment(ticketId, body, owner) { const now = new Date().toISOString(), r = this.database.prepare("INSERT INTO ticket_internal_comments (ticket_id,body,created_by,created_at) VALUES (?, ?, ?, ?)").run(ticketId, body, owner, now); this.addActivity(owner, "comment_added", body.slice(0, 200), ticketId); return this.getComment(Number(r.lastInsertRowid)); }
    getComment(id) { const r = this.database.prepare("SELECT * FROM ticket_internal_comments WHERE id=?").get(id); return r ? comment(r) : null; }
    listComments(ticketId) { return this.database.prepare("SELECT * FROM ticket_internal_comments WHERE ticket_id=? ORDER BY created_at DESC,id DESC").all(ticketId).map(comment); }
    listActivity(owner) { return this.database.prepare("SELECT * FROM agent_activity WHERE owner_email=? ORDER BY created_at DESC,id DESC LIMIT 20").all(owner).map(activity); }
}
