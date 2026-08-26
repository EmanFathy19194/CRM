# Story 10 — Agent Dashboard and Tasks (Story: CRM-25)

## Prerequisites

- Story 09 completed: [09-story-manage-communication-channels-CRM-24.md](../manage-communication-channels/09-story-manage-communication-channels-CRM-24.md). Reuse its protected API convention and ticket communication history; do not expose internal collaboration records from the public web-request flow.
- Preserve Story 08's generated ticket number, ticket status/priority literals, immutable history entries, and customer-backed `SupportTicket` contract. Coordinate database changes with the ticket owner because dashboard, comments, and tasks share ticket and customer foreign keys.

---

## Story Goal

Give each authenticated support agent a single protected workspace for daily ticket work.

1. Show the signed-in agent's assigned, open, pending, and urgent ticket counts plus linked customer information and recent activity.
2. Let agents create, edit, complete, and delete their own tasks and create/manage reminders.
3. Let agents add ticket-scoped internal comments and select a quick-reply template while collaborating through the immutable ticket timeline.

Real-time push notifications, customer-visible comments, agent/user administration, external calendar synchronization, outbound messaging, and automated assignment are out of scope.

---

## Context — Read These Files First

1. `CRM/src/database.ts` — Read `createDatabase` at lines 7–79. Add additive task, reminder, and internal-comment tables after the existing ticket and communication tables; retain `PRAGMA foreign_keys = ON`, idempotent DDL, and `ON DELETE CASCADE` for records owned by a removed ticket or customer.
2. `CRM/src/server.ts` — Read protected route configuration at lines 20–51, `actor` at line 123, and ticket handlers at lines 125–141. Add every task, reminder, dashboard, and comment endpoint under the existing authenticated middleware and derive the agent identity only from `actor(request)`.
3. `CRM/src/ticket.ts` — Read ticket literals and `TicketHistoryEntry` at lines 1–37. Extend `ticketHistoryActions` with explicit internal-comment and collaboration actions only when an action is persisted in `ticket_history`; leave `SupportTicket` and its generated `ticketNumber` unchanged.
4. `CRM/src/ticket-repository.ts` — Read `createTicket`, `listTickets`, `getTicket`, and `listHistory` at lines 15–59. Reuse its joined customer mapping and parameterized filter style; add a focused history writer for internal comments instead of invoking `updateTicket`.
5. `CRM/src/customer-repository.ts` — Read `getCustomer`, `listCustomers`, and customer-scoped child-record methods at lines 17–125. Follow its `DatabaseSync` constructor, row mapper, positive-id boundary, and newest-first ordering for task/reminder persistence.
6. `CRM/src/ticket-validation.ts` — Read `parsePositiveInteger` and `validateTicket` at lines 3–30. Reuse the positive integer parser and `{ value, errors }` shape in new dashboard/task/comment validators; do not loosen ticket validation.
7. `CRM/public/pages/shared.ts` — Read `protectedPages`, `renderProtectedShell`, and `route` at lines 1–63. Replace the current generic dashboard dispatch with a dedicated dashboard renderer and add direct ticket/customer links while retaining the `/api/me` session gate.
8. `CRM/public/pages/dashboard.ts` — Read `renderDashboard` at lines 1–5. Replace the placeholder protected content with dashboard data loading, task/reminder controls, quick replies, and empty/error/loading states using `credentials: "same-origin"`.
9. `CRM/public/pages/ticket-details.ts` — Read `renderTicketDetails` at lines 1–22. Add the internal-comment panel beside the existing ticket history and communication timeline; escape every author and comment value before HTML insertion.
10. `CRM/public/index.html` — Read the record, ticket, history, and responsive styles at lines 67–87. Extend the established responsive grid/card system for metric cards, task/reminder rows, quick replies, and internal comments.
11. `CRM/tests/tickets.test.ts` — Read the authenticated in-memory setup at lines 8–42. Reuse `request.agent(createApp(auth, repository))`, `createDatabase(":memory:")`, and ticket fixture creation for dashboard/task/comment integration tests.
12. `CRM/tests/communications.test.ts` — Read the authenticated setup and ticket-history assertions at lines 8–83. Use its actor and history-event assertions as the precedent for ticket collaboration coverage.
13. [Story 08 plan](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md) and [Story 09 plan](../manage-communication-channels/09-story-manage-communication-channels-CRM-24.md) — Follow their protected API, customer/ticket ownership, validation, transaction, and history conventions.
14. `.squad/stories/agent-dashboard-and-tasks/CRM-25/intake.md` — Use CRM-25 as the product contract. Its attachment list is empty.

