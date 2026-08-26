export class ReportsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    period(range, column) { const c = [], p = []; if (range.from) {
        c.push(`${column} >= ?`);
        p.push(`${range.from}T00:00:00.000Z`);
    } if (range.to) {
        c.push(`${column} <= ?`);
        p.push(`${range.to}T23:59:59.999Z`);
    } return { where: c.length ? ` WHERE ${c.join(" AND ")}` : "", params: p }; }
    tickets(range) { const q = this.period(range, "created_at"), totals = this.db.prepare(`SELECT count(*) total, sum(status IN ('resolved','closed')) resolved FROM support_tickets${q.where}`).get(...q.params); const groups = this.db.prepare(`SELECT status,priority,category,count(*) total FROM support_tickets${q.where} GROUP BY status,priority,category ORDER BY total DESC,status,priority,category`).all(...q.params); return { total: Number(totals.total ?? 0), resolved: Number(totals.resolved ?? 0), groups: groups.map(r => ({ status: String(r.status), priority: String(r.priority), category: String(r.category), total: Number(r.total) })) }; }
    sla(range) { const q = this.period(range, "created_at"), rows = this.db.prepare(`SELECT deadline_kind kind,event_kind event_kind,count(*) total FROM ticket_sla_events${q.where} GROUP BY deadline_kind,event_kind`).all(...q.params); const warnings = rows.filter(r => r.event_kind === "warning").reduce((n, r) => n + Number(r.total), 0), breaches = rows.filter(r => r.event_kind === "breach").reduce((n, r) => n + Number(r.total), 0); return { warnings, breaches, events: rows.map(r => ({ kind: String(r.kind), eventKind: String(r.event_kind), total: Number(r.total) })) }; }
    agents(range) { const q = this.period(range, "created_at"), rows = this.db.prepare(`SELECT assigned_agent email,count(*) assigned,sum(status IN ('resolved','closed')) resolved,sum(status NOT IN ('resolved','closed')) open,avg(CASE WHEN response_responded_at IS NOT NULL THEN (julianday(response_responded_at)-julianday(created_at))*1440 END) averageResponseMinutes FROM support_tickets${q.where} GROUP BY assigned_agent ORDER BY assigned DESC,email`).all(...q.params); return { items: rows.map(r => ({ email: String(r.email), assigned: Number(r.assigned), resolved: Number(r.resolved ?? 0), open: Number(r.open ?? 0), averageResponseMinutes: r.averageResponseMinutes === null ? null : Math.round(Number(r.averageResponseMinutes)) })) }; }
    satisfaction(range) { const q = this.period(range, "created_at"), summary = this.db.prepare(`SELECT count(*) total,avg(rating) average FROM ticket_feedback${q.where}`).get(...q.params), rows = this.db.prepare(`SELECT rating,count(*) total FROM ticket_feedback${q.where} GROUP BY rating ORDER BY rating`).all(...q.params); return { total: Number(summary.total ?? 0), average: summary.average === null ? null : Number(Number(summary.average).toFixed(2)), ratings: rows.map(r => ({ rating: Number(r.rating), total: Number(r.total) })) }; }
    management(range) { const tickets = this.tickets(range), sla = this.sla(range), satisfaction = this.satisfaction(range); return { ticketTotal: tickets.total, resolvedTickets: tickets.resolved, slaWarnings: sla.warnings, slaBreaches: sla.breaches, feedbackCount: satisfaction.total, averageRating: satisfaction.average }; }
}
