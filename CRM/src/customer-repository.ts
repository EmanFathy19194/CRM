import { Customer, CreateCustomerInput, CustomerAttachment, CustomerInteraction, CustomerNote, InteractionType } from "./customer.js";
import type { DatabaseSync } from "node:sqlite";

type CustomerRow = Record<string, string | number | bigint>;
export type CustomerPage = { items: Customer[]; page: number; pageSize: number; total: number; totalPages: number };

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: Number(row.id),
    firstName: String(row.first_name), lastName: String(row.last_name), email: String(row.email),
    phone: String(row.phone), company: String(row.company), jobTitle: String(row.job_title),
    status: String(row.status) as Customer["status"], address: String(row.address), notes: String(row.notes),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

export class CustomerRepository {
  constructor(private readonly database: DatabaseSync) {}

  getDatabase(): DatabaseSync { return this.database; }

  createCustomer(input: CreateCustomerInput): Customer {
    const now = new Date().toISOString();
    const result = this.database.prepare(`INSERT INTO customers
      (first_name, last_name, email, phone, company, job_title, status, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      input.firstName, input.lastName, input.email, input.phone, input.company, input.jobTitle,
      input.status, input.address, input.notes, now, now
    );
    return this.getCustomer(Number(result.lastInsertRowid))!;
  }

  listCustomers(page = 1, pageSize = 10, search = "", status = ""): CustomerPage {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
    const term = `%${search.trim().toLowerCase()}%`;
    const conditions = [search.trim() ? "lower(first_name || ' ' || last_name || ' ' || email || ' ' || phone || ' ' || company) LIKE ?" : "", status ? "status = ?" : ""].filter(Boolean);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const params = [...(search.trim() ? [term] : []), ...(status ? [status] : [])];
    const total = Number((this.database.prepare(`SELECT COUNT(*) AS count FROM customers ${where}`).get(...params) as { count: number }).count);
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const currentPage = Math.min(safePage, totalPages);
    const offset = (currentPage - 1) * safePageSize;
    const rows = this.database.prepare(`SELECT * FROM customers ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).all(...params, safePageSize, offset);
    return { items: rows.map((row) => mapCustomer(row as CustomerRow)), page: currentPage, pageSize: safePageSize, total, totalPages };
  }

  getCustomer(id: number): Customer | null {
    const row = this.database.prepare("SELECT * FROM customers WHERE id = ?").get(id) as CustomerRow | undefined;
    return row ? mapCustomer(row) : null;
  }

  updateCustomer(id: number, input: CreateCustomerInput): Customer | null {
    const now = new Date().toISOString();
    const result = this.database.prepare(`UPDATE customers SET first_name = ?, last_name = ?, email = ?, phone = ?, company = ?, job_title = ?, status = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?`).run(
      input.firstName, input.lastName, input.email, input.phone, input.company, input.jobTitle,
      input.status, input.address, input.notes, now, id
    );
    return Number(result.changes) ? this.getCustomer(id) : null;
  }

  deleteCustomer(id: number): boolean {
    return Boolean(Number(this.database.prepare("DELETE FROM customers WHERE id = ?").run(id).changes));
  }

  listNotes(customerId: number): CustomerNote[] {
    return (this.database.prepare("SELECT * FROM customer_notes WHERE customer_id = ? ORDER BY created_at DESC, id DESC").all(customerId) as CustomerRow[]).map(mapNote);
  }

  createNote(customerId: number, content: string): CustomerNote {
    const now = new Date().toISOString();
    const result = this.database.prepare("INSERT INTO customer_notes (customer_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)").run(customerId, content, now, now);
    return this.getNote(customerId, Number(result.lastInsertRowid))!;
  }

  getNote(customerId: number, id: number): CustomerNote | null {
    const row = this.database.prepare("SELECT * FROM customer_notes WHERE customer_id = ? AND id = ?").get(customerId, id) as CustomerRow | undefined;
    return row ? mapNote(row) : null;
  }

  updateNote(customerId: number, id: number, content: string): CustomerNote | null {
    const result = this.database.prepare("UPDATE customer_notes SET content = ?, updated_at = ? WHERE customer_id = ? AND id = ?").run(content, new Date().toISOString(), customerId, id);
    return Number(result.changes) ? this.getNote(customerId, id) : null;
  }

  deleteNote(customerId: number, id: number): boolean {
    return Boolean(Number(this.database.prepare("DELETE FROM customer_notes WHERE customer_id = ? AND id = ?").run(customerId, id).changes));
  }

  listAttachments(customerId: number): CustomerAttachment[] {
    return (this.database.prepare("SELECT * FROM customer_attachments WHERE customer_id = ? ORDER BY created_at DESC, id DESC").all(customerId) as CustomerRow[]).map(mapAttachment).map(({ storageName: _storageName, ...attachment }) => attachment);
  }

  createAttachment(customerId: number, input: { fileName: string; contentType: string; size: number; storageName: string }): CustomerAttachment & { storageName: string } {
    const result = this.database.prepare("INSERT INTO customer_attachments (customer_id, file_name, content_type, size, storage_name, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(customerId, input.fileName, input.contentType, input.size, input.storageName, new Date().toISOString());
    return this.getAttachment(customerId, Number(result.lastInsertRowid))!;
  }

  getAttachment(customerId: number, id: number): (CustomerAttachment & { storageName: string }) | null {
    const row = this.database.prepare("SELECT * FROM customer_attachments WHERE customer_id = ? AND id = ?").get(customerId, id) as CustomerRow | undefined;
    return row ? mapAttachment(row) : null;
  }

  deleteAttachment(customerId: number, id: number): (CustomerAttachment & { storageName: string }) | null {
    const attachment = this.getAttachment(customerId, id);
    if (!attachment) return null;
    this.database.prepare("DELETE FROM customer_attachments WHERE customer_id = ? AND id = ?").run(customerId, id);
    return attachment;
  }

  listInteractions(customerId: number): CustomerInteraction[] {
    return (this.database.prepare("SELECT * FROM customer_interactions WHERE customer_id = ? ORDER BY created_at DESC, id DESC").all(customerId) as CustomerRow[]).map(mapInteraction);
  }

  createInteraction(customerId: number, type: InteractionType, content: string): CustomerInteraction {
    const result = this.database.prepare("INSERT INTO customer_interactions (customer_id, type, content, created_at) VALUES (?, ?, ?, ?)").run(customerId, type, content, new Date().toISOString());
    const row = this.database.prepare("SELECT * FROM customer_interactions WHERE customer_id = ? AND id = ?").get(customerId, Number(result.lastInsertRowid)) as CustomerRow;
    return mapInteraction(row);
  }
}

function mapNote(row: CustomerRow): CustomerNote {
  return { id: Number(row.id), customerId: Number(row.customer_id), content: String(row.content), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

function mapAttachment(row: CustomerRow): CustomerAttachment & { storageName: string } {
  return { id: Number(row.id), customerId: Number(row.customer_id), fileName: String(row.file_name), contentType: String(row.content_type), size: Number(row.size), createdAt: String(row.created_at), storageName: String(row.storage_name) };
}

function mapInteraction(row: CustomerRow): CustomerInteraction {
  return { id: Number(row.id), customerId: Number(row.customer_id), type: String(row.type) as InteractionType, content: String(row.content), createdAt: String(row.created_at) };
}
