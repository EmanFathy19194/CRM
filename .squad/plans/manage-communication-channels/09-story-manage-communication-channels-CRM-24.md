# Story 09 — Manage Communication Channels (Story: CRM-24)

## Prerequisites

- Story 08 completed: [08-story-manage-support-tickets-CRM-23.md](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md). Reuse its customer-backed `SupportTicket`, generated `ticketNumber`, protected API pattern, and ticket-history actor convention.
- Preserve the protected customer and ticket contracts while coordinating any shared database/repository changes between the communication and ticket owners. **Do not** add live credentials or call external Email, WhatsApp, SMS, or chat providers in this story.

---

## Story Goal

Let support agents record and view customer communications received through configured channels, link each communication to a ticket, and create or update tickets from incoming requests. Provide a public web form that creates a support ticket and immediately returns its reference number.

1. Configure and enable Email, WhatsApp, Live Chat, SMS, and Web Form channels in the CRM.
2. Persist inbound communication history against an existing customer, optionally linked to an existing ticket.
3. Let an incoming communication create a new ticket or update an existing ticket with a communication history entry.
4. Let customers submit an existing-customer web request and receive the created ticket number.

Real provider webhooks, outbound delivery, customer registration, notifications, file attachments, and automated agent routing are out of scope.

---

## Product rules (from story)

- Store one channel configuration per supported channel type: `email`, `whatsapp`, `live_chat`, `sms`, and `web_form`. Each has a display name and enabled flag; seed all five enabled so the system supports every listed channel without external credentials.
- A communication is inbound-only for this story. It has a channel, customer, message body, received timestamp, optional ticket id, and source/reference value. Link to a ticket only when that ticket belongs to the same customer.
- An incoming request either links to an existing ticket or creates one; it never does both. Creating a ticket delegates number generation and the `created` event to `TicketRepository.createTicket`.
- Updating an existing ticket appends a `communication_received` ticket-history event without changing ticket status, priority, assignee, or customer fields.
- The public web form accepts an existing customer email, subject, message, optional category, and optional due date. It creates a `new`/`medium` ticket assigned to `Unassigned`, records a `web_form` communication, and returns only the generated `ticketNumber`.
- Unknown customer email, unknown/disabled channel, invalid or cross-customer ticket id, and invalid payloads do not create a communication or ticket.

## Context — Read These Files First

1. `CRM/src/database.ts` — Read `createDatabase` at lines 44–72. Add idempotent communication channel and communication-history tables beside the existing customer and ticket tables; retain foreign keys and `ON DELETE CASCADE` where the related ticket is removed.
2. `CRM/src/ticket.ts` — Read ticket contracts and literal arrays before extending the ticket-history action union with `communication_received`; preserve `SupportTicket` and its server-generated `ticketNumber`.
3. `CRM/src/ticket-repository.ts` — Read `createTicket` at lines 20–28, list/detail mapping at lines 29–41, and `updateTicket`/`listHistory` at lines 42–56. Add a focused repository method that inserts a communication history event without running the mutable ticket-update comparison logic.
4. `CRM/src/ticket-validation.ts` — Read `parsePositiveInteger` and `validateTicket` before creating communication validators. Reuse the positive-id boundary and match the `{ value, errors }` response style.
5. `CRM/src/customer-repository.ts` — Read `getCustomer` and `listCustomers` before adding only the safe customer lookup needed to resolve web-form emails. Do not duplicate customer mapping or mutate customer records from a communication.
6. `CRM/src/server.ts` — Read ticket id validation and protected ticket handlers at lines 114–139 plus the public login/API boundary at lines 140–168. Keep agent communication routes under the existing authenticated middleware and place the public web-form endpoint outside it.
7. `CRM/public/pages/shared.ts` — Read `protectedPages` and `route` at lines 1–60. Add a protected Communications destination and direct communication/ticket links without weakening its `/api/me` session check.
8. `CRM/public/pages/tickets.ts` — Read ticket list/form retrieval and creation at lines 11–26. Reuse `credentials: "same-origin"`, `escapeHtml`, loading/error rendering, and ticket detail navigation in agent communication views.
9. `CRM/public/pages/ticket-details.ts` — Read `renderTicketDetails` and its API mutation pattern. Add a ticket communication timeline/entry point without exposing customer messages to unauthenticated pages.
10. `CRM/public/index.html` — Read ticket-related shared styles at lines 67–86. Extend the existing responsive design system for channel configuration, communication rows, and history timeline elements.
11. `CRM/tests/tickets.test.ts` — Read the authenticated setup and ticket lifecycle assertions at lines 8–42. Reuse the in-memory database and `request.agent(createApp(auth, repository))` pattern for communication integration tests.
12. `.squad/stories/manage-communication-channels/CRM-24/intake.md` — Use CRM-24 as the product contract; its attachment list is empty.
13. [Story 08 plan](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md) — Follow the existing protected ticket and history conventions.

---

## Backend Tasks

### 1 — Add communication contracts, validation, and persistence

