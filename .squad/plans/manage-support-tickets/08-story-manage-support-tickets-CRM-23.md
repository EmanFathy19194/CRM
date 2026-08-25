# Story 08 — Manage Support Tickets (Story: CRM-23)

## Prerequisites

- Story 07 completed: [07-story-manage-customer-records-CRM-22.md](../manage-customer-records/07-story-manage-customer-records-CRM-22.md). Reuse its protected customer APIs, SQLite foreign-key convention, validation boundary, responsive page conventions, and authenticated API tests.
- Preserve the existing in-memory authenticated-user contract in `CRM/src/auth.ts` (lines 5–40). This story stores an assigned-agent value and the authenticated actor in ticket history; it does not introduce user administration or a persisted agents directory.

---

## Story Goal

Allow an authenticated support agent to create, view, edit, assign, prioritize, escalate, and resolve support tickets that are linked to an existing customer.

1. Generate a stable ticket number automatically and persist the ticket’s customer, subject, description, category, priority, assignee, status, created date, and due date.
2. Record an immutable history event at creation and for every status, priority, and assignment change; record escalation as its own event.
3. Provide protected ticket list and detail experiences that make the current state and chronological history visible.

Customer management, a directory of support agents, ticket comments/attachments, SLA calculation, notifications, and deletion are out of scope.

---

## Context — Read These Files First

1. `CRM/src/database.ts` — Read `createDatabase` at lines 7–52. Add idempotent ticket tables and indexes inside this initialization block; preserve `PRAGMA foreign_keys = ON` and existing customer tables.
2. `CRM/src/customer.ts` — Read `Customer`, `CustomerNote`, and `CustomerInteraction` at lines 4–47. Add the public ticket/history contracts beside these API response types; keep server-generated identifiers and timestamps distinct from client input.
3. `CRM/src/customer-repository.ts` — Read `CustomerRepository` customer CRUD at lines 17–62 and customer-scoped persistence methods at lines 64–130. Follow its parameterized-query and row-mapper style in a new focused ticket repository instead of coupling ticket queries to customer CRUD.
4. `CRM/src/customer-validation.ts` — Read its exported validation functions and limits before adding ticket validation. Match its normalization and `{ value, errors }` response pattern.
5. `CRM/src/server.ts` — Read protected API middleware at lines 34–43, customer routes at lines 45–107, and protected-page handling at lines 140–152. Add the ticket API namespace to the same session guard; use `getAuthenticatedUser` at lines 30–32 to record the actor email for history entries.
6. `CRM/src/auth.ts` — Read `PublicUser` and `getUser` at lines 5–40. Use the authenticated user’s `email` as `changedBy`; do not add a second identity store for this story.
7. `CRM/public/pages/shared.ts` — Read `protectedPages`, `renderProtectedShell`, and `route` at lines 1–58. Add the Tickets navigation entry and direct detail-route dispatch while retaining the `/customers/:id` route behavior.
8. `CRM/public/pages/customers.ts` — Read `renderCustomers`, action handling, and form submission around lines 5–56. Follow its protected fetch, pending-control, form-feedback, and pagination conventions for ticket list mutations.
9. `CRM/public/pages/customer-details.ts` — Read the loading/fetch/render/action sequence at lines 9–36. Use the same direct-load, not-found, escaped rendering, and Back-navigation pattern for ticket details.
10. `CRM/public/index.html` — Read protected layout and shared customer styles at lines 34–85. Extend the existing design system with ticket list, detail, form, badge, and history styles plus narrow-screen behavior.
11. `CRM/tests/auth.test.ts` — Read authenticated API setup at lines 85–116 and associated-record coverage at lines 162–184. Reuse `request.agent(createApp(auth, repository))` with `createDatabase(":memory:")` for protected ticket integration coverage.
12. `.squad/stories/manage-support-tickets/CRM-23/intake.md` — Use the CRM-23 description and acceptance criteria as the product contract; it declares no attachments.
13. [Story 07 plan](../manage-customer-records/07-story-manage-customer-records-CRM-22.md) — Follow the established customer-association and history-table approach, while keeping ticket concerns in new focused files.

---

## Product rules (from story)

