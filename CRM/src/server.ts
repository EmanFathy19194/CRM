import express, { type Request, type Response } from "express";
import { createReadStream, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { AuthService } from "./auth.js";
import { validateLogin } from "./validation.js";
import { createDatabase } from "./database.js";
import { CustomerRepository } from "./customer-repository.js";
import { validateCustomer, validateInteraction, validateText } from "./customer-validation.js";
import { customerStatuses } from "./customer.js";
import { TicketRepository } from "./ticket-repository.js";
import { ticketPriorities, ticketStatuses } from "./ticket.js";
import { parsePositiveInteger, validateTicket } from "./ticket-validation.js";
import { CommunicationRepository } from "./communication-repository.js";
import { communicationChannelTypes } from "./communication.js";
import { validateCommunication, validatePublicWebRequest } from "./communication-validation.js";
import { AgentWorkRepository } from "./agent-work-repository.js";
import { validateComment, validateReminder, validateTask } from "./agent-work-validation.js";
import { AutomationRepository } from "./automation-repository.js";
import { validateAutomationRule, validateSlaRule } from "./automation-validation.js";
import { KnowledgeBaseRepository } from "./knowledge-base-repository.js";
import { CustomerPortalRepository } from "./customer-portal-repository.js";
import { validateKnowledgeArticle, validatePortalAccess, validateTicketFeedback } from "./knowledge-base-validation.js";

const cookieName = "crm_session";
const projectRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const uploadDirectory = process.env.CRM_UPLOAD_DIR ?? join(projectRoot, "data", "uploads");
mkdirSync(uploadDirectory, { recursive: true });
const protectedPagePaths = ["/dashboard", "/customers", "/tickets", "/communications", "/contacts", "/opportunities", "/tasks", "/activities", "/automation", "/admin/knowledge-base"];
const customerDetailsPagePath = /^\/customers\/\d+$/;
const ticketDetailsPagePath = /^\/tickets\/\d+$/;
const protectedApiPaths = ["/api/customers", "/api/tickets", "/api/communications", "/api/communication-channels", "/api/dashboard", "/api/tasks", "/api/reminders", "/api/contacts", "/api/opportunities", "/api/activities", "/api/sla-rules", "/api/automation-rules", "/api/notifications", "/api/articles"];
const upload = multer({ dest: uploadDirectory, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, /^[a-zA-Z0-9._ -]+$/.test(file.originalname)) });