- **Create file: `CRM/src/communication.ts`**. Export literal `communicationChannelTypes` (`email`, `whatsapp`, `live_chat`, `sms`, `web_form`), `CommunicationChannel`, `CustomerCommunication`, `CreateCommunicationInput`, and public-web-request input/response contracts. Keep internal source/reference data separate from the safe API response.
- **Create file: `CRM/src/communication-validation.ts`**. Validate allowed channels, required positive customer id, optional positive ticket id, non-empty trimmed message (maximum 2,000 characters), bounded source reference, and public web-form email/subject/message/category/due-date fields. Normalize empty optional values to `null`.
- **Modify `CRM/src/database.ts`** at lines 52–71. Create `communication_channels` keyed by channel type with `display_name` and `is_enabled`; insert each of the five configured defaults idempotently. Create `customer_communications` with foreign keys to `customers`, `support_tickets` (nullable, `ON DELETE SET NULL`), and `communication_channels`, plus `message`, source reference, and `received_at`. Add customer-, ticket-, and received-time indexes for deterministic history queries.
- **Modify `CRM/src/ticket.ts`** to add `communication_received` to `ticketHistoryActions`. This makes the new history event type explicit and exhaustively renderable.

### 2 — Add parameterized communication and ticket-history operations

- **Create file: `CRM/src/communication-repository.ts`**. Implement `listChannels`, `setChannelEnabled`, `getChannel`, `createCommunication`, `listCustomerCommunications`, and `listTicketCommunications` using parameterized SQLite queries and newest-first ordering by `received_at DESC, id DESC`.
- **Modify `CRM/src/ticket-repository.ts`** at lines 15–56. Add `addCommunicationHistory(ticketId, communicationId, changedBy)` that inserts exactly one `communication_received` row. Store the communication id as the new value, retain the authenticated actor, and do not alter ticket fields.
- In the server orchestration, use one database transaction when an incoming communication creates a ticket: validate channel/customer first; create the ticket; insert the communication with that ticket id; insert the `communication_received` event; commit only after all three succeed. On failure, roll back all related rows.

### 3 — Expose agent and public web-form APIs

- **Modify `CRM/src/server.ts`** at lines 114–139. Add `/api/communications` to `protectedApiPaths`, construct the communication repository from the same database connection, and expose:
  - `GET /api/communication-channels` and `PATCH /api/communication-channels/:type` for configured-channel visibility and enabled-state changes.
  - `GET /api/communications` with validated customer, ticket, and channel filters.
  - `POST /api/communications` for authenticated agents to record an inbound message, either linked to an existing same-customer ticket or creating a ticket from its validated ticket payload.
  - `GET /api/customers/:id/communications` and `GET /api/tickets/:id/communications` for scoped history sections.
- Add `POST /api/public/web-requests` **outside** the authenticated middleware. Resolve its normalized customer email against existing customers, require that `web_form` is enabled, create the default ticket/communication atomically with actor `web-form`, and return `{ ticketNumber }` with `201`.
- Return `400` for malformed input, `403` for disabled channels, `404` for unknown customer/ticket/channel, `401` for unauthenticated agent endpoints, `201` for creates, and generic `500` JSON for persistence faults. Never expose database diagnostics or customer data in the public response.
- Add `GET /support/request` to serve the public request asset without the protected-page redirect. Leave all existing protected page/API routes unchanged.

## Frontend Tasks

### 4 — Build protected communication configuration and history views

- **Modify `CRM/public/pages/shared.ts`** at lines 1–60. Add `/communications: "Communications"` to `protectedPages` and dispatch it to the new renderer while retaining existing protected navigation and direct ticket/customer routes.
- **Create file: `CRM/public/pages/communications.ts`**. Render channel configuration with all five types and enable/disable controls, a communication list with channel/customer/ticket/message/received date, filters, loading/error/empty states, and an agent form for recording incoming Email, WhatsApp, Live Chat, or SMS messages.
- The agent form must load customer choices through the protected customer API, optionally load/link an existing ticket for that customer, or expose a create-ticket section that submits the required ticket data together with the incoming communication. Disable the active control while pending and refresh only after a successful response.
- **Modify `CRM/public/pages/customer-details.ts`**. Fetch and render a customer communication-history section using `GET /api/customers/:id/communications`; link associated ticket numbers to their protected ticket detail route.
- **Modify `CRM/public/pages/ticket-details.ts`**. Fetch and render ticket communication history using `GET /api/tickets/:id/communications` alongside the existing immutable ticket history; keep messages escaped and read-only.

### 5 — Build the public web request experience

- **Create file: `CRM/public/support-request.html`** and **create file: `CRM/public/support-request.ts`**. Provide a standalone public form for customer email, subject, message, optional category, and optional due date. Submit only to `/api/public/web-requests`; do not depend on a session, agent route, or protected shell.
- After a `201`, replace the form feedback with the returned reference in the exact form `Your support reference is "TKT-000001".` Do not show customer details, ticket internals, history, or agent assignment.
- Keep invalid fields in place, render generic server failures without internal details, escape dynamic reference/error text, and prevent duplicate submits by disabling the submit button while the request is pending.
- **Modify `CRM/public/index.html`** at lines 67–86 only for protected communication list/configuration/history styles and responsive wrapping. Put public form styles in `CRM/public/support-request.html` so it remains independent of the authenticated app shell.

