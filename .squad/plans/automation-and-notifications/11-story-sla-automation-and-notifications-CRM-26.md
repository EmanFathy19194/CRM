# Story 11 — SLA, Automation and Notifications (Story: CRM-26)

## Prerequisites

- Story 08 completed: [08-story-manage-support-tickets-CRM-23.md](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md). Extend its `support_tickets`, `ticket_history`, protected ticket APIs, and ticket pages; do not replace the existing ticket lifecycle.
- Story 10 completed: [10-story-agent-dashboard-and-tasks-CRM-25.md](../agent-dashboard-and-tasks/10-story-agent-dashboard-and-tasks-CRM-25.md). Reuse the protected agent dashboard and per-user work-item pattern for in-app SLA notifications.
- Coordinate changes to the shared ticket contracts and history action union with owners of ticket creation, communications, and internal comments. Those paths currently create tickets and append ticket history.

---

## Story Goal

Allow administrators to configure SLA, assignment, and escalation rules that are applied to support tickets, while agents can see approaching and breached SLA deadlines as in-app notifications.

1. Configure response and resolution targets by ticket priority and/or category.
2. Assign tickets automatically and escalate tickets automatically when rules match or an SLA breaches.
3. Record every automated assignment, escalation, SLA warning, and SLA breach in immutable ticket history and expose the resulting alerts to the relevant assigned agent.

External email, SMS, push delivery, a persisted user directory, and changing the existing customer communication channels are out of scope. “Notifications” in this story are durable, authenticated in-app notifications.

---

## Context — Read These Files First

1. `CRM/src/database.ts` — Read `createDatabase` at lines 7–87. Add all additive SLA, automation-rule, and notification tables in this initialization path; preserve foreign keys, `busy_timeout`, and the existing ticket/history tables at lines 54–73.
2. `CRM/src/ticket.ts` — Read the ticket status/priority and history contracts at lines 1–37. Extend these contracts with SLA fields and new history actions rather than adding a second ticket model.
3. `CRM/src/ticket-repository.ts` — Read `createTicket` at lines 20–28, `updateTicket` at lines 42–50, `escalateTicket` at lines 52–54, and history helpers at lines 56–60. These are the mutation points where the automation service must persist its work transactionally and idempotently.
4. `CRM/src/ticket-validation.ts` — Read input normalization and the `validateTicket` result shape at lines 5–30. Keep ticket input validation separate from validation for rule configuration.
5. `CRM/src/server.ts` — Read the ticket access helpers at lines 130–144, ticket routes at lines 146–175, and dashboard response at lines 177–180. Add protected administrator configuration routes, invoke rule evaluation after ticket creation/update, and return the current user’s notifications with their dashboard data.
6. `CRM/src/auth.ts` — Read `PublicUser`, role definitions, and seeded-session behavior at lines 7–15 and 35–64. Recipient values remain normalized agent email strings because the application has no persisted user directory or user-list API.
7. `CRM/src/agent-work.ts` and `CRM/src/agent-work-repository.ts` — Read existing agent-facing contracts at lines 1–6 and owner-scoped persistence at lines 8–25. Follow the owner-email and row-mapper conventions for the new notification repository; do not repurpose private tasks or reminders as SLA alerts.
8. `CRM/public/pages/shared.ts` — Read role-filtered navigation at lines 1–10 and 31–34 plus routing at lines 53–67. Add an administrator-only Automation page without exposing rule configuration to agents.
9. `CRM/public/pages/ticket-details.ts` — Read ticket/history loading and rendering at lines 14–29. Add SLA target/deadline status and the explicit first-response action to the established protected ticket detail flow.
10. `CRM/public/pages/dashboard.ts` — Read dashboard fetch/render and authenticated action patterns at lines 3–22. Render the current user’s SLA alerts beside existing assigned-ticket and reminder work.
11. `CRM/tests/tickets.test.ts` — Read authenticated ticket setup and history assertions at lines 8–42. Reuse this in-memory SQLite and `request.agent` pattern for SLA/automation endpoint coverage.
12. `.squad/stories/automation-and-notifications/CRM-26/intake.md` — Use the CRM-26 acceptance criteria as the product contract. The referenced `attachments/` folder is empty.
13. [Story 08 plan](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md) — Follow its additive schema, protected-route, and immutable-history conventions for work that builds directly on tickets.

---

## Product rules (from story)