- Status accepts exactly `new`, `open`, `in_progress`, `pending`, `resolved`, or `closed`; priority accepts exactly `low`, `medium`, `high`, or `urgent`.
- A ticket must reference an existing customer. Return `404` for an unknown customer id; never persist an unverified id.
- `ticketNumber` is generated on the server after the database assigns the numeric id, formatted as `TKT-` plus a six-digit zero-padded id (for example, `TKT-000001`). It is immutable and unique.
- `assignedAgent` is a required, normalized display/email string; without a persisted agent directory, the API validates and stores the supplied value and records the authenticated user’s email as `changedBy` in the history event.
- An escalation sets persistent `isEscalated` to `true` and appends an `escalated` history event. Repeating escalation is idempotent: retain the `true` value and do not add a duplicate event.
- Every successful create, general edit, status change, priority change, assignment change, and first escalation appends an immutable history row. A single update that changes multiple tracked fields appends one event per changed field, in deterministic insertion order.

## Backend Tasks

### 1 — Define ticket contracts, validation, and schema

- **Create file: `CRM/src/ticket.ts`**. Export literal status, priority, and history-action arrays/types plus public `SupportTicket`, `TicketHistoryEntry`, and `CreateTicketInput` contracts. Include `customerId`, `ticketNumber`, `subject`, `description`, `category`, `priority`, `assignedAgent`, `status`, `isEscalated`, `createdAt`, `updatedAt`, and nullable `dueDate` fields in the response contract.
- **Create file: `CRM/src/ticket-validation.ts`**. Export `validateTicket(input: unknown)` and a focused positive-integer parser. Require a valid existing-customer id candidate, trimmed subject/description/category/assigned-agent strings within explicit UI-aligned limits, allowed status/priority values, and an optional ISO calendar `dueDate`. Normalize the empty due date to `null`; reject malformed dates rather than relying on SQLite coercion.
- **Modify `CRM/src/database.ts`** at lines 7–52. Create `support_tickets` with a foreign-key `customer_id REFERENCES customers(id)`, unique non-null `ticket_number`, required core fields, a nullable `due_date`, non-null `is_escalated` default `0`, and created/updated timestamps. Create `ticket_history` with foreign-key `ticket_id REFERENCES support_tickets(id) ON DELETE CASCADE`, action, old/new values nullable as appropriate, non-null `changed_by`, and timestamp. Add indexes for ticket list sorting/filtering and `(ticket_id, created_at, id)` history retrieval.

### 2 — Persist tickets and history atomically

- **Create file: `CRM/src/ticket-repository.ts`**. Implement a `TicketRepository` receiving `DatabaseSync`, with parameterized `createTicket`, `listTickets`, `getTicket`, `updateTicket`, `escalateTicket`, and `listHistory` methods plus private row mappers.
- In `createTicket`, use one SQLite transaction: insert the ticket, derive `ticketNumber` from its `lastInsertRowid`, update the inserted row, append a `created` history event, and return the mapped ticket. Never accept a client-supplied ticket number, id, timestamps, escalation state, or actor.
- In `updateTicket`, first load the ticket, update only validated mutable columns, compare persisted versus new values, and insert the applicable `updated`, `status_changed`, `priority_changed`, and `assignment_changed` entries with `changedBy`. Return `null` when the ticket is absent. Keep the update and all history inserts in one transaction.
- In `escalateTicket`, load by id, return `null` when absent, set `is_escalated` and insert the `escalated` event only when it was previously false, then return the current ticket. Order lists and history by `created_at DESC, id DESC` for deterministic newest-first views.
- Join `customers` in ticket list/detail queries to return a safe customer display name and email needed by the UI, but keep `CustomerRepository` as the source of customer CRUD.

### 3 — Expose protected ticket APIs

