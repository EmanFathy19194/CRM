function mapCustomer(row) {
    return {
        id: Number(row.id),
        firstName: String(row.first_name), lastName: String(row.last_name), email: String(row.email),
        phone: String(row.phone), company: String(row.company), jobTitle: String(row.job_title),
        status: String(row.status), address: String(row.address), notes: String(row.notes),
        createdAt: String(row.created_at), updatedAt: String(row.updated_at)
    };
}
export class CustomerRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    createCustomer(input) {
        const now = new Date().toISOString();
        const result = this.database.prepare(`INSERT INTO customers
      (first_name, last_name, email, phone, company, job_title, status, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.firstName, input.lastName, input.email, input.phone, input.company, input.jobTitle, input.status, input.address, input.notes, now, now);
        return this.getCustomer(Number(result.lastInsertRowid));
    }
    listCustomers(page = 1, pageSize = 10, search = "", status = "") {
        const safePage = Math.max(1, Math.floor(page));
        const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
        const term = `%${search.trim().toLowerCase()}%`;
        const conditions = [search.trim() ? "lower(first_name || ' ' || last_name || ' ' || email || ' ' || phone || ' ' || company) LIKE ?" : "", status ? "status = ?" : ""].filter(Boolean);
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const params = [...(search.trim() ? [term] : []), ...(status ? [status] : [])];
        const total = Number(this.database.prepare(`SELECT COUNT(*) AS count FROM customers ${where}`).get(...params).count);
        const totalPages = Math.max(1, Math.ceil(total / safePageSize));
        const currentPage = Math.min(safePage, totalPages);
        const offset = (currentPage - 1) * safePageSize;
        const rows = this.database.prepare(`SELECT * FROM customers ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).all(...params, safePageSize, offset);
        return { items: rows.map((row) => mapCustomer(row)), page: currentPage, pageSize: safePageSize, total, totalPages };
    }
    getCustomer(id) {
        const row = this.database.prepare("SELECT * FROM customers WHERE id = ?").get(id);
        return row ? mapCustomer(row) : null;
    }
    updateCustomer(id, input) {
        const now = new Date().toISOString();
        const result = this.database.prepare(`UPDATE customers SET first_name = ?, last_name = ?, email = ?, phone = ?, company = ?, job_title = ?, status = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?`).run(input.firstName, input.lastName, input.email, input.phone, input.company, input.jobTitle, input.status, input.address, input.notes, now, id);
        return Number(result.changes) ? this.getCustomer(id) : null;
    }
    deleteCustomer(id) {
        return Boolean(Number(this.database.prepare("DELETE FROM customers WHERE id = ?").run(id).changes));
    }
    listNotes(customerId) {
        return this.database.prepare("SELECT * FROM customer_notes WHERE customer_id = ? ORDER BY created_at DESC, id DESC").all(customerId).map(mapNote);
    }
    createNote(customerId, content) {
        const now = new Date().toISOString();
        const result = this.database.prepare("INSERT INTO customer_notes (customer_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)").run(customerId, content, now, now);
        return this.getNote(customerId, Number(result.lastInsertRowid));
    }
    getNote(customerId, id) {
        const row = this.database.prepare("SELECT * FROM customer_notes WHERE customer_id = ? AND id = ?").get(customerId, id);
        return row ? mapNote(row) : null;
    }
    updateNote(customerId, id, content) {
        const result = this.database.prepare("UPDATE customer_notes SET content = ?, updated_at = ? WHERE customer_id = ? AND id = ?").run(content, new Date().toISOString(), customerId, id);
        return Number(result.changes) ? this.getNote(customerId, id) : null;
    }
    deleteNote(customerId, id) {
        return Boolean(Number(this.database.prepare("DELETE FROM customer_notes WHERE customer_id = ? AND id = ?").run(customerId, id).changes));
    }
    listAttachments(customerId) {
        return this.database.prepare("SELECT * FROM customer_attachments WHERE customer_id = ? ORDER BY created_at DESC, id DESC").all(customerId).map(mapAttachment).map(({ storageName: _storageName, ...attachment }) => attachment);
    }
    createAttachment(customerId, input) {
        const result = this.database.prepare("INSERT INTO customer_attachments (customer_id, file_name, content_type, size, storage_name, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(customerId, input.fileName, input.contentType, input.size, input.storageName, new Date().toISOString());
        return this.getAttachment(customerId, Number(result.lastInsertRowid));
    }
    getAttachment(customerId, id) {
        const row = this.database.prepare("SELECT * FROM customer_attachments WHERE customer_id = ? AND id = ?").get(customerId, id);
        return row ? mapAttachment(row) : null;
    }
    deleteAttachment(customerId, id) {
        const attachment = this.getAttachment(customerId, id);
        if (!attachment)
            return null;
        this.database.prepare("DELETE FROM customer_attachments WHERE customer_id = ? AND id = ?").run(customerId, id);
        return attachment;
    }
    listInteractions(customerId) {
        return this.database.prepare("SELECT * FROM customer_interactions WHERE customer_id = ? ORDER BY created_at DESC, id DESC").all(customerId).map(mapInteraction);
    }
    createInteraction(customerId, type, content) {
        const result = this.database.prepare("INSERT INTO customer_interactions (customer_id, type, content, created_at) VALUES (?, ?, ?, ?)").run(customerId, type, content, new Date().toISOString());
        const row = this.database.prepare("SELECT * FROM customer_interactions WHERE customer_id = ? AND id = ?").get(customerId, Number(result.lastInsertRowid));
        return mapInteraction(row);
    }
}
function mapNote(row) {
    return { id: Number(row.id), customerId: Number(row.customer_id), content: String(row.content), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function mapAttachment(row) {
    return { id: Number(row.id), customerId: Number(row.customer_id), fileName: String(row.file_name), contentType: String(row.content_type), size: Number(row.size), createdAt: String(row.created_at), storageName: String(row.storage_name) };
}
function mapInteraction(row) {
    return { id: Number(row.id), customerId: Number(row.customer_id), type: String(row.type), content: String(row.content), createdAt: String(row.created_at) };
}
