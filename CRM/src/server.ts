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

const cookieName = "crm_session";
const projectRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const uploadDirectory = process.env.CRM_UPLOAD_DIR ?? join(projectRoot, "data", "uploads");
mkdirSync(uploadDirectory, { recursive: true });
const protectedPagePaths = ["/dashboard", "/customers", "/tickets", "/contacts", "/opportunities", "/tasks", "/activities"];
const customerDetailsPagePath = /^\/customers\/\d+$/;
const ticketDetailsPagePath = /^\/tickets\/\d+$/;
const protectedApiPaths = ["/api/customers", "/api/tickets", "/api/contacts", "/api/opportunities", "/api/tasks", "/api/activities"];
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

export function createApp(auth: AuthService, customerRepository = new CustomerRepository(createDatabase()), ticketRepository = new TicketRepository(customerRepository.getDatabase())) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));

  app.use(protectedApiPaths, (request, response, next) => {
    if (!getAuthenticatedUser(request, auth)) {
      return response.status(401).json({ error: "Authentication required." });
    }
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

  app.get("/api/tickets", (request, response) => {
    const page = parsePositiveInteger(request.query.page ?? 1), pageSize = parsePositiveInteger(request.query.pageSize ?? 10);
    const status = String(request.query.status ?? ""), priority = String(request.query.priority ?? ""), assignedAgent = String(request.query.assignedAgent ?? ""), customerId = request.query.customerId === undefined || request.query.customerId === "" ? undefined : parsePositiveInteger(request.query.customerId);
    if (!page || !pageSize || (status && !ticketStatuses.includes(status as typeof ticketStatuses[number])) || (priority && !ticketPriorities.includes(priority as typeof ticketPriorities[number])) || (request.query.customerId !== undefined && request.query.customerId !== "" && !customerId)) return response.status(400).json({ error: "Invalid ticket filters." });
    return response.json(ticketRepository.listTickets(page, pageSize, { status: status as typeof ticketStatuses[number] || undefined, priority: priority as typeof ticketPriorities[number] || undefined, assignedAgent: assignedAgent || undefined, customerId }));
  });
  app.post("/api/tickets", (request, response) => {
    const { value, errors } = validateTicket(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors });
    if (!customerRepository.getCustomer(value.customerId)) return response.status(404).json({ error: "Customer not found." });
    try { return response.status(201).json(ticketRepository.createTicket(value, actor(request))); } catch { return response.status(500).json({ error: "Unable to save ticket." }); }
  });
  app.get("/api/tickets/:id", (request, response) => { const id = ticketId(request, response); if (!id) return; const ticket = ticketRepository.getTicket(id); return ticket ? response.json(ticket) : response.status(404).json({ error: "Ticket not found." }); });
  app.patch("/api/tickets/:id", (request, response) => {
    const id = ticketId(request, response); if (!id) return; const { value, errors } = validateTicket(request.body ?? {}); if (Object.keys(errors).length) return response.status(400).json({ errors });
    if (!customerRepository.getCustomer(value.customerId)) return response.status(404).json({ error: "Customer not found." });
    try { const ticket = ticketRepository.updateTicket(id, value, actor(request)); return ticket ? response.json(ticket) : response.status(404).json({ error: "Ticket not found." }); } catch { return response.status(500).json({ error: "Unable to update ticket." }); }
  });
  app.post("/api/tickets/:id/escalate", (request, response) => { const id = ticketId(request, response); if (!id) return; try { const ticket = ticketRepository.escalateTicket(id, actor(request)); return ticket ? response.json(ticket) : response.status(404).json({ error: "Ticket not found." }); } catch { return response.status(500).json({ error: "Unable to escalate ticket." }); } });
  app.get("/api/tickets/:id/history", (request, response) => { const id = ticketId(request, response); if (!id) return; return ticketRepository.getTicket(id) ? response.json(ticketRepository.listHistory(id)) : response.status(404).json({ error: "Ticket not found." }); });
  app.use(express.static(join(projectRoot, "public")));

  app.post("/api/login", async (request, response) => {
    const credentials = request.body as { email?: string; password?: string };
    const validationError = validateLogin(credentials);
    if (validationError) return response.status(400).json({ error: validationError });

    const result = await auth.login({ email: credentials.email!, password: credentials.password! });
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
    response.setHeader("Cache-Control", "no-store");
    return response.sendFile(join(projectRoot, "public", "index.html"));
  });

  app.get(customerDetailsPagePath, (request, response) => {
    if (!getAuthenticatedUser(request, auth)) return response.redirect("/");
    response.setHeader("Cache-Control", "no-store");
    return response.sendFile(join(projectRoot, "public", "index.html"));
  });

  app.get(ticketDetailsPagePath, (request, response) => {
    if (!getAuthenticatedUser(request, auth)) return response.redirect("/");
    response.setHeader("Cache-Control", "no-store");
    return response.sendFile(join(projectRoot, "public", "index.html"));
  });

  app.get("*", (_request, response) => response.sendFile(join(projectRoot, "public", "index.html")));
  return app;
}

const auth = new AuthService(process.env.CRM_SESSION_PATH ?? join(projectRoot, "data", "sessions.json"));
await auth.seedUser("demo@example.com", "Password123!");
const app = createApp(auth);

if (process.env.NODE_ENV !== "test") {
  app.listen(Number(process.env.PORT ?? 3000), () => {
    console.log("CRM is running at http://localhost:3000");
  });
}
