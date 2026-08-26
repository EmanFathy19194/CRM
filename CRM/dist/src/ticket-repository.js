function mapTicket(row) {
    return { id: Number(row.id), ticketNumber: String(row.ticket_number), customerId: Number(row.customer_id), subject: String(row.subject), description: String(row.description), category: String(row.category), priority: String(row.priority), assignedAgent: String(row.assigned_agent), status: String(row.status), dueDate: row.due_date === null ? null : String(row.due_date), isEscalated: Boolean(Number(row.is_escalated)), createdAt: String(row.created_at), updatedAt: String(row.updated_at), customerName: String(row.customer_name), customerEmail: String(row.customer_email), slaRuleId: row.sla_rule_id === null ? null : Number(row.sla_rule_id), responseTargetMinutes: row.response_target_minutes === null ? null : Number(row.response_target_minutes), responseDueAt: row.response_due_at === null ? null : String(row.response_due_at), responseRespondedAt: row.response_responded_at === null ? null : String(row.response_responded_at), resolutionTargetMinutes: row.resolution_target_minutes === null ? null : Number(row.resolution_target_minutes), resolutionDueAt: row.resolution_due_at === null ? null : String(row.resolution_due_at) };
}
function mapHistory(row) {
    return { id: Number(row.id), ticketId: Number(row.ticket_id), action: String(row.action), oldValue: row.old_value === null ? null : String(row.old_value), newValue: row.new_value === null ? null : String(row.new_value), changedBy: String(row.changed_by), createdAt: String(row.created_at) };
}
export class TicketRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    select = `SELECT t.*, c.first_name || ' ' || c.last_name AS customer_name, c.email AS customer_email FROM support_tickets t JOIN customers c ON c.id = t.customer_id`;
    history(ticketId, action, oldValue, newValue, changedBy, now) { this.database.prepare("INSERT INTO ticket_history (ticket_id, action, old_value, new_value, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(ticketId, action, oldValue, newValue, changedBy, now); }
    createTicket(input, changedBy) {
        const now = new Date().toISOString();
        this.database.exec("SAVEPOINT create_ticket");
        try {
            const result = this.database.prepare("INSERT INTO support_tickets (ticket_number, customer_id, subject, description, category, priority, assigned_agent, status, due_date, is_escalated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)").run("", input.customerId, input.subject, input.description, input.category, input.priority, input.assignedAgent, input.status, input.dueDate, now, now);
            const id = Number(result.lastInsertRowid);
            const ticketNumber = `TKT-${String(id).padStart(6, "0")}`;
            this.database.prepare("UPDATE support_tickets SET ticket_number = ? WHERE id = ?").run(ticketNumber, id);
            this.history(id, "created", null, ticketNumber, changedBy, now);
            this.database.exec("RELEASE SAVEPOINT create_ticket");
            return this.getTicket(id);
        }
        catch (error) {
            this.database.exec("ROLLBACK TO SAVEPOINT create_ticket");
            this.database.exec("RELEASE SAVEPOINT create_ticket");
            throw error;
        }
    }
    listTickets(page = 1, pageSize = 10, filters = {}) {
        const safePage = Math.max(1, Math.floor(page)), safeSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
        const conditions = [], params = [];
        if (filters.status) {
            conditions.push("t.status = ?");
            params.push(filters.status);
        }
        if (filters.priority) {
            conditions.push("t.priority = ?");
            params.push(filters.priority);
        }
        if (filters.assignedAgent) {
            conditions.push("lower(t.assigned_agent) LIKE ?");
            params.push(`%${filters.assignedAgent.trim().toLowerCase()}%`);
        }
        if (filters.customerId) {
            conditions.push("t.customer_id = ?");
            params.push(filters.customerId);
        }
        const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
        const total = Number(this.database.prepare(`SELECT COUNT(*) AS count FROM support_tickets t${where}`).get(...params).count), totalPages = Math.max(1, Math.ceil(total / safeSize)), currentPage = Math.min(safePage, totalPages);
        const rows = this.database.prepare(`${this.select}${where} ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?`).all(...params, safeSize, (currentPage - 1) * safeSize);
        return { items: rows.map(mapTicket), page: currentPage, pageSize: safeSize, total, totalPages };
    }
    getTicket(id) { const row = this.database.prepare(`${this.select} WHERE t.id = ?`).get(id); return row ? mapTicket(row) : null; }
    updateTicket(id, input, changedBy) {
        const existing = this.getTicket(id);
        if (!existing)
            return null;
        const now = new Date().toISOString();
        this.database.exec("BEGIN");
        try {
            this.database.prepare("UPDATE support_tickets SET customer_id = ?, subject = ?, description = ?, category = ?, priority = ?, assigned_agent = ?, status = ?, due_date = ?, updated_at = ? WHERE id = ?").run(input.customerId, input.subject, input.description, input.category, input.priority, input.assignedAgent, input.status, input.dueDate, now, id);
            const comparisons = [["status", "status_changed"], ["priority", "priority_changed"], ["assignedAgent", "assignment_changed"]];
            for (const [key, action] of comparisons)
                if (existing[key] !== input[key])
                    this.history(id, action, String(existing[key]), String(input[key]), changedBy, now);
            if (existing.subject !== input.subject || existing.description !== input.description || existing.category !== input.category || existing.customerId !== input.customerId || existing.dueDate !== input.dueDate)
                this.history(id, "updated", null, null, changedBy, now);
            this.database.exec("COMMIT");
            return this.getTicket(id);
        }
        catch (error) {
            this.database.exec("ROLLBACK");
            throw error;
        }
    }
    escalateTicket(id, changedBy) {
        const ticket = this.getTicket(id);
        if (!ticket)
            return null;
        if (ticket.isEscalated)
            return ticket;
        const now = new Date().toISOString();
        this.database.exec("SAVEPOINT escalate_ticket");
        try {
            this.database.prepare("UPDATE support_tickets SET is_escalated = 1, updated_at = ? WHERE id = ?").run(now, id);
            this.history(id, "escalated", "false", "true", changedBy, now);
            this.database.exec("RELEASE SAVEPOINT escalate_ticket");
            return this.getTicket(id);
        }
        catch (error) {
            this.database.exec("ROLLBACK TO SAVEPOINT escalate_ticket");
            this.database.exec("RELEASE SAVEPOINT escalate_ticket");
            throw error;
        }
    }
    addCommunicationHistory(ticketId, communicationId, changedBy) {
        this.history(ticketId, "communication_received", null, String(communicationId), changedBy, new Date().toISOString());
    }
    addInternalCommentHistory(ticketId, commentId, changedBy) { this.history(ticketId, "internal_comment_added", null, String(commentId), changedBy, new Date().toISOString()); }
    addAutomationHistory(ticketId, action, oldValue, newValue, changedBy, now = new Date().toISOString()) { this.history(ticketId, action, oldValue, newValue, changedBy, now); }
    assignAutomatically(ticketId, assignedAgent, changedBy, now = new Date().toISOString()) {
        const ticket = this.getTicket(ticketId);
        if (!ticket || ticket.assignedAgent.trim().toLowerCase() === assignedAgent.trim().toLowerCase())
            return ticket;
        this.database.prepare("UPDATE support_tickets SET assigned_agent=?, updated_at=? WHERE id=?").run(assignedAgent, now, ticketId);
        this.history(ticketId, "automatically_assigned", ticket.assignedAgent, assignedAgent, changedBy, now);
        return this.getTicket(ticketId);
    }
    applySla(ticketId, ruleId, responseMinutes, responseDueAt, resolutionMinutes, resolutionDueAt) { this.database.prepare("UPDATE support_tickets SET sla_rule_id=?, response_target_minutes=?, response_due_at=?, resolution_target_minutes=?, resolution_due_at=? WHERE id=? AND sla_rule_id IS NULL").run(ruleId, responseMinutes, responseDueAt, resolutionMinutes, resolutionDueAt, ticketId); return this.getTicket(ticketId); }
    markResponded(ticketId, changedBy) { const ticket = this.getTicket(ticketId); if (!ticket || ticket.responseRespondedAt)
        return ticket; const now = new Date().toISOString(); this.database.prepare("UPDATE support_tickets SET response_responded_at=?, updated_at=? WHERE id=?").run(now, now, ticketId); this.history(ticketId, "responded", null, now, changedBy, now); return this.getTicket(ticketId); }
    listHistory(ticketId) { return this.database.prepare("SELECT * FROM ticket_history WHERE ticket_id = ? ORDER BY created_at DESC, id DESC").all(ticketId).map(mapHistory); }
}