## Edge Cases & Failure Modes

- Unknown/disabled channel: return `404`/`403`, do not create a communication or ticket; enforce in `CRM/src/server.ts` and `CRM/src/communication-repository.ts` before the transaction.
- Malformed ids, empty/oversized message, invalid channel, invalid web email/date, or incomplete embedded ticket fields: return field-level `400` with no writes; enforce in `CRM/src/communication-validation.ts` and existing `validateTicket`.
- Incoming communication links to a ticket belonging to another customer: return `404`, make no mutation, and enforce with a customer-and-ticket scoped repository lookup.
- New-ticket communication transaction fails: roll back ticket, communication, and ticket-history operations together; enforce in the shared database transaction. Do not leave a ticket reference without its communication record.
- Existing-ticket communication transaction fails: leave neither the communication nor `communication_received` event persisted; enforce in the same transaction.
- Repeated source/reference delivery: persist each independently supplied inbound message; do not deduplicate without a provider-stable id, which is out of scope.
- Unknown public customer email: return a generic `404`/validation response without revealing other customer data; enforce in `POST /api/public/web-requests`.
- Anonymous web requests: always create `new`/`medium` tickets assigned to `Unassigned`, record actor `web-form`, and never permit the public caller to set status, priority, assignee, customer id, or ticket id.
- Unsafe HTML or Unicode in messages, source values, ticket/customer labels, and public feedback: preserve valid text and escape before HTML insertion; enforce through `escapeHtml` in the new/modified page renderers.
- Empty communication history: render an explicit empty state while leaving agent entry/configuration controls available; enforce in communications, customer-detail, and ticket-detail renderers.

## Test Plan

1. **Unit — create `CRM/tests/communication-validation.test.ts`:** test all five channel types, required/maximum message rules, ids, source references, web-form email/date validation, and normalization of optional ticket/category/due-date values.
2. **Unit — create `CRM/tests/communication-repository.test.ts`:** use `createDatabase(":memory:")` to assert idempotent default channels, enabled-state persistence, parameterized filtering, nullable ticket links, and deterministic customer/ticket ordering.
3. **Integration — create `CRM/tests/communications.test.ts`:** follow `CRM/tests/tickets.test.ts` lines 8–42. Test authenticated channel configuration, incoming messages for all configured channels, customer/ticket communication history, create-ticket flow, existing-ticket update flow, and exactly one `communication_received` history event.
4. **Integration — `CRM/tests/communications.test.ts`:** test `401` agent access, invalid/disabled channels, missing/malformed/cross-customer ids, transaction rollback behavior, and non-sensitive `500` responses.
5. **Integration — `CRM/tests/public-web-request.test.ts`:** test the unauthenticated web endpoint creates a new ticket plus `web_form` communication, returns only the generated `ticketNumber`, and rejects unknown emails/invalid payloads/disabled web form without writes.
6. **Browser smoke:** test agent Communications navigation, channel toggles, communication entry/list filters, customer/ticket history sections, the standalone `/support/request` form, receipt message, validation, duplicate-submit prevention, and narrow-screen layout.
7. **Regression:** run the existing `CRM/tests/auth.test.ts` and `CRM/tests/tickets.test.ts` suites to retain login/session, customer, ticket, history, and protected-route behavior.

## Migration / Rollback

- The migration is additive: it creates channel and communication tables/indexes and seeds configuration rows without modifying customer or ticket rows.
- If deployment stops after schema initialization, retain the new empty/default channel tables; the prior application ignores them. Do not drop populated communication history during rollback.
- On a half-failed incoming request, rely on the repository transaction to roll back all affected ticket, communication, and history rows. Repair data manually only if an external operator bypassed the application transaction.

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, log in, enable/disable a configured channel, record an incoming message linked to a customer/ticket and one that creates a ticket, then confirm both customer/ticket timelines. Open `/support/request` in a signed-out browser session and confirm the reference response.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm the new contracts, repositories, routes, protected pages, and standalone public asset compile/copy.
3. **Regression:** from `CRM/`, run `npm test` and confirm all existing authentication/customer/ticket tests plus communication and public-request coverage pass.

## Done Criteria

- [ ] Email, WhatsApp, Live Chat, SMS, and Web Form are visible as configured communication channels and can be enabled/disabled by an authenticated agent.
- [ ] Agents can record incoming customer communications and view persisted customer communication history.
- [ ] A communication can be linked only to a ticket owned by its customer and is visible in the ticket history view.
- [ ] Incoming communication can create a ticket or update an existing ticket, with a persisted `communication_received` history event.
- [ ] Customers can submit a signed-out web request using their existing email.
- [ ] A valid web request creates a ticket and web-form communication, then returns only its generated ticket/reference number.
- [ ] Invalid/disabled channels, malformed/cross-customer inputs, unknown public customers, and failed transactions produce recoverable non-sensitive results without partial records.
- [ ] Existing login/session, protected navigation, customer workflows, ticket behavior, and automated tests continue to pass.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 10.**
