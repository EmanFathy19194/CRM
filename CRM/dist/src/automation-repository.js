const sla = (r) => ({ id: Number(r.id), priority: r.priority === null ? null : String(r.priority), category: r.category === null ? null : String(r.category), responseTargetMinutes: Number(r.response_target_minutes), resolutionTargetMinutes: Number(r.resolution_target_minutes), createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
const rule = (r) => ({ id: Number(r.id), priority: r.priority === null ? null : String(r.priority), category: r.category === null ? null : String(r.category), action: String(r.action), assignedAgent: r.assigned_agent === null ? null : String(r.assigned_agent), createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
const notice = (r) => ({ id: Number(r.id), recipientEmail: String(r.recipient_email), ticketId: Number(r.ticket_id), kind: String(r.kind), message: String(r.message), dismissedAt: r.dismissed_at === null ? null : String(r.dismissed_at), createdAt: String(r.created_at) });
export class AutomationRepository {
    database;
    tickets;
    constructor(database, tickets) {
        this.database = database;
        this.tickets = tickets;
    }
    listSlaRules() { return this.database.prepare("SELECT * FROM sla_rules ORDER BY id").all().map(sla); }
    getSlaRule(id) { const row = this.database.prepare("SELECT * FROM sla_rules WHERE id=?").get(id); return row ? sla(row) : null; }
    createSlaRule(input) { const now = new Date().toISOString(), r = this.database.prepare("INSERT INTO sla_rules (priority,category,response_target_minutes,resolution_target_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(input.priority, input.category, input.responseTargetMinutes, input.resolutionTargetMinutes, now, now); return this.getSlaRule(Number(r.lastInsertRowid)); }
    updateSlaRule(id, input) { const now = new Date().toISOString(), r = this.database.prepare("UPDATE sla_rules SET priority=?,category=?,response_target_minutes=?,resolution_target_minutes=?,updated_at=? WHERE id=?").run(input.priority, input.category, input.responseTargetMinutes, input.resolutionTargetMinutes, now, id); return Number(r.changes) ? this.getSlaRule(id) : null; }
    deleteSlaRule(id) { return Boolean(Number(this.database.prepare("DELETE FROM sla_rules WHERE id=?").run(id).changes)); }
    listAutomationRules() { return this.database.prepare("SELECT * FROM automation_rules ORDER BY id").all().map(rule); }
    getAutomationRule(id) { const row = this.database.prepare("SELECT * FROM automation_rules WHERE id=?").get(id); return row ? rule(row) : null; }
    createAutomationRule(input) { const now = new Date().toISOString(), r = this.database.prepare("INSERT INTO automation_rules (priority,category,action,assigned_agent,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(input.priority, input.category, input.action, input.assignedAgent, now, now); return this.getAutomationRule(Number(r.lastInsertRowid)); }
    updateAutomationRule(id, input) { const now = new Date().toISOString(), r = this.database.prepare("UPDATE automation_rules SET priority=?,category=?,action=?,assigned_agent=?,updated_at=? WHERE id=?").run(input.priority, input.category, input.action, input.assignedAgent, now, id); return Number(r.changes) ? this.getAutomationRule(id) : null; }
    deleteAutomationRule(id) { return Boolean(Number(this.database.prepare("DELETE FROM automation_rules WHERE id=?").run(id).changes)); }
    listNotifications(owner) { return this.database.prepare("SELECT * FROM agent_notifications WHERE recipient_email=? AND dismissed_at IS NULL ORDER BY created_at DESC,id DESC").all(owner.toLowerCase()).map(notice); }
    dismissNotification(owner, id) { const r = this.database.prepare("UPDATE agent_notifications SET dismissed_at=? WHERE id=? AND recipient_email=? AND dismissed_at IS NULL").run(new Date().toISOString(), id, owner.toLowerCase()); return Boolean(Number(r.changes)); }
    matching(table, ticket) { return this.database.prepare(`SELECT *, ((priority IS NOT NULL) + (category IS NOT NULL)) AS specificity FROM ${table} WHERE (priority IS NULL OR priority=?) AND (category IS NULL OR category=?) ORDER BY specificity DESC,id ASC`).all(ticket.priority, ticket.category); }
    notify(ticket, kind, message, now) { const recipient = ticket.assignedAgent.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(recipient))
        return; this.database.prepare("INSERT INTO agent_notifications (recipient_email,ticket_id,kind,message,dismissed_at,created_at) VALUES (?,?,?,?,NULL,?)").run(recipient, ticket.id, kind, message, now); }
    atomic(name, work) { this.database.exec(`SAVEPOINT ${name}`); try {
        const value = work();
        this.database.exec(`RELEASE SAVEPOINT ${name}`);
        return value;
    }
    catch (error) {
        this.database.exec(`ROLLBACK TO SAVEPOINT ${name}`);
        this.database.exec(`RELEASE SAVEPOINT ${name}`);
        throw error;
    } }
    applySlaOnCreate(ticket) { return this.atomic("apply_sla", () => { if (ticket.slaRuleId)
        return ticket; const match = this.matching("sla_rules", ticket)[0]; if (!match)
        return ticket; const selected = sla(match), created = new Date(ticket.createdAt).getTime(); return this.tickets.applySla(ticket.id, selected.id, selected.responseTargetMinutes, new Date(created + selected.responseTargetMinutes * 60000).toISOString(), selected.resolutionTargetMinutes, new Date(created + selected.resolutionTargetMinutes * 60000).toISOString()); }); }
    applyAutomation(ticket, actor) { return this.atomic("apply_automation", () => { let current = ticket; const rules = this.matching("automation_rules", current).map(rule); for (const item of [...rules.filter(r => r.action === "assign"), ...rules.filter(r => r.action === "escalate")]) {
        const now = new Date().toISOString();
        if (item.action === "assign" && item.assignedAgent) {
            const updated = this.tickets.assignAutomatically(current.id, item.assignedAgent, actor, now);
            if (updated && updated.assignedAgent !== current.assignedAgent) {
                current = updated;
                this.notify(current, "automatically_assigned", `Ticket ${current.ticketNumber} was assigned to you automatically.`, now);
            }
        }
        if (item.action === "escalate" && !current.isEscalated) {
            const updated = this.tickets.escalateTicket(current.id, actor);
            this.tickets.addAutomationHistory(current.id, "automatically_escalated", "false", "true", actor, now);
            current = updated;
            this.notify(current, "automatically_escalated", `Ticket ${current.ticketNumber} was escalated automatically.`, now);
        }
    } return current; }); }
    evaluate(ticket, actor = "system", now = new Date()) { return this.atomic("evaluate_sla", () => { let current = this.tickets.getTicket(ticket.id) ?? ticket; for (const [kind, due, target, stopped] of [["response", current.responseDueAt, current.responseTargetMinutes, Boolean(current.responseRespondedAt)], ["resolution", current.resolutionDueAt, current.resolutionTargetMinutes, ["resolved", "closed"].includes(current.status)]]) {
        if (!due || !target || stopped)
            continue;
        const dueAt = new Date(due).getTime(), warningAt = dueAt - target * 60000 * .25, event = now.getTime() >= dueAt ? "breach" : now.getTime() >= warningAt ? "warning" : null;
        if (!event)
            continue;
        const timestamp = now.toISOString(), result = this.database.prepare("INSERT OR IGNORE INTO ticket_sla_events (ticket_id,deadline_kind,event_kind,created_at) VALUES (?,?,?,?)").run(current.id, kind, event, timestamp);
        if (!Number(result.changes))
            continue;
        const action = event === "breach" ? "sla_breached" : "sla_warning";
        this.tickets.addAutomationHistory(current.id, action, null, kind, actor, timestamp);
        this.notify(current, action, `Ticket ${current.ticketNumber} ${event === "breach" ? "breached" : "is approaching"} its ${kind} SLA deadline.`, timestamp);
        if (event === "breach" && !current.isEscalated) {
            current = this.tickets.escalateTicket(current.id, actor);
            this.tickets.addAutomationHistory(current.id, "automatically_escalated", "false", "true", actor, timestamp);
            this.notify(current, "automatically_escalated", `Ticket ${current.ticketNumber} was escalated after an SLA breach.`, timestamp);
        }
    } return current; }); }
}
