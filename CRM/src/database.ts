import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export function createDatabase(location = process.env.CRM_DATABASE_PATH ?? join(process.cwd(), "data", "crm.sqlite")) {
  mkdirSync(dirname(location), { recursive: true });
  const database = new DatabaseSync(location);
  database.exec(`PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers (created_at DESC);
  CREATE TABLE IF NOT EXISTS customer_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customer_notes_customer_idx ON customer_notes (customer_id, created_at DESC, id DESC);
  CREATE TABLE IF NOT EXISTS customer_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customer_attachments_customer_idx ON customer_attachments (customer_id, created_at DESC, id DESC);
  CREATE TABLE IF NOT EXISTS customer_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('call', 'email', 'message', 'meeting', 'note')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customer_interactions_customer_idx ON customer_interactions (customer_id, created_at DESC, id DESC);`);
  database.exec(`CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    subject TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_agent TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('new', 'open', 'in_progress', 'pending', 'resolved', 'closed')),
    due_date TEXT, is_escalated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets (created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS support_tickets_filters_idx ON support_tickets (status, priority, customer_id);
  CREATE TABLE IF NOT EXISTS ticket_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    action TEXT NOT NULL, old_value TEXT, new_value TEXT,
    changed_by TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ticket_history_ticket_idx ON ticket_history (ticket_id, created_at DESC, id DESC);`);
  database.exec(`CREATE TABLE IF NOT EXISTS communication_channels (type TEXT PRIMARY KEY, display_name TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS customer_communications (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id), ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE SET NULL, channel_type TEXT NOT NULL REFERENCES communication_channels(type), message TEXT NOT NULL, source_reference TEXT, received_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS customer_communications_customer_idx ON customer_communications (customer_id, received_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS customer_communications_ticket_idx ON customer_communications (ticket_id, received_at DESC, id DESC);
  INSERT OR IGNORE INTO communication_channels (type, display_name) VALUES ('email','Email'),('whatsapp','WhatsApp'),('live_chat','Live Chat'),('sms','SMS'),('web_form','Web Form');`);
  return database;
}