- **Modify `CRM/src/server.ts`** at lines 18–21 and 34–43 to add `/api/tickets` to `protectedApiPaths`, construct/inject a `TicketRepository` alongside the existing `CustomerRepository`, and retain JSON `401` responses for all ticket endpoints.
- Add `GET /api/tickets` with validated page/pageSize plus optional status, priority, assigned-agent, and customer-id filters; return the same `{ items, page, pageSize, total, totalPages }` shape used by `listCustomers` at `CRM/src/customer-repository.ts` lines 31–43.
- Add `POST /api/tickets`, `GET /api/tickets/:id`, `PATCH /api/tickets/:id`, `POST /api/tickets/:id/escalate`, and `GET /api/tickets/:id/history`. Before creates, verify `customerRepository.getCustomer(customerId)`; before reads/mutations, validate the ticket id as a positive integer.
- Use the result of `getAuthenticatedUser(request, auth)` as the non-null history actor after middleware authorization. Return `201` for create, `200` for reads/updates/escalation, `400` for malformed input, `404` for missing ticket/customer, and a generic `500` response for persistence failures. Do not expose SQLite errors or stack traces.

## Frontend Tasks

### 4 — Add ticket routes, navigation, and ticket list/create page

- **Modify `CRM/public/pages/shared.ts`** at lines 1–8 and 48–58. Add `/tickets: "Tickets"` to `protectedPages`, recognize `/tickets/:id` in route validation, dispatch `/tickets` to `renderTickets`, and dispatch direct detail URLs to `renderTicketDetails`. Preserve session re-check, logout, and all existing routes.
- **Create file: `CRM/public/pages/tickets.ts`**. Render a protected ticket list with ticket number, customer, subject, category, priority, assignee, status, created/due dates, escalation state, filters, pagination, and a View action. Use `escapeHtml` for every API-provided value and `credentials: "same-origin"` on every request.
- In the same page, render an add-ticket form. Load/select customers from the existing protected customer API, prefill `assignedAgent` only after calling `/api/me`, and submit the customer id, subject, description, category, priority, assigned agent, status, and optional due date to `POST /api/tickets`. The browser must never submit a ticket number, history payload, actor, or escalation flag.
- Disable the submitted control while pending, retain field values and display API validation errors on failure, reset and refresh only after a `201`, and route the user to the new ticket detail page.

### 5 — Add ticket detail and management UI

- **Create file: `CRM/public/pages/ticket-details.ts`**. Follow `renderCustomerDetails` at `CRM/public/pages/customer-details.ts` lines 9–36: render a loading state, fetch ticket and history in parallel, show a recoverable not-found state, and provide Back to tickets navigation.
- Display all ticket information, customer identity/link, generated ticket number, escalation state, and an immutable history timeline. Render `created`, `updated`, `status_changed`, `priority_changed`, `assignment_changed`, and `escalated` entries with changed-by and timestamp metadata; label missing old/new values safely.
- Provide an edit form for mutable ticket fields, dedicated status/priority/assignee controls, and an Escalate action. Send changes through `PATCH /api/tickets/:id` and escalation through `POST /api/tickets/:id/escalate`; disable each active control while pending and reload current ticket/history only after success.
- **Modify `CRM/public/index.html`** at lines 34–85. Add shared ticket-grid, filter, form, priority/status, escalation, and timeline styles. Preserve the existing protected-shell palette and make table/list data, long descriptions, agent strings, and history values wrap without horizontal overflow below the 720px breakpoint.

## Edge Cases & Failure Modes

- Unknown, zero, negative, decimal, or nonnumeric customer/ticket ids: return `400` for malformed ids and `404` for valid-but-absent records before repository mutation; enforce in the ticket handlers added beside `CRM/src/server.ts` lines 65–96.
- Ticket creation references a deleted or nonexistent customer: return `404`, write neither a ticket nor history entry, and keep the form values; enforce customer verification in the new create handler and the foreign key in `CRM/src/database.ts`.
- Missing/expired session: every `/api/tickets` endpoint returns the existing JSON `401`, and ticket pages route to login; enforce through the expanded guard at `CRM/src/server.ts` lines 38–43 and `route` at `CRM/public/pages/shared.ts` lines 48–58.
- Invalid status, priority, date, empty/oversize subject, description, category, or assignee: return field errors with `400`, persist nothing, and display them beside the form; enforce in `CRM/src/ticket-validation.ts` and the ticket form handlers.
- Concurrent creates: ticket numbers remain unique because they derive from SQLite’s inserted primary key inside the creation transaction; enforce in `TicketRepository.createTicket` and the unique `ticket_number` constraint.
- Concurrent updates: each accepted update writes its ticket row and history events in one transaction. If a request fails, return `500` and do not claim success in the UI; enforce in `CRM/src/ticket-repository.ts` and `CRM/src/server.ts`.
- Repeated escalation: leave the ticket escalated and do not append a duplicate `escalated` history row; enforce in `TicketRepository.escalateTicket` and disable/label the detail action after refresh.
- Status, priority, and assignment changed in one edit: append one history event for each changed tracked field, with the persisted old and submitted new values; enforce in `TicketRepository.updateTicket`.
- Unsafe Unicode or HTML in customer, ticket, agent, and history fields: retain valid text but escape it before `innerHTML`; enforce through `escapeHtml` at `CRM/public/pages/shared.ts` lines 10–12 and the new ticket renderers.
- Empty ticket result/history lists: render explicit empty states while keeping creation and filter controls available; enforce in `CRM/public/pages/tickets.ts` and `CRM/public/pages/ticket-details.ts`.