---

## Product rules (from story)

- Dashboard data is agent-scoped: "assigned tickets" means `support_tickets.assigned_agent` equals the authenticated email case-insensitively. Open, pending, and urgent counts are derived from the existing ticket status/priority fields, not duplicated dashboard state.
- Tasks and reminders are private to the authenticated agent. A caller cannot create, edit, complete, list, or delete another agent's record by sending an email or id in the payload.
- Internal comments are ticket-scoped collaboration records. They are available only through protected ticket/dashboard APIs and are never included in `CustomerCommunication`, public web-request responses, or unauthenticated routes.
- Quick replies are a fixed client-side set of safe text templates. Selecting one only fills the internal-comment editor; it does not send an outbound communication or persist until the agent explicitly saves the comment.
- Recent activity combines ticket history, internal comments, task completion, and reminder creation for the authenticated agent, newest first. Each item contains only its type, safe display text, timestamp, and protected ticket/customer link id when applicable.

---

## Backend Tasks

### 1 — Add dashboard, task, reminder, and collaboration contracts

**Create file: `CRM/src/agent-work.ts`.** Export contracts for:

```ts
export type AgentTask = { id: number; title: string; details: string | null; dueAt: string | null; isCompleted: boolean; completedAt: string | null; createdAt: string; updatedAt: string };
export type AgentReminder = { id: number; message: string; remindAt: string; isDismissed: boolean; createdAt: string };
export type InternalTicketComment = { id: number; ticketId: number; body: string; createdBy: string; createdAt: string };
export type DashboardSummary = { assignedTickets: SupportTicket[]; counts: { assigned: number; open: number; pending: number; urgent: number }; tasks: AgentTask[]; reminders: AgentReminder[]; recentActivity: DashboardActivity[] };
```

Keep `DashboardActivity` as a discriminated, safe API projection rather than returning raw database rows. Do not add actor identity to create/update input types; the server supplies it.

**Create file: `CRM/src/agent-work-validation.ts`.** Validate trimmed task title (required, maximum 200 characters), optional task details (maximum 2,000), nullable ISO date-time values, reminder message (required, maximum 500), reminder time (required valid ISO date-time), and internal comment body (required, maximum 2,000). Return the existing `{ value, errors }` shape and use `parsePositiveInteger` for path ids.

### 2 — Add additive persistence and parameterized repositories

**File: `CRM/src/database.ts`.** After the existing communication schema at lines 74–78, create:

- `agent_tasks` with `owner_email`, title, nullable details/due timestamp, completion flag/timestamp, and created/updated timestamps.
- `agent_reminders` with `owner_email`, message, reminder timestamp, dismissal flag, and creation timestamp.
- `ticket_internal_comments` with a cascading `ticket_id` foreign key, body, author email, and timestamp.
- `agent_activity` with `owner_email`, `kind`, optional ticket/customer/task/reminder ids, safe detail text, and timestamp; use it only for task/reminder activity not already represented by ticket history or comment rows.

Add owner/time, ticket/time, and activity owner/time indexes. Store timestamps as ISO text and order all histories by `created_at DESC, id DESC`. The migration is additive and must use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.

**Create file: `CRM/src/agent-work-repository.ts`.** Construct with `DatabaseSync`; use row mappers and parameterized queries. Implement task create/list/get-for-owner/update-for-owner/complete-for-owner/delete-for-owner, reminder create/list/get-for-owner/dismiss-for-owner/delete-for-owner, comment create/list-by-ticket, and a dashboard-summary query method. Scope every mutable lookup with `owner_email = ?`; return `null` for missing or cross-owner ids.

**File: `CRM/src/ticket-repository.ts`.** Add `addInternalCommentHistory(ticketId, commentId, changedBy)` that inserts exactly one immutable ticket-history row with action `internal_comment_added`, new value equal to the comment id, and the authenticated actor. It must not update ticket status, priority, assignee, customer, or timestamps.

**File: `CRM/src/ticket.ts`.** Add `internal_comment_added` to `ticketHistoryActions` so the new event remains explicit and renderable.

### 3 — Expose authenticated dashboard and work APIs

**File: `CRM/src/server.ts`.** Construct `AgentWorkRepository` from `customerRepository.getDatabase()` beside the existing ticket/communication repositories. Add `/api/dashboard`, `/api/tasks`, `/api/reminders`, and `/api/tickets` comment subpaths to `protectedApiPaths` without making any endpoint public.