function readCookie(request: Request, name: string): string | undefined {
  return request.headers.cookie
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

function getAuthenticatedUser(request: Request, auth: AuthService) {
  return auth.getUser(readCookie(request, cookieName));
}

function isAdmin(request: Request, auth: AuthService): boolean {
  return getAuthenticatedUser(request, auth)?.role === "admin";
}

export function createApp(auth: AuthService, customerRepository = new CustomerRepository(createDatabase()), ticketRepository = new TicketRepository(customerRepository.getDatabase())) {
  const communicationRepository = new CommunicationRepository(customerRepository.getDatabase());
  const agentWorkRepository = new AgentWorkRepository(customerRepository.getDatabase());
  const automationRepository = new AutomationRepository(customerRepository.getDatabase(), ticketRepository);
  const knowledgeBaseRepository = new KnowledgeBaseRepository(customerRepository.getDatabase());
  const portalRepository = new CustomerPortalRepository(customerRepository.getDatabase());
  const app = express();
  app.use(express.json({ limit: "10kb" }));

  app.use(protectedApiPaths, (request, response, next) => {
    if (!getAuthenticatedUser(request, auth)) {
      return response.status(401).json({ error: "Authentication required." });
    }
    return next();
  });

  app.use(["/api/customers", "/api/communications", "/api/communication-channels", "/api/contacts", "/api/opportunities", "/api/activities"], (request, response, next) => {
    if (!isAdmin(request, auth)) return response.status(403).json({ error: "Administrator access required." });
    return next();
  });

  app.get("/api/customers", (request, response) => {
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 10);
    const search = String(request.query.search ?? "");
    const status = String(request.query.status ?? "");
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
      return response.status(400).json({ error: "Invalid pagination values." });
    }
    if (status && !customerStatuses.includes(status as typeof customerStatuses[number])) return response.status(400).json({ error: "Invalid customer status." });
    return response.json(customerRepository.listCustomers(page, pageSize, search, status));
  });
  app.post("/api/customers", (request, response) => {
    const { value, errors } = validateCustomer(request.body ?? {});
    if (Object.keys(errors).length) return response.status(400).json({ errors });
    try {
      return response.status(201).json(customerRepository.createCustomer(value));
    } catch {
      return response.status(500).json({ error: "Unable to save customer." });
    }
  });
  app.get("/api/customers/:id", (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: "Invalid customer id." });
    const customer = customerRepository.getCustomer(id);
    return customer ? response.json(customer) : response.status(404).json({ error: "Customer not found." });
  });
  app.patch("/api/customers/:id", (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: "Invalid customer id." });
    const { value, errors } = validateCustomer(request.body ?? {});
    if (Object.keys(errors).length) return response.status(400).json({ errors });
    try {
      const customer = customerRepository.updateCustomer(id, value);
      return customer ? response.json(customer) : response.status(404).json({ error: "Customer not found." });
    } catch {
      return response.status(500).json({ error: "Unable to update customer." });
    }
  });
  app.delete("/api/customers/:id", (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: "Invalid customer id." });
    try {
      return customerRepository.deleteCustomer(id) ? response.status(204).send() : response.status(404).json({ error: "Customer not found." });
    } catch {
      return response.status(500).json({ error: "Unable to delete customer." });
    }
  });

  function customerId(request: Request, response: Response): number | null {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) { response.status(400).json({ error: "Invalid customer id." }); return null; }
    return id;
  }

  app.get("/api/customers/:id/notes", (request, response) => { const id = customerId(request, response); if (!id) return; if (!customerRepository.getCustomer(id)) return response.status(404).json({ error: "Customer not found." }); return response.json(customerRepository.listNotes(id)); });
  app.post("/api/customers/:id/notes", (request, response) => { const id = customerId(request, response); if (!id) return; if (!customerRepository.getCustomer(id)) return response.status(404).json({ error: "Customer not found." }); const result = validateText(request.body?.content, "Note"); if (result.error) return response.status(400).json({ errors: { content: result.error } }); return response.status(201).json(customerRepository.createNote(id, result.value)); });
  app.patch("/api/customers/:id/notes/:noteId", (request, response) => { const id = customerId(request, response); const noteId = Number(request.params.noteId); if (!id) return; if (!Number.isInteger(noteId) || noteId < 1) return response.status(400).json({ error: "Invalid note id." }); const result = validateText(request.body?.content, "Note"); if (result.error) return response.status(400).json({ errors: { content: result.error } }); const note = customerRepository.updateNote(id, noteId, result.value); return note ? response.json(note) : response.status(404).json({ error: "Note not found." }); });
  app.delete("/api/customers/:id/notes/:noteId", (request, response) => { const id = customerId(request, response); const noteId = Number(request.params.noteId); if (!id) return; if (!Number.isInteger(noteId) || noteId < 1) return response.status(400).json({ error: "Invalid note id." }); return customerRepository.deleteNote(id, noteId) ? response.status(204).send() : response.status(404).json({ error: "Note not found." }); });
  app.get("/api/customers/:id/interactions", (request, response) => { const id = customerId(request, response); if (!id) return; if (!customerRepository.getCustomer(id)) return response.status(404).json({ error: "Customer not found." }); return response.json(customerRepository.listInteractions(id)); });
  app.post("/api/customers/:id/interactions", (request, response) => { const id = customerId(request, response); if (!id) return; if (!customerRepository.getCustomer(id)) return response.status(404).json({ error: "Customer not found." }); const result = validateInteraction(request.body ?? {}); if (Object.keys(result.errors).length) return response.status(400).json({ errors: result.errors }); return response.status(201).json(customerRepository.createInteraction(id, result.type!, result.content)); });
  app.get("/api/customers/:id/attachments", (request, response) => { const id = customerId(request, response); if (!id) return; if (!customerRepository.getCustomer(id)) return response.status(404).json({ error: "Customer not found." }); return response.json(customerRepository.listAttachments(id)); });
  app.post("/api/customers/:id/attachments", upload.single("file"), (request, response) => { const id = customerId(request, response); if (!id) { if (request.file) unlinkSync(request.file.path); return; } if (!customerRepository.getCustomer(id)) { if (request.file) unlinkSync(request.file.path); return response.status(404).json({ error: "Customer not found." }); } const file = request.file; if (!file) return response.status(400).json({ error: "A valid file is required." }); const fileName = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, "_"); try { const { storageName: _storageName, ...metadata } = customerRepository.createAttachment(id, { fileName, contentType: file.mimetype, size: file.size, storageName: file.filename }); return response.status(201).json(metadata); } catch { unlinkSync(file.path); return response.status(500).json({ error: "Unable to save attachment." }); } });
  app.get("/api/customers/:id/attachments/:attachmentId", (request, response) => { const id = customerId(request, response); const attachmentId = Number(request.params.attachmentId); if (!id) return; if (!Number.isInteger(attachmentId) || attachmentId < 1) return response.status(400).json({ error: "Invalid attachment id." }); const attachment = customerRepository.getAttachment(id, attachmentId); if (!attachment) return response.status(404).json({ error: "Attachment not found." }); response.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName}"`); response.type(attachment.contentType); return createReadStream(join(uploadDirectory, attachment.storageName)).pipe(response); });
  app.delete("/api/customers/:id/attachments/:attachmentId", (request, response) => { const id = customerId(request, response); const attachmentId = Number(request.params.attachmentId); if (!id) return; if (!Number.isInteger(attachmentId) || attachmentId < 1) return response.status(400).json({ error: "Invalid attachment id." }); const attachment = customerRepository.deleteAttachment(id, attachmentId); if (!attachment) return response.status(404).json({ error: "Attachment not found." }); try { unlinkSync(join(uploadDirectory, attachment.storageName)); } catch { /* metadata is already removed; the private orphan is not user-visible */ } return response.status(204).send(); });

  function ticketId(request: Request, response: Response): number | null {
    const id = parsePositiveInteger(request.params.id);
    if (!id) { response.status(400).json({ error: "Invalid ticket id." }); return null; }
    return id;
  }
  function actor(request: Request): string { return getAuthenticatedUser(request, auth)!.email; }
  function canAccessTicket(request: Request, ticket: { assignedAgent: string }): boolean {
    const user = getAuthenticatedUser(request, auth)!;
    return user.role === "admin" || ticket.assignedAgent.trim().toLowerCase() === user.email;
  }
  function requireTicketAccess(request: Request, response: Response, id: number) {
    const ticket = ticketRepository.getTicket(id);
    if (!ticket || !canAccessTicket(request, ticket)) { response.status(404).json({ error: "Ticket not found." }); return null; }
    return ticket;
  }

  function evaluateTicket(ticket: import("./ticket.js").SupportTicket, actorName = "system") { return automationRepository.evaluate(ticket, actorName); }
  function evaluateVisibleTickets(request: Request) { const user=getAuthenticatedUser(request,auth)!; for(const item of ticketRepository.listTickets(1,50,{assignedAgent:user.role==="agent"?user.email:undefined}).items) if(canAccessTicket(request,item)) evaluateTicket(item); }

  app.get("/api/sla-rules", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."}); return response.json(automationRepository.listSlaRules()); });
  app.post("/api/sla-rules", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."}); const {value,errors}=validateSlaRule(request.body??{}); if(Object.keys(errors).length)return response.status(400).json({errors}); try{return response.status(201).json(automationRepository.createSlaRule(value));}catch{return response.status(500).json({error:"Unable to save SLA rule."});} });
  app.patch("/api/sla-rules/:id", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."}); const id=parsePositiveInteger(request.params.id),{value,errors}=validateSlaRule(request.body??{});if(!id)return response.status(400).json({error:"Invalid SLA rule id."});if(Object.keys(errors).length)return response.status(400).json({errors});const updated=automationRepository.updateSlaRule(id,value);return updated?response.json(updated):response.status(404).json({error:"SLA rule not found."}); });
  app.delete("/api/sla-rules/:id", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."});const id=parsePositiveInteger(request.params.id);if(!id)return response.status(400).json({error:"Invalid SLA rule id."});return automationRepository.deleteSlaRule(id)?response.status(204).send():response.status(404).json({error:"SLA rule not found."}); });
  app.get("/api/automation-rules", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."}); return response.json(automationRepository.listAutomationRules()); });
  app.post("/api/automation-rules", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."}); const {value,errors}=validateAutomationRule(request.body??{});if(Object.keys(errors).length)return response.status(400).json({errors});try{return response.status(201).json(automationRepository.createAutomationRule(value));}catch{return response.status(500).json({error:"Unable to save automation rule."});} });
  app.patch("/api/automation-rules/:id", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."});const id=parsePositiveInteger(request.params.id),{value,errors}=validateAutomationRule(request.body??{});if(!id)return response.status(400).json({error:"Invalid automation rule id."});if(Object.keys(errors).length)return response.status(400).json({errors});const updated=automationRepository.updateAutomationRule(id,value);return updated?response.json(updated):response.status(404).json({error:"Automation rule not found."}); });
  app.delete("/api/automation-rules/:id", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."});const id=parsePositiveInteger(request.params.id);if(!id)return response.status(400).json({error:"Invalid automation rule id."});return automationRepository.deleteAutomationRule(id)?response.status(204).send():response.status(404).json({error:"Automation rule not found."}); });
  app.get("/api/notifications", (request,response) => response.json(automationRepository.listNotifications(actor(request))));
  app.post("/api/notifications/:id/dismiss", (request,response) => {const id=parsePositiveInteger(request.params.id);if(!id)return response.status(400).json({error:"Invalid notification id."});return automationRepository.dismissNotification(actor(request),id)?response.status(200).json({dismissed:true}):response.status(404).json({error:"Notification not found."});});

  app.get("/api/tickets", (request, response) => {
    const page = parsePositiveInteger(request.query.page ?? 1), pageSize = parsePositiveInteger(request.query.pageSize ?? 10);
    const status = String(request.query.status ?? ""), priority = String(request.query.priority ?? ""), assignedAgent = String(request.query.assignedAgent ?? ""), customerId = request.query.customerId === undefined || request.query.customerId === "" ? undefined : parsePositiveInteger(request.query.customerId);
    if (!page || !pageSize || (status && !ticketStatuses.includes(status as typeof ticketStatuses[number])) || (priority && !ticketPriorities.includes(priority as typeof ticketPriorities[number])) || (request.query.customerId !== undefined && request.query.customerId !== "" && !customerId)) return response.status(400).json({ error: "Invalid ticket filters." });
    const user = getAuthenticatedUser(request, auth)!;
    evaluateVisibleTickets(request); const result = ticketRepository.listTickets(page, pageSize, { status: status as typeof ticketStatuses[number] || undefined, priority: priority as typeof ticketPriorities[number] || undefined, assignedAgent: user.role === "agent" ? user.email : assignedAgent || undefined, customerId });
    return response.json(user.role === "agent" ? { ...result, items: result.items.filter((ticket) => canAccessTicket(request, ticket)) } : result);
  });
  app.post("/api/tickets", (request, response) => {
    if (!isAdmin(request, auth)) return response.status(403).json({ error: "Administrator access required." });
    const { value, errors } = validateTicket(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors });
    if (!customerRepository.getCustomer(value.customerId)) return response.status(404).json({ error: "Customer not found." });
    try { let ticket=ticketRepository.createTicket(value, actor(request)); ticket=automationRepository.applySlaOnCreate(ticket); ticket=automationRepository.applyAutomation(ticket,actor(request)); return response.status(201).json(evaluateTicket(ticket,actor(request))); } catch { return response.status(500).json({ error: "Unable to save ticket." }); }
  });
  app.get("/api/tickets/:id", (request, response) => { const id = ticketId(request, response); if (!id) return; const ticket = requireTicketAccess(request, response, id); return ticket && response.json(evaluateTicket(ticket)); });
  app.patch("/api/tickets/:id", (request, response) => {
    const id = ticketId(request, response); if (!id) return; const { value, errors } = validateTicket(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors });
    if (!requireTicketAccess(request, response, id)) return;
    if (!isAdmin(request, auth) && value.assignedAgent.trim().toLowerCase() !== actor(request)) return response.status(403).json({ error: "Agents cannot reassign tickets." });
    if (!customerRepository.getCustomer(value.customerId)) return response.status(404).json({ error: "Customer not found." });
    try { let ticket = ticketRepository.updateTicket(id, value, actor(request)); if(ticket) ticket=automationRepository.applyAutomation(ticket,actor(request)); return ticket ? response.json(evaluateTicket(ticket,actor(request))) : response.status(404).json({ error: "Ticket not found." }); } catch { return response.status(500).json({ error: "Unable to update ticket." }); }
  });
  app.post("/api/tickets/:id/escalate", (request, response) => { const id = ticketId(request, response); if (!id || !requireTicketAccess(request, response, id)) return; try { const ticket = ticketRepository.escalateTicket(id, actor(request)); return ticket ? response.json(ticket) : response.status(404).json({ error: "Ticket not found." }); } catch { return response.status(500).json({ error: "Unable to escalate ticket." }); } });
  app.post("/api/tickets/:id/responded", (request,response) => {const id=ticketId(request,response);if(!id||!requireTicketAccess(request,response,id))return;const ticket=ticketRepository.markResponded(id,actor(request));return ticket?response.json(ticket):response.status(404).json({error:"Ticket not found."});});
  app.get("/api/tickets/:id/history", (request, response) => { const id = ticketId(request, response); if (!id || !requireTicketAccess(request, response, id)) return; return response.json(ticketRepository.listHistory(id)); });
  app.get("/api/tickets/:id/comments", (request, response) => { const id = ticketId(request, response); if (!id || !requireTicketAccess(request, response, id)) return; return response.json(agentWorkRepository.listComments(id)); });
  app.post("/api/tickets/:id/comments", (request, response) => {
    const id = ticketId(request, response); if (!id) return; const { value, errors } = validateComment(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors });
    if (!requireTicketAccess(request, response, id)) return; const database = customerRepository.getDatabase();
    try { database.exec("BEGIN"); const created = agentWorkRepository.createComment(id, value.body, actor(request)); ticketRepository.addInternalCommentHistory(id, created.id, actor(request)); database.exec("COMMIT"); return response.status(201).json(created); }
    catch { try { database.exec("ROLLBACK"); } catch { /* no open transaction */ } return response.status(500).json({ error: "Unable to add comment." }); }
  });
  app.get("/api/dashboard", (request, response) => {
    evaluateVisibleTickets(request);
    const owner = actor(request), assignedTickets = ticketRepository.listTickets(1, 50, { assignedAgent: owner }).items.filter((ticket) => ticket.assignedAgent.trim().toLowerCase() === owner);
    const allTickets = isAdmin(request, auth) ? ticketRepository.listTickets(1, 50).items : assignedTickets;
    return response.json({ assignedTickets, counts: { assigned: assignedTickets.length, open: allTickets.filter((ticket) => ticket.status === "open").length, pending: allTickets.filter((ticket) => ticket.status === "pending").length, urgent: allTickets.filter((ticket) => ticket.priority === "urgent").length }, tasks: agentWorkRepository.listTasks(owner), reminders: agentWorkRepository.listReminders(owner), notifications: automationRepository.listNotifications(owner), recentActivity: agentWorkRepository.listActivity(owner) });
  });
  app.get("/api/tasks", (request, response) => response.json(agentWorkRepository.listTasks(actor(request))));
  app.post("/api/tasks", (request, response) => { const { value, errors } = validateTask(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors }); try { return response.status(201).json(agentWorkRepository.createTask(actor(request), value)); } catch { return response.status(500).json({ error: "Unable to save task." }); } });
  app.patch("/api/tasks/:id", (request, response) => { const id = parsePositiveInteger(request.params.id); if (!id) return response.status(400).json({ error: "Invalid task id." }); const { value, errors } = validateTask(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors }); try { const updated = agentWorkRepository.updateTask(actor(request), id, value); return updated ? response.json(updated) : response.status(404).json({ error: "Task not found." }); } catch { return response.status(500).json({ error: "Unable to update task." }); } });
  app.post("/api/tasks/:id/complete", (request, response) => { const id = parsePositiveInteger(request.params.id); if (!id) return response.status(400).json({ error: "Invalid task id." }); try { const updated = agentWorkRepository.completeTask(actor(request), id); return updated ? response.json(updated) : response.status(404).json({ error: "Task not found." }); } catch { return response.status(500).json({ error: "Unable to complete task." }); } });
  app.delete("/api/tasks/:id", (request, response) => { const id = parsePositiveInteger(request.params.id); if (!id) return response.status(400).json({ error: "Invalid task id." }); return agentWorkRepository.deleteTask(actor(request), id) ? response.status(204).send() : response.status(404).json({ error: "Task not found." }); });
  app.get("/api/reminders", (request, response) => { const includeDismissed = request.query.includeDismissed === "true"; return response.json(agentWorkRepository.listReminders(actor(request), includeDismissed)); });
  app.post("/api/reminders", (request, response) => { const { value, errors } = validateReminder(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors }); try { return response.status(201).json(agentWorkRepository.createReminder(actor(request), value)); } catch { return response.status(500).json({ error: "Unable to save reminder." }); } });
  app.post("/api/reminders/:id/dismiss", (request, response) => { const id = parsePositiveInteger(request.params.id); if (!id) return response.status(400).json({ error: "Invalid reminder id." }); const updated = agentWorkRepository.dismissReminder(actor(request), id); return updated ? response.json(updated) : response.status(404).json({ error: "Reminder not found." }); });
  app.delete("/api/reminders/:id", (request, response) => { const id = parsePositiveInteger(request.params.id); if (!id) return response.status(400).json({ error: "Invalid reminder id." }); return agentWorkRepository.deleteReminder(actor(request), id) ? response.status(204).send() : response.status(404).json({ error: "Reminder not found." }); });
  app.get("/api/communication-channels", (_request, response) => response.json(communicationRepository.listChannels()));
  app.patch("/api/communication-channels/:type", (request, response) => { const type = request.params.type; if (!communicationChannelTypes.includes(type as typeof communicationChannelTypes[number]) || typeof request.body?.enabled !== "boolean") return response.status(400).json({ error: "Invalid channel." }); communicationRepository.setEnabled(type as typeof communicationChannelTypes[number], request.body.enabled); return response.json(communicationRepository.channel(type as typeof communicationChannelTypes[number])); });
  app.get("/api/customers/:id/communications", (request, response) => { const id = customerId(request,response); if (!id) return; return customerRepository.getCustomer(id) ? response.json(communicationRepository.list(id)) : response.status(404).json({error:"Customer not found."}); });
  app.get("/api/tickets/:id/communications", (request, response) => { const id = ticketId(request,response); if (!id || !requireTicketAccess(request, response, id)) return; return response.json(communicationRepository.list(undefined,id)); });
  app.get("/api/communications", (request, response) => {
    const customerId = request.query.customerId === undefined || request.query.customerId === "" ? undefined : parsePositiveInteger(request.query.customerId);
    const ticketId = request.query.ticketId === undefined || request.query.ticketId === "" ? undefined : parsePositiveInteger(request.query.ticketId);
    const channel = String(request.query.channel ?? "");
    if ((request.query.customerId !== undefined && request.query.customerId !== "" && !customerId) || (request.query.ticketId !== undefined && request.query.ticketId !== "" && !ticketId)) return response.status(400).json({ error: "Invalid communication filters." });
    if (channel && !communicationChannelTypes.includes(channel as typeof communicationChannelTypes[number])) return response.status(400).json({ error: "Invalid communication filters." });
    return response.json(communicationRepository.list(customerId, ticketId, channel ? channel as typeof communicationChannelTypes[number] : undefined));
  });
  app.post("/api/communications", (request, response) => {
    const { value, errors } = validateCommunication(request.body ?? {});
    if (Object.keys(errors).length) return response.status(400).json({ errors });
    if (!customerRepository.getCustomer(value.customerId)) return response.status(404).json({ error: "Customer not found." });
    if (!communicationRepository.channel(value.channel)) return response.status(404).json({ error: "Channel not found." });
    if (!communicationRepository.channel(value.channel)?.isEnabled) return response.status(403).json({ error: "Channel is disabled." });
    const database = customerRepository.getDatabase();
    try {
      database.exec("BEGIN");
      let ticketId = value.ticketId;
      if (ticketId !== null) {
        const ticket = ticketRepository.getTicket(ticketId);
        if (!ticket || ticket.customerId !== value.customerId) { database.exec("ROLLBACK"); return response.status(404).json({ error: "Ticket not found." }); }
      } else {
        const created = ticketRepository.createTicket({ customerId: value.customerId, subject: value.message.slice(0, 200), description: value.message, category: "Communication", priority: "medium", assignedAgent: "Unassigned", status: "new", dueDate: null }, actor(request));
        ticketId = created.id;
      }
      const communication = communicationRepository.create({ ...value, ticketId });
      ticketRepository.addCommunicationHistory(ticketId!, communication.id, actor(request));
      database.exec("COMMIT");
      return response.status(201).json(communication);
    } catch { try { database.exec("ROLLBACK"); } catch { /* no open transaction */ } return response.status(500).json({ error: "Unable to record communication." }); }
  });
  app.get("/api/articles", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."}); return response.json(knowledgeBaseRepository.list(Number(request.query.page??1),Number(request.query.pageSize??10),false,String(request.query.search??""),String(request.query.type??""),String(request.query.category??""))); });
  app.post("/api/articles", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."});const result=validateKnowledgeArticle(request.body??{});if(Object.keys(result.errors).length)return response.status(400).json({errors:result.errors});return response.status(201).json(knowledgeBaseRepository.create(result.value)); });
  app.get("/api/articles/:id", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."});const id=parsePositiveInteger(request.params.id);if(!id)return response.status(400).json({error:"Invalid article id."});const item=knowledgeBaseRepository.get(id);return item?response.json(item):response.status(404).json({error:"Article not found."}); });
  app.patch("/api/articles/:id", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."});const id=parsePositiveInteger(request.params.id),result=validateKnowledgeArticle(request.body??{});if(!id)return response.status(400).json({error:"Invalid article id."});if(Object.keys(result.errors).length)return response.status(400).json({errors:result.errors});const item=knowledgeBaseRepository.update(id,result.value);return item?response.json(item):response.status(404).json({error:"Article not found."}); });
  app.delete("/api/articles/:id", (request,response) => { if(!isAdmin(request,auth)) return response.status(403).json({error:"Administrator access required."});const id=parsePositiveInteger(request.params.id);if(!id)return response.status(400).json({error:"Invalid article id."});return knowledgeBaseRepository.delete(id)?response.status(204).send():response.status(404).json({error:"Article not found."}); });
  app.get("/api/public/articles", (request,response) => response.json(knowledgeBaseRepository.list(Number(request.query.page??1),Number(request.query.pageSize??10),true,String(request.query.search??""),String(request.query.type??""),String(request.query.category??""))));
  app.get("/api/public/articles/:id", (request,response) => { const id=parsePositiveInteger(request.params.id);if(!id)return response.status(404).json({error:"Article not found."});const item=knowledgeBaseRepository.get(id,true);return item?response.json(item):response.status(404).json({error:"Article not found."}); });
  function portalCustomer(request:Request,response:Response){const token=readCookie(request,"crm_portal");const customer=token?portalRepository.customerForToken(token):null;if(customer)return customer;const user=getAuthenticatedUser(request,auth);if(user?.role==="customer"){const record=customerRepository.getCustomerByEmail(user.email);if(record)return record.id;}response.status(401).json({error:"Portal verification required."});return null;}
  app.post("/api/public/portal-sessions",(request,response)=>{const result=validatePortalAccess(request.body??{});if(Object.keys(result.errors).length)return response.status(400).json({errors:result.errors});const customer=portalRepository.verify(result.value.email,result.value.ticketNumber);if(!customer)return response.status(404).json({error:"Portal record not found."});response.cookie("crm_portal",portalRepository.createSession(customer),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:3600000,path:"/"});return response.status(201).json({ok:true});});
  app.delete("/api/public/portal-sessions",(request,response)=>{const token=readCookie(request,"crm_portal");if(token)portalRepository.revoke(token);response.clearCookie("crm_portal",{httpOnly:true,sameSite:"lax",path:"/"});return response.status(204).send();});
  app.get("/api/public/portal/tickets",(request,response)=>{const customer=portalCustomer(request,response);return customer?response.json(portalRepository.list(customer)):undefined;});
  app.get("/api/public/portal/tickets/:ticketNumber",(request,response)=>{const customer=portalCustomer(request,response);if(!customer)return;const ticket=portalRepository.get(customer,String(request.params.ticketNumber).toUpperCase());return ticket?response.json(ticket):response.status(404).json({error:"Ticket not found."});});
  app.get("/api/public/portal/tickets/:ticketNumber/history",(request,response)=>{const customer=portalCustomer(request,response);if(!customer)return;const ticket=portalRepository.get(customer,String(request.params.ticketNumber).toUpperCase());return ticket?response.json(portalRepository.history(customer,ticket.ticketNumber)):response.status(404).json({error:"Ticket not found."});});
  app.post("/api/public/portal/tickets/:ticketNumber/feedback",(request,response)=>{const customer=portalCustomer(request,response);if(!customer)return;const result=validateTicketFeedback(request.body??{});if(Object.keys(result.errors).length)return response.status(400).json({errors:result.errors});const outcome=portalRepository.feedback(customer,String(request.params.ticketNumber).toUpperCase(),result.value);return outcome==="created"?response.status(201).json({ok:true}):outcome==="exists"?response.status(409).json({error:"Feedback has already been submitted."}):response.status(404).json({error:"Ticket not found."});});
  app.post("/api/public/web-requests", (request, response) => {
    const { value, errors } = validatePublicWebRequest(request.body ?? {});
    if (Object.keys(errors).length) return response.status(400).json({ errors });
    const customer = customerRepository.getCustomerByEmail(value.email);
    if (!customer) return response.status(404).json({ error: "Customer not found." });
    if (!communicationRepository.channel("web_form")?.isEnabled) return response.status(403).json({ error: "Web form is disabled." });
    const database = customerRepository.getDatabase();
    try {
      database.exec("BEGIN");
      const ticket = ticketRepository.createTicket({ customerId: customer.id, subject: value.subject, description: value.message, category: value.category ?? "Web form", priority: "medium", assignedAgent: "Unassigned", status: "new", dueDate: value.dueDate }, "web-form");
      const communication = communicationRepository.create({ customerId: customer.id, ticketId: ticket.id, channel: "web_form", message: value.message, sourceReference: null });
      ticketRepository.addCommunicationHistory(ticket.id, communication.id, "web-form");
      database.exec("COMMIT");
      return response.status(201).json({ ticketNumber: ticket.ticketNumber, portalUrl: `/portal?ticket=${ticket.ticketNumber}` });
    } catch { try { database.exec("ROLLBACK"); } catch { /* no open transaction */ } return response.status(500).json({ error: "Unable to submit request." }); }
  });
  app.use(express.static(join(projectRoot, "public")));

  app.post("/api/login", async (request, response) => {
    const credentials = request.body as { email?: string; password?: string };
    const validationError = validateLogin(credentials);
    if (validationError) return response.status(400).json({ error: validationError });

    const staffResult = await auth.login({ email: credentials.email!, password: credentials.password! });
    const result = staffResult ?? (customerRepository.verifyCustomerPassword(credentials.email!, credentials.password!) ? await auth.customerLogin(credentials.email!, credentials.password!) : null);
    if (!result) return response.status(401).json({ error: "Invalid email or password." });

    response.cookie(cookieName, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
      path: "/"
    });
    return response.json({ user: result.user });
  });

  app.post("/api/public/customer-login", async (request, response) => {
    const { email, password } = request.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return response.status(400).json({ error: "Enter a valid email and password." });
    }
    if (!customerRepository.verifyCustomerPassword(email.trim(), password)) {
      return response.status(401).json({ error: "Invalid email or password." });
    }
    const result = await auth.customerLogin(email.trim(), password);
    if (!result) return response.status(401).json({ error: "Invalid email or password." });
    response.cookie(cookieName, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
      path: "/"
    });
    return response.json({ user: result.user });
  });

  app.get("/api/me", (request, response) => {
    const user = getAuthenticatedUser(request, auth);
    return user ? response.json({ user }) : response.status(401).json({ error: "Authentication required." });
  });

  app.post("/api/logout", (request, response) => {
    auth.logout(readCookie(request, cookieName));
    response.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", path: "/" });
    return response.status(204).send();
  });

  app.get(protectedPagePaths, (request, response) => {
    if (!getAuthenticatedUser(request, auth)) return response.redirect("/");
    if (!isAdmin(request, auth) && !["/dashboard", "/tickets", "/tasks", "/activities"].includes(request.path)) return response.status(403).send("Administrator access required.");
    response.setHeader("Cache-Control", "no-store");
    return response.sendFile(join(projectRoot, "public", "index.html"));
  });

  app.get(customerDetailsPagePath, (request, response) => {
    if (!getAuthenticatedUser(request, auth)) return response.redirect("/");
    if (!isAdmin(request, auth)) return response.status(403).send("Administrator access required.");
    response.setHeader("Cache-Control", "no-store");
    return response.sendFile(join(projectRoot, "public", "index.html"));
  });

  app.get(ticketDetailsPagePath, (request, response) => {
    if (!getAuthenticatedUser(request, auth)) return response.redirect("/");
    response.setHeader("Cache-Control", "no-store");
    return response.sendFile(join(projectRoot, "public", "index.html"));
  });

  app.get("/support/request", (_request, response) => response.sendFile(join(projectRoot, "public", "support-request.html")));
  app.get("/knowledge-base", (_request,response) => response.sendFile(join(projectRoot,"public","knowledge-base.html")));
  app.get("/knowledge-base/:id", (_request,response) => response.sendFile(join(projectRoot,"public","knowledge-base.html")));
  app.get("/portal", (_request,response) => response.sendFile(join(projectRoot,"public","portal.html")));

  app.get("*", (_request, response) => response.sendFile(join(projectRoot, "public", "index.html")));
  return app;
}

const auth = new AuthService(process.env.CRM_SESSION_PATH ?? join(projectRoot, "data", "sessions.json"));
await auth.seedUser("demo@example.com", "Password123!");
await auth.seedUser("agent@example.com", "Password123!", "agent");
await auth.seedUser("customer@example.com", "Password123!", "customer");
const customerRepository = new CustomerRepository(createDatabase());
customerRepository.createCustomer({ firstName: "Demo", lastName: "Customer", email: "customer@example.com", phone: "", company: "", jobTitle: "", status: "active", address: "", notes: "", password: "Password123!" });
const app = createApp(auth, customerRepository);

if (process.env.NODE_ENV !== "test") {
  app.listen(Number(process.env.PORT ?? 3000), () => {
    console.log("CRM is running at http://localhost:3000");
  });
}