- An SLA rule has a required positive **response target** and **resolution target** in minutes, and optional exact-match **priority** and **category** conditions. A rule matches a ticket only when every populated condition matches.
- If multiple SLA rules match, use the rule with the greatest number of populated conditions; break an equal-specificity tie with the lowest rule id. A ticket with no matching rule has no SLA deadlines and produces no SLA notifications.
- On ticket creation, persist the matched rule id, response deadline, and resolution deadline from the ticket’s `createdAt`. Do not recalculate an existing ticket’s deadlines when an administrator later edits a rule or when the ticket’s category/priority changes.
- An agent records the first response explicitly. The first response timestamp stops only the response SLA. Status `resolved` or `closed` stops the resolution SLA; reopening a ticket does not create a second SLA clock in this story.
- An SLA warning is due once when an open response or resolution deadline is within 25% of its configured target duration. A breach is due once when that deadline has passed. The evaluator must be idempotent across repeated dashboard loads, API calls, and concurrent evaluations.
- An automation rule has optional exact-match priority/category conditions and exactly one action: assign to a non-empty agent email or escalate. Evaluate matching rules in ascending id order after ticket creation and update; assignment actions run before escalation actions. Each action records history only when it changes ticket state.
- A breached SLA automatically escalates the ticket once. Create an in-app notification for the ticket’s current assigned agent for each first warning, breach, automatic assignment, and automatic escalation. There is no external delivery in this story.

## Backend Tasks

### 1 — Add SLA, automation, notification, and ticket contracts

- **Modify `CRM/src/database.ts`** at lines 54–86. Add additive `sla_rules`, `automation_rules`, `agent_notifications`, and `ticket_sla_events` tables plus indexes for rule matching, undisposed recipient alerts, and ticket-event lookup. Add nullable SLA columns to `support_tickets`: `sla_rule_id`, `response_target_minutes`, `response_due_at`, `response_responded_at`, `resolution_target_minutes`, and `resolution_due_at`. Make `(ticket_id, deadline_kind, event_kind)` unique in `ticket_sla_events` so warning/breach automation is persisted exactly once per ticket and deadline type.
- **Modify `CRM/src/ticket.ts`** at lines 1–37. Extend `TicketHistoryAction` with `sla_warning`, `sla_breached`, `automatically_assigned`, `automatically_escalated`, and `responded`; extend `SupportTicket` with nullable rule/deadline/response fields. Keep the existing `CreateTicketInput` client shape unchanged.
- **Create file: `CRM/src/automation.ts`**. Export literal action/status types and public contracts for `SlaRule`, `AutomationRule`, `AgentNotification`, their create/update input shapes, and a ticket-SLA summary returned to the UI. Keep server-generated ids, timestamps, rule-match metadata, and read state out of create/update input contracts.
- **Create file: `CRM/src/automation-validation.ts`**. Export validation functions that normalize optional category and priority conditions, require positive integer target minutes, require a normalized recipient email for assignment actions, and reject a recipient for escalation actions. Use the existing `ticketPriorities` values rather than duplicating priority literals.

### 2 — Persist and evaluate rules atomically

- **Create file: `CRM/src/automation-repository.ts`**. Implement parameterized CRUD/list methods for SLA and automation rules, owner-scoped list/read-dismiss methods for notifications, rule selection by specificity/id, and private row mappers matching the repository style in `CRM/src/ticket-repository.ts` lines 8–18.
- Implement an evaluator that accepts a `SupportTicket`, the evaluation timestamp, and the authenticated actor/system actor. It must: assign SLA deadlines only while creating a new ticket; determine warning/breach state from persisted deadlines; append the corresponding unique ticket-history event; persist the recipient notification; and call the existing ticket update/escalation persistence only when state actually changes.
- Keep each ticket evaluation in one SQLite transaction. On failure, roll back the ticket mutation, history row/event key, and notification together. Never insert a duplicate warning, breach, notification, history row, or breach-driven escalation after a retry.
- **Modify `CRM/src/ticket-repository.ts`** at lines 20–28 and 42–60. Accept internal, server-derived SLA fields when creating/mapping tickets; expose a focused transactional helper for automation updates/history so `AutomationRepository` does not issue uncoordinated direct SQL against ticket state. Preserve generated ticket numbers, existing user-initiated escalation semantics, and newest-first history ordering.

### 3 — Expose protected configuration, evaluation, and notification APIs

