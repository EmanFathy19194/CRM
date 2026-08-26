const map = (r) => ({ id: Number(r.id), type: String(r.type), category: String(r.category), title: String(r.title), summary: String(r.summary), body: String(r.body), status: String(r.status), publishedAt: r.published_at === null ? null : String(r.published_at), createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
export class KnowledgeBaseRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list(page = 1, pageSize = 10, publicOnly = false, search = "", type = "", category = "") { const size = Math.min(50, Math.max(1, pageSize)), where = [], args = []; if (publicOnly)
        where.push("status='published'"); if (search) {
        where.push("(lower(title) LIKE ? OR lower(summary) LIKE ? OR lower(body) LIKE ? OR lower(category) LIKE ?)");
        args.push(...Array(4).fill(`%${search.toLowerCase()}%`));
    } if (type) {
        where.push("type=?");
        args.push(type);
    } if (category) {
        where.push("category=?");
        args.push(category);
    } const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "", total = Number(this.db.prepare(`SELECT COUNT(*) count FROM knowledge_articles${clause}`).get(...args).count), pages = Math.max(1, Math.ceil(total / size)), current = Math.min(Math.max(1, page), pages), rows = this.db.prepare(`SELECT * FROM knowledge_articles${clause} ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`).all(...args, size, (current - 1) * size); return { items: rows.map(map), page: current, pageSize: size, total, totalPages: pages }; }
    get(id, publicOnly = false) { const r = this.db.prepare(`SELECT * FROM knowledge_articles WHERE id=?${publicOnly ? " AND status='published'" : ""}`).get(id); return r ? map(r) : null; }
    create(v) { const now = new Date().toISOString(), published = v.status === 'published' ? now : null, r = this.db.prepare("INSERT INTO knowledge_articles(type,category,title,summary,body,status,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(v.type, v.category, v.title, v.summary, v.body, v.status, published, now, now); return this.get(Number(r.lastInsertRowid)); }
    update(id, v) { const e = this.get(id); if (!e)
        return null; const now = new Date().toISOString(), published = v.status === 'published' ? (e.publishedAt ?? now) : null; this.db.prepare("UPDATE knowledge_articles SET type=?,category=?,title=?,summary=?,body=?,status=?,published_at=?,updated_at=? WHERE id=?").run(v.type, v.category, v.title, v.summary, v.body, v.status, published, now, id); return this.get(id); }
    delete(id) { return Boolean(Number(this.db.prepare("DELETE FROM knowledge_articles WHERE id=?").run(id).changes)); }
}
