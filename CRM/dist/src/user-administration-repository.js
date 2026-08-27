import bcrypt from "bcryptjs";
const user = (r) => ({ id: Number(r.id), name: String(r.name), email: String(r.email), role: String(r.role), isActive: Boolean(Number(r.is_active)), createdAt: String(r.created_at), updatedAt: String(r.updated_at), deactivatedAt: r.deactivated_at === null ? null : String(r.deactivated_at) });
const audit = (r) => ({ id: Number(r.id), actorEmail: String(r.actor_email), action: String(r.action), targetKind: String(r.target_kind), targetId: r.target_id === null ? null : String(r.target_id), detail: String(r.detail), createdAt: String(r.created_at) });
export class UserAdministrationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    addAudit(actor, action, kind, id, detail) { this.db.prepare("INSERT INTO audit_logs(actor_email,action,target_kind,target_id,detail,created_at) VALUES(?,?,?,?,?,?)").run(actor, action, kind, id, detail, new Date().toISOString()); }
    getForLogin(email) { const r = this.db.prepare("SELECT * FROM staff_users WHERE email=? AND is_active=1").get(email.trim().toLowerCase()); return r ? { ...user(r), passwordHash: String(r.password_hash) } : null; }
    isActive(email) { const row = this.db.prepare("SELECT is_active FROM staff_users WHERE email=?").get(email.toLowerCase()); return row === undefined || Boolean(Number(row.is_active)); }
    async seed(email, password, role = "admin") { if (this.getForLogin(email))
        return; const now = new Date().toISOString(); this.db.prepare("INSERT INTO staff_users(name,email,password_hash,role,is_active,created_at,updated_at,deactivated_at) VALUES(?,?,?,?,1,?,?,NULL)").run(email.split("@")[0], email.trim().toLowerCase(), await bcrypt.hash(password, 12), role, now, now); }
    list(page = 1, pageSize = 20, search = "") { const size = Math.min(50, Math.max(1, Math.floor(pageSize))), term = `%${search.trim().toLowerCase()}%`, where = search.trim() ? "WHERE lower(name||' '||email) LIKE ?" : "", params = search.trim() ? [term] : []; const total = Number(this.db.prepare(`SELECT count(*) count FROM staff_users ${where}`).get(...params).count), totalPages = Math.max(1, Math.ceil(total / size)), current = Math.min(Math.max(1, Math.floor(page)), totalPages), rows = this.db.prepare(`SELECT * FROM staff_users ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...params, size, (current - 1) * size); return { items: rows.map(user), page: current, pageSize: size, total, totalPages }; }
    get(id) { const r = this.db.prepare("SELECT * FROM staff_users WHERE id=?").get(id); return r ? user(r) : null; }
    async create(input, actor) { const now = new Date().toISOString(); this.db.exec("BEGIN"); try {
        const r = this.db.prepare("INSERT INTO staff_users(name,email,password_hash,role,is_active,created_at,updated_at,deactivated_at) VALUES(?,?,?,?,1,?,?,NULL)").run(input.name, input.email, await bcrypt.hash(input.password, 12), input.role, now, now);
        const item = this.get(Number(r.lastInsertRowid));
        this.addAudit(actor, "staff_user_created", "staff_user", String(item.id), JSON.stringify({ email: item.email, role: item.role }));
        this.db.exec("COMMIT");
        return item;
    }
    catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
    } }
    async update(id, input, actor) { const existing = this.get(id); if (!existing)
        return null; const now = new Date().toISOString(); this.db.exec("BEGIN"); try {
        const pass = input.password ? ", password_hash=?" : "", args = [input.name, input.email, input.role, now, ...(input.password ? [await bcrypt.hash(input.password, 12)] : []), id];
        this.db.prepare(`UPDATE staff_users SET name=?,email=?,role=?,updated_at=?${pass} WHERE id=?`).run(...args);
        const item = this.get(id);
        this.addAudit(actor, "staff_user_updated", "staff_user", String(id), JSON.stringify({ email: item.email, role: item.role }));
        this.db.exec("COMMIT");
        return item;
    }
    catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
    } }
    deactivate(id, actor) { const existing = this.get(id); if (!existing)
        return "missing"; if (!existing.isActive || existing.email === actor.toLowerCase())
        return "conflict"; if (existing.role === "admin" && Number(this.db.prepare("SELECT count(*) count FROM staff_users WHERE role='admin' AND is_active=1").get().count) <= 1)
        return "conflict"; this.db.exec("BEGIN"); try {
        const now = new Date().toISOString();
        this.db.prepare("UPDATE staff_users SET is_active=0,deactivated_at=?,updated_at=? WHERE id=?").run(now, now, id);
        this.addAudit(actor, "staff_user_deactivated", "staff_user", String(id), JSON.stringify({ email: existing.email }));
        this.db.exec("COMMIT");
        return "ok";
    }
    catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
    } }
    delete(id, actor) { const existing = this.get(id); if (!existing)
        return false; this.db.exec("BEGIN"); try {
        this.db.prepare("DELETE FROM staff_users WHERE id=?").run(id);
        this.addAudit(actor, "staff_user_deleted", "staff_user", String(id), JSON.stringify({ email: existing.email }));
        this.db.exec("COMMIT");
        return true;
    }
    catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
    } }
    settings() { const rows = this.db.prepare("SELECT key,value FROM system_settings").all(), m = Object.fromEntries(rows.map(row => [row.key, row.value])); return { organizationName: m.organization_name ?? "Northstar CRM", supportEmail: m.support_email ?? "support@example.com", defaultTicketPriority: (m.default_ticket_priority ?? "medium") }; }
    updateSettings(input, actor) { const old = this.settings(), pairs = [['organization_name', input.organizationName], ['support_email', input.supportEmail], ['default_ticket_priority', input.defaultTicketPriority]]; this.db.exec("BEGIN"); try {
        for (const [key, value] of pairs) {
            const previous = key === 'organization_name' ? old.organizationName : key === 'support_email' ? old.supportEmail : old.defaultTicketPriority;
            if (previous !== value) {
                this.db.prepare("UPDATE system_settings SET value=?,updated_at=? WHERE key=?").run(value, new Date().toISOString(), key);
                this.addAudit(actor, "setting_updated", "system_setting", key, JSON.stringify({ old: previous, new: value }));
            }
        }
        this.db.exec("COMMIT");
        return this.settings();
    }
    catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
    } }
    audits(page = 1, pageSize = 30, action = "") { const size = Math.min(100, Math.max(1, Math.floor(pageSize))), where = action ? "WHERE action=?" : "", p = action ? [action] : [], total = Number(this.db.prepare(`SELECT count(*) count FROM audit_logs ${where}`).get(...p).count), totalPages = Math.max(1, Math.ceil(total / size)), current = Math.min(Math.max(1, Math.floor(page)), totalPages), rows = this.db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...p, size, (current - 1) * size); return { items: rows.map(audit), page: current, pageSize: size, total, totalPages }; }
}