Expose the following JSON endpoints with generic persistence-failure errors:

- `GET /api/dashboard`: return the current actor's summary. Query assigned tickets with the repository's existing `assignedAgent` filter and return customer name/email only through the existing `SupportTicket` projection.
- `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `POST /api/tasks/:id/complete`, and `DELETE /api/tasks/:id`: create/read/update/complete/delete only the actor's tasks. Return `201` for creates, `204` for deletes, `400` for malformed bodies/ids, and `404` for unknown or cross-owner records.
- `GET /api/reminders`, `POST /api/reminders`, `POST /api/reminders/:id/dismiss`, and `DELETE /api/reminders/:id`: apply the same actor ownership and status semantics; return only the current actor's non-dismissed reminders by default, with an explicit `includeDismissed=true` query option for the dashboard archive if required.
- `GET /api/tickets/:id/comments` and `POST /api/tickets/:id/comments`: check the ticket exists, validate the body, insert comment and ticket-history event in one transaction, and return `201`. Do not accept `createdBy` from the request body.

Use `actor(request)` for all ownership/author fields. Return `401` through existing middleware, `404` rather than an ownership diagnostic for foreign task/reminder records, and never include SQL diagnostics.

---

## Frontend Tasks

### 4 — Replace the dashboard placeholder with agent work controls

**File: `CRM/public/pages/dashboard.ts`.** Replace `renderDashboard`'s placeholder at lines 1–5 with an async protected dashboard renderer that fetches `/api/dashboard`, renders assigned/open/pending/urgent metric cards, assigned-ticket rows, related customer links, tasks, reminders, and recent activity. Use `credentials: "same-origin"`, `escapeHtml`, loading/error/empty states, and SPA navigation through `route` for ticket/customer links.

Render a task form with create/edit/complete/delete controls and a reminder form with create/dismiss/delete controls. Disable only the pending submit/action button, retain field values after a validation failure, display field errors without raw server diagnostics, and refresh the dashboard only after a successful mutation.

Add a fixed quick-reply selector such as "I am reviewing this now.", "Please share any additional details.", and "This has been escalated to the support team." Selecting a reply fills the ticket internal-comment text area but does not call an API.

**File: `CRM/public/pages/shared.ts`.** Keep `/dashboard` as the default protected destination, dispatch it to the new async dashboard renderer, and retain existing protected `/tasks` and `/activities` navigation by redirecting those labels to dashboard anchors rather than rendering the generic placeholder. Preserve the `/api/me` authentication check before any dashboard fetch.

### 5 — Add protected ticket collaboration UI

**File: `CRM/public/pages/ticket-details.ts`.** Fetch `GET /api/tickets/:id/comments` with the existing ticket and history calls. Render an "Internal comments" timeline separate from customer communications, include author/timestamp, and add a comment form plus quick-reply selector. Escape all dynamic text, submit to `POST /api/tickets/:id/comments` with same-origin credentials, disable duplicate submission, and refresh the detail after success.

Mark the section "Internal only — not visible to customers." Do not place comments in the public support-request HTML or in customer communication history.

**File: `CRM/public/index.html`.** Extend styles near lines 67–87 for dashboard metric cards, responsive task/reminder columns, completed/dismissed state, activity rows, quick-reply controls, and comment timelines. Preserve the existing 720px responsive layout and ensure long Unicode task/comment text wraps without overflow.

---

## Edge Cases & Failure Modes

- Unauthenticated dashboard, task, reminder, and comment calls return JSON `401` before handlers run; enforce by extending `protectedApiPaths` in `CRM/src/server.ts` near lines 24–51.
- A client submits a zero, negative, non-numeric, missing, or another owner's task/reminder id: return `400` for malformed ids and `404` for valid but non-owned/missing records; enforce owner-scoped repository lookups in `CRM/src/agent-work-repository.ts` and route validation in `CRM/src/server.ts`.
- Blank or oversized task title, task details, reminder message, comment, or malformed date-time produces field-level `400` with no database write; enforce in `CRM/src/agent-work-validation.ts` before repository calls.
- Completing an already completed task and dismissing an already dismissed reminder are idempotent: return the current record and do not append duplicate activity. Enforce state predicates in `CRM/src/agent-work-repository.ts`.
- A ticket disappears before an internal comment is created: return `404` and write neither a comment nor ticket-history row. Wrap comment/history insertion in one transaction in `CRM/src/server.ts` and rely on the cascading ticket foreign key in `CRM/src/database.ts`.
- A transaction failure while adding a comment rolls back both its comment and `internal_comment_added` history entry; return generic `500` JSON only.
- Dashboard counts use existing ticket values: `open` counts only `status = open`, `pending` only `status = pending`, and `urgent` only `priority = urgent`; enforce in the summary query so status changes immediately affect the next refresh.
- Comments, tasks, reminders, customer labels, and quick replies can contain HTML or Unicode. Preserve valid text in storage and escape it before `innerHTML` rendering with `escapeHtml` in `dashboard.ts` and `ticket-details.ts`.
- Empty ticket/task/reminder/activity histories render an explicit empty state while creation controls stay available.
- Internal comments remain absent from all public endpoints and public assets; enforce by adding no comment fields or comment queries to `/api/public/web-requests`, `CRM/public/support-request.html`, or `CustomerCommunication` responses.

---

## Test Plan

1. **Unit — create `CRM/tests/agent-work-validation.test.ts`:** cover required/max task/reminder/comment fields, nullable valid date-times, malformed dates, positive ids, and normalized whitespace/null values.
2. **Unit — create `CRM/tests/agent-work-repository.test.ts`:** use `createDatabase(":memory:")` to verify task/reminder CRUD, owner isolation, idempotent complete/dismiss behavior, newest-first ordering, comment retrieval by ticket, and additive dashboard counts/activity projections.
3. **Integration — create `CRM/tests/dashboard.test.ts`:** reuse `CRM/tests/tickets.test.ts` lines 8–19. Seed two authenticated agents, customers, and tickets; assert agent-scoped dashboard counts, assigned-ticket/customer data, task/reminder lifecycle endpoints, and `401` behavior for every new protected API.
4. **Integration — create `CRM/tests/internal-comments.test.ts`:** assert a valid comment creates exactly one comment and one `internal_comment_added` ticket-history event, preserves actor identity, rejects missing/malformed ticket/comment inputs without writes, and never appears in communication or public-web-request responses.
5. **Regression — modify `CRM/tests/auth.test.ts`:** include `/dashboard` and all new API prefixes in protected route/API assertions while preserving existing login/session behavior.
6. **Browser smoke:** log in as `agent@example.com`, create/edit/complete/delete a task, create/dismiss/delete a reminder, inspect ticket/customer dashboard links, use a quick reply to add an internal comment, confirm comment appears only on the protected ticket detail, and verify the narrow-screen layout.

---

## Migration / Rollback

- The migration is additive: task, reminder, internal-comment, and activity tables/indexes do not alter existing customer, ticket, communication, or session data.
- If deployment stops after schema setup, retain the empty tables; the prior application ignores them. Do not drop populated tasks, reminders, or internal collaboration records during rollback.
- On a half-failed comment create, transaction rollback leaves neither the comment nor its ticket-history event. Manually inspect only data created outside the application transaction.

---

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm.cmd run dev`, sign in as `agent@example.com` with `Password123!`, visit `/dashboard`, create and complete a task, create/dismiss a reminder, then add an internal comment through a ticket detail page.
2. **Backend builds:** from `CRM/`, run `npm.cmd run build` and confirm the new contracts, repositories, routes, protected pages, and copied client assets compile.
3. **Regression:** from `CRM/`, run `npm.cmd test` and confirm existing authentication/customer/ticket/communication/public-request suites plus the new dashboard and collaboration coverage pass.

---

## Done Criteria

- [ ] Authenticated agents can view assigned, open, pending, and urgent tickets with related customer information on the dashboard.
- [ ] Dashboard data is loaded from protected backend APIs and shows explicit loading, error, and empty states.
- [ ] Agents can create, edit, complete, and delete only their own tasks.
- [ ] Agents can create, dismiss, and delete only their own reminders.
- [ ] Agents can select a quick reply that fills, but does not automatically submit, an internal comment.
- [ ] Agents can add protected ticket-scoped internal comments with immutable ticket-history collaboration events.
- [ ] Internal comments never appear in public web requests or customer-facing communication responses.
- [ ] Cross-owner ids, malformed input, missing tickets, unauthenticated calls, and failed comment transactions produce safe recoverable responses without partial records.
- [ ] Existing login/session, customer, ticket, communication, and public-request behavior continues to pass automated tests.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 11.**