- **Modify `CRM/src/server.ts`** at lines 26–63. Add `/automation` to protected page paths and `/api/sla-rules`, `/api/automation-rules`, and `/api/notifications` to protected APIs. Guard rule configuration routes with the existing `isAdmin` boundary; agents can only read/dismiss their own notifications.
- Add administrator CRUD endpoints for `/api/sla-rules` and `/api/automation-rules`. Return `201` for creation, `200` for reads/updates, `204` for deletion, `400` with field errors for invalid rule data, and the existing generic `500` error style for persistence failures.
- In the ticket handlers at lines 154–168, evaluate assignment/escalation rules after successful ticket create and update, then evaluate SLA deadlines before responding. Add `POST /api/tickets/:id/responded` beside the existing escalation endpoint: require ticket access, set `responseRespondedAt` only once, append `responded` history, and reevaluate without allowing a late response to erase an already recorded breach.
- Before serving `GET /api/tickets`, `GET /api/tickets/:id`, and `GET /api/dashboard`, evaluate visible accessible tickets for SLA warnings/breaches. The evaluator is the runtime trigger in this web application; do not add an untracked background interval or external worker. Add `notifications` to the dashboard payload at lines 177–180 and provide `GET /api/notifications` plus `POST /api/notifications/:id/dismiss` for the signed-in recipient.

## Frontend Tasks

### 4 — Build administrator rule configuration

- **Create file: `CRM/public/pages/automation.ts`**. Render protected administrator-only sections for SLA rules and automation rules. Each SLA form must collect optional priority/category match conditions plus response/resolution target minutes. Each automation form must collect optional conditions, action type, and assignment recipient only when the selected action is `assign`.
- Use `escapeHtml`, `credentials: "same-origin"`, disabled pending controls, and server field-error rendering as in `CRM/public/pages/tickets.ts` lines 8–25. Render deterministic rule tables in server list order and require confirmation before deletion.
- **Modify `CRM/public/pages/shared.ts`** at lines 1–10 and 53–67. Add `/automation: "Automation"`, render it only for administrators, and dispatch the route to `renderAutomation`; leave the current agent-visible navigation subset unchanged.
- **Modify `CRM/public/index.html`** in its existing shared page styles around ticket/form styles (currently lines 71 onward). Add responsive rule-table, condition-field, notification, SLA-state, and deadline styles. Long category and email values must wrap at narrow widths.

### 5 — Show SLA state and agent notifications where work happens

- **Modify `CRM/public/pages/ticket-details.ts`** at lines 14–29. Display the matched SLA target, response/resolution deadlines, responded time, remaining/overdue state, and an enabled “Mark first response sent” action only when no response timestamp exists. Render SLA and automation history actions safely in the existing immutable timeline.
- **Modify `CRM/public/pages/tickets.ts`** at lines 11–26. Include the ticket SLA state/deadline in list rows without changing current filters, creation form ownership, or generated ticket-number behavior.
- **Modify `CRM/public/pages/dashboard.ts`** at lines 3–22. Add an in-app SLA alerts section. Each alert links to its ticket, displays its deadline/event message and timestamp, and offers a Dismiss control that invokes the recipient-only notification endpoint. Keep alerts separate from manually created reminders.

## Edge Cases & Failure Modes

- No SLA rule matches a ticket: persist no SLA rule id or deadlines, create no SLA event/notification, and keep normal ticket assignment/escalation behavior; enforce in rule selection in `CRM/src/automation-repository.ts` and ticket creation at `CRM/src/ticket-repository.ts` lines 20–28.
- Multiple matching SLA rules: choose the most specific rule, then the lowest id; enforce in the SLA selection query/method in `CRM/src/automation-repository.ts` and cover it in repository tests.
- Administrator edits/deletes a rule after tickets already exist: retain existing ticket deadlines and matched-rule metadata; only subsequently created tickets use the new rule. Foreign-key deletion must preserve historical ticket data by retaining a nullable reference or storing the applied values on the ticket.
- First response, resolved, or closed ticket: do not emit the corresponding response/resolution warning or breach after its stopping timestamp/state; enforce in the evaluator and ticket state mapping in `CRM/src/ticket-repository.ts` lines 42–50.
- Warning/breach evaluation runs repeatedly or concurrently: persist one event key, one history event, and one notification per ticket/deadline/event; a unique constraint plus one transaction enforces this in `CRM/src/database.ts` and `CRM/src/automation-repository.ts`.
- A breach occurs while the ticket has no usable assigned agent: record the SLA history and automatic escalation but skip recipient notification; enforce the recipient check in the evaluator. Do not fabricate a user or external recipient.
- An automation assignment rule changes an assignee before an escalation action: process assignments first, then send the escalation alert to the resulting current assignee; enforce action ordering in `CRM/src/automation-repository.ts`.
- Invalid targets, malformed optional priority/category values, absent assignment email, or an assignment email supplied to an escalation rule: return `400` field errors and persist no rule; enforce in `CRM/src/automation-validation.ts` and the admin handlers in `CRM/src/server.ts`.
- An agent requests configuration or another user’s alert: return `403` for configuration and `404` for a notification not owned by the actor; enforce with `isAdmin` at `CRM/src/server.ts` lines 43–45 and owner-scoped notification queries.
- HTML/Unicode in category, assignment recipient, or notification details: preserve valid text but escape all displayed data; enforce through `escapeHtml` at `CRM/public/pages/shared.ts` lines 14–15 and all new renderers.