## Test Plan

1. **Unit — create `CRM/tests/ticket-validation.test.ts`:** cover required fields, normalization, every accepted status/priority, rejected values, positive ids, nullable valid due date, malformed due date, and text-length boundaries.
2. **Unit — create `CRM/tests/ticket-repository.test.ts`:** use `createDatabase(":memory:")` to verify generated `TKT-000001` numbering, customer linkage, parameterized filters/pagination, deterministic list/history order, immutable history, and transaction-backed multi-field updates.
3. **Integration — create `CRM/tests/tickets.test.ts`:** follow the authenticated setup from `CRM/tests/auth.test.ts` lines 85–116. Cover create/list/detail/edit/status/priority/assignment/escalation/history endpoints, status/priority filters, generated number, due date, and customer-not-found rejection.
4. **Integration — `CRM/tests/tickets.test.ts`:** assert unauthenticated ticket APIs return `401`; assert invalid ids/payloads return `400`; assert missing tickets return `404`; assert repeated escalation does not create a second escalation history entry.
5. **Browser smoke:** verify Tickets navigation, creation, filter/pagination, direct `/tickets/:id` reload, editing, each status/priority control, assignee change, escalation, history display, error states, and responsive narrow-screen layout.
6. **Regression:** retain all login, protected page/API, customer, note, interaction, attachment, and navigation checks in `CRM/tests/auth.test.ts`.

## Migration / Rollback

- The schema change is additive: `CREATE TABLE IF NOT EXISTS` adds `support_tickets`, `ticket_history`, and indexes without modifying existing customer rows.
- If deployment fails after schema initialization but before application rollout, keep the additive empty tables; the previous application ignores them. Do not drop populated ticket/history tables as a rollback shortcut.
- If ticket creation fails during a partially applied write, the repository transaction must roll back the ticket-number update and all history rows together, leaving no ticket without its required `created` event.

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, log in, create a customer if needed, create a ticket, filter the Tickets list, open its detail page, edit its status/priority/assignee, escalate it, and confirm each expected history event and responsive layout.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm TypeScript compiles the new ticket contracts, repository, routes, pages, and copied client assets.
3. **Regression:** from `CRM/`, run `npm test` and confirm existing authentication/customer coverage plus ticket validation, repository, and API tests pass.

## Done Criteria

- [ ] Authenticated users can create tickets with a server-generated immutable ticket number and all required ticket information.
- [ ] Tickets are associated only with an existing customer and expose the correct customer in list/detail views.
- [ ] Users can view and edit tickets, including valid status, priority, and assigned-agent changes.
- [ ] Users can set New, Open, In Progress, Pending, Resolved, and Closed statuses.
- [ ] Users can set Low, Medium, High, and Urgent priorities.
- [ ] Users can escalate a ticket, and repeated escalation is idempotent.
- [ ] Ticket history records creation, edits, status changes, priority changes, assignment changes, and escalation with actor and timestamp.
- [ ] Invalid input, unauthorized access, missing tickets/customers, and persistence errors receive recoverable non-sensitive responses.
- [ ] Existing authentication, protected customer workflows, navigation, and tests continue to pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 09.**
