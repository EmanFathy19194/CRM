import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { CreateTicketFeedbackInput, PortalActivity, PortalTicket } from "./knowledge-base.js";
type Row = Record<string, string | number | null>;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const mapTicket = (r: Row): PortalTicket => ({ ticketNumber: String(r.ticket_number), subject: String(r.subject), category: String(r.category), status: String(r.status), dueDate: r.due_date === null ? null : String(r.due_date), isEscalated: Boolean(Number(r.is_escalated)), createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
const labels: Record<string, string> = { created: "Request submitted", updated: "Request updated", status_changed: "Status updated", escalated: "Request escalated", responded: "Response received" };
export class CustomerPortalRepository {
  constructor(private db: DatabaseSync) {}
  verify(email: string, ticketNumber: string) { const row = this.db.prepare("SELECT t.customer_id FROM support_tickets t JOIN customers c ON c.id=t.customer_id WHERE lower(c.email)=? AND t.ticket_number=?").get(email, ticketNumber) as Row | undefined; return row ? Number(row.customer_id) : null; }
  createSession(customerId: number) { const token=randomBytes(32).toString("base64url"), now=new Date(), expiry=new Date(now.getTime()+3600000).toISOString(); this.db.prepare("INSERT INTO portal_sessions(token_hash,customer_id,expires_at,created_at) VALUES(?,?,?,?)").run(hash(token),customerId,expiry,now.toISOString()); return token; }
  customerForToken(token: string) { const now=new Date().toISOString(); this.db.prepare("DELETE FROM portal_sessions WHERE expires_at<=?").run(now); const row=this.db.prepare("SELECT customer_id FROM portal_sessions WHERE token_hash=? AND expires_at>?").get(hash(token),now) as Row|undefined; return row ? Number(row.customer_id) : null; }
  revoke(token: string) { this.db.prepare("DELETE FROM portal_sessions WHERE token_hash=?").run(hash(token)); }
  list(customerId: number) { return (this.db.prepare("SELECT * FROM support_tickets WHERE customer_id=? ORDER BY created_at DESC,id DESC").all(customerId) as Row[]).map(mapTicket); }
  get(customerId: number, ticketNumber: string) { const row=this.db.prepare("SELECT * FROM support_tickets WHERE customer_id=? AND ticket_number=?").get(customerId,ticketNumber) as Row|undefined; return row ? mapTicket(row) : null; }
  history(customerId:number,ticketNumber:string):PortalActivity[] { return (this.db.prepare("SELECT h.action,h.created_at FROM ticket_history h JOIN support_tickets t ON t.id=h.ticket_id WHERE t.customer_id=? AND t.ticket_number=? AND h.action IN ('created','updated','status_changed','escalated','responded') ORDER BY h.created_at DESC,h.id DESC").all(customerId,ticketNumber) as Row[]).map(row=>({action:String(row.action),label:labels[String(row.action)],createdAt:String(row.created_at)})); }
  feedback(customerId:number,ticketNumber:string,value:CreateTicketFeedbackInput) { const row=this.db.prepare("SELECT id FROM support_tickets WHERE customer_id=? AND ticket_number=?").get(customerId,ticketNumber) as Row|undefined;if(!row)return "missing";try { this.db.prepare("INSERT INTO ticket_feedback(ticket_id,customer_id,rating,message,created_at) VALUES(?,?,?,?,?)").run(Number(row.id),customerId,value.rating,value.message,new Date().toISOString());return "created"; } catch { return "exists"; } }
}