## Test Plan

1. **Unit — create `CRM/tests/automation-validation.test.ts`:** validate positive target minutes, optional rule conditions, all valid priorities, invalid actions, required assignment email, forbidden escalation recipient, normalization, and field-length boundaries.
2. **Unit — create `CRM/tests/automation-repository.test.ts`:** use `createDatabase(":memory:")` to test specificity/id rule selection, ticket deadline calculation, response/resolution stop conditions, deterministic automation action ordering, notification ownership, dismissal, and rollback/idempotency of warning/breach event persistence.
3. **Integration — create `CRM/tests/automation.test.ts`:** follow the authenticated setup in `CRM/tests/tickets.test.ts` lines 8–19. Cover administrator SLA/automation CRUD; ticket creation automatic assignment; auto escalation; first-response endpoint; approaching and breached deadline evaluation with injected deterministic time; ticket-history entries; and agent-only notification visibility/dismissal.
4. **Integration — modify `CRM/tests/tickets.test.ts`:** retain existing ticket create/update/escalate coverage at lines 21–42 and assert legacy tickets with no matching rule remain usable without SLA dates or notifications.
5. **Integration — modify `CRM/tests/dashboard.test.ts`:** extend the dashboard assertion pattern at lines 19–35 to confirm only the signed-in agent’s SLA notifications appear and the dismissal endpoint removes the alert from the default dashboard response.
6. **Browser smoke:** as an administrator, configure priority/category SLA and assignment/escalation rules, create matching/nonmatching tickets, inspect deadline/history state, and verify the Automation page is absent for agents. As an assigned agent, load Dashboard, open an SLA alert, mark first response, dismiss an alert, and verify responsive narrow-screen rendering.

## Migration / Rollback

- The migration is additive: create rule/notification/event-persistence tables and add nullable SLA columns to `support_tickets`. Existing tickets remain valid and have no SLA policy until newly created under a matching rule.
- If rollout stops after the schema migration, the prior application ignores the new nullable columns and tables. Do not drop populated rules, notifications, or event history during rollback.
- If a ticket mutation or evaluation fails halfway through, roll back the transaction. A half-applied state must never contain a notification or SLA event history without its corresponding persisted ticket state/event key.

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`. Log in as an administrator, configure SLA and automation rules, create matching tickets, inspect deadlines/history, then log in as the assigned agent to verify Dashboard alerts, response marking, and dismiss behavior.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm TypeScript compiles the new contracts, repositories, protected routes, pages, and copied client assets.
3. **Regression:** from `CRM/`, run `npm test` and confirm all existing authentication, ticket, communication, dashboard, task, reminder, and customer tests plus new automation tests pass.

## Done Criteria

- [ ] Administrators can configure response and resolution targets by ticket priority and/or category.
- [ ] Matching tickets persist response and resolution SLA deadlines, while nonmatching tickets retain normal behavior without SLA dates.
- [ ] The application identifies approaching SLA deadlines and SLA breaches exactly once per applicable deadline.
- [ ] Administrators can configure assignment and escalation automation rules, and matching tickets are automatically assigned or escalated in deterministic order.
- [ ] SLA breaches automatically escalate the ticket once.
- [ ] Assigned agents receive durable in-app alerts for relevant SLA and automation events and can dismiss only their own alerts.
- [ ] Ticket history records automated assignment, escalation, SLA warning, SLA breach, and first response events with timestamps and actors.
- [ ] Agents cannot configure rules or access other users’ notifications; existing ticket access controls continue to apply.
- [ ] Existing ticket, communication, dashboard, customer, and authentication workflows continue to pass their regression tests.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 12.**
