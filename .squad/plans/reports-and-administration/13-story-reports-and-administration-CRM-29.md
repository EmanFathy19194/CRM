# Story 13 — Reports and Administration (Story: CRM-29)

## Prerequisites

- Story 08 completed: [08-story-manage-support-tickets-CRM-23.md](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md). Reuse `support_tickets` and immutable `ticket_history`; do not create a reporting copy of ticket data.
- Story 10 completed: [10-story-agent-dashboard-and-tasks-CRM-25.md](../agent-dashboard-and-tasks/10-story-agent-dashboard-and-tasks-CRM-25.md). Preserve the agent dashboard, owner-scoped work data, and dashboard response contract while adding a separate management dashboard.
- Story 11 completed: [11-story-sla-automation-and-notifications-CRM-26.md](../automation-and-notifications/11-story-sla-automation-and-notifications-CRM-26.md). Reuse its `sla_rules`, `ticket_sla_events`, `agent_notifications`, and SLA ticket fields when calculating SLA performance.
- Story 12 completed: [12-story-knowledge-base-and-customer-portal-CRM-27.md](../knowledge-base-and-customer-portal/12-story-knowledge-base-and-customer-portal-CRM-27.md). Use its `ticket_feedback` table for satisfaction reporting; never join portal-session secrets into reports or audit data.

---

## Story Goal

Deliver protected manager reports and administrator controls for staff users, roles, audited system actions, and basic CRM settings.

1. Managers and administrators can view ticket, SLA, agent-performance, customer-satisfaction, and management-summary reports.
2. Administrators can create, edit, deactivate, and assign the fixed staff roles `admin`, `manager`, and `agent`.
3. Role-based server authorization blocks unauthorized routes and writes; user administration and system-setting mutations produce durable audit entries.

Customer identities/passwords, custom permission builders, password-reset delivery, report export/scheduling, and editing or deleting audit records are out of scope.

---

## Context — Read These Files First

1. `CRM/src/auth.ts` — Read `userRoles`, `PublicUser`, `AuthService.seedUser`, `login`, `getUser`, and `logout` at lines 7–81. Replace the in-memory-only staff-user source with a persisted repository while retaining HTTP-only session-cookie behavior and the customer login boundary.
2. `CRM/src/database.ts` — Read ticket/history/SLA/notification schema at lines 56–106 and agent-work schema at lines 112–119. Add user-directory, audit-log, and settings tables additively in `createDatabase`; retain `PRAGMA foreign_keys = ON` from the initialization path.
3. `CRM/src/server.ts` — Read protected path arrays and `isAdmin` at lines 27–69, ticket access/evaluation helpers at lines 138–155, the existing dashboard payload at lines 200–205, and page authorization at lines 321–343. Put all report and administration APIs under the authenticated guard and enforce roles on the server.
4. `CRM/src/automation-repository.ts` — Read SLA rule, notification, matching, and evaluation queries at lines 11–30. Aggregate the persisted SLA deadline/event data directly; do not run SLA evaluation while generating a report.
5. `CRM/src/ticket.ts` and `CRM/src/ticket-repository.ts` — Read ticket/SLA contracts at `ticket.ts` lines 1–43 and ticket list/history ordering at `ticket-repository.ts` lines 8–69. Report queries must retain existing ticket statuses, priorities, generated ticket numbers, and newest-first history ordering.
6. `CRM/src/agent-work-repository.ts` — Read owner-scoped mapper/query conventions at lines 1–25. Follow the same parameterized-query and normalized-email style for user and audit repositories.
7. `CRM/public/pages/shared.ts` — Read role-filtered navigation and route authentication at lines 1–72. Add manager report routes without exposing administration navigation or routes to managers/agents.
8. `CRM/public/pages/dashboard.ts` — Read the agent dashboard fetch/render/action pattern at lines 1–26. Keep this agent workspace intact; render management metrics from a dedicated route/API.
9. `CRM/public/index.html` — Read existing report-adjacent dashboard, rule-table, notification, and responsive styles at lines 60–93. Extend the protected-shell design system rather than adding standalone stylesheets.
10. `CRM/tests/auth.test.ts` — Read seeded-session, role-access, logout, and protected-path tests at lines 9–113. Reuse its `AuthService`, in-memory SQLite, and `request.agent` setup for role-denial coverage.
11. `CRM/tests/dashboard.test.ts` — Read the authenticated ticket/task fixture and dashboard assertion pattern at lines 8–36. Use the same real ticket data setup for management report integration tests.
12. [Story 11 plan](../automation-and-notifications/11-story-sla-automation-and-notifications-CRM-26.md) — Follow its additive schema and owner-scoped notification conventions when reporting SLA outcomes.
13. `.squad/stories/reports-and-administration/CRM-29/intake.md` — Use the CRM-29 acceptance criteria as the product contract. The referenced `attachments/` folder is empty.

---

## Product rules (from story)

- Staff roles are exactly `admin`, `manager`, and `agent`. `customer` remains an existing customer-session role and is not assignable through staff administration.
- `admin` has all protected CRM access, including users, settings, audit logs, and reports. `manager` may read reports and the management dashboard only. `agent` retains only the existing dashboard, ticket, task, and activity access; no new report or administration API is visible to it.
- A deactivated staff user cannot create a new session. Existing sessions for that user are invalidated on the next authenticated request and are deleted when deactivation succeeds.
- Reports are read-only, use only persisted data, and expose aggregate rows plus staff email only where required for agent performance. They never include passwords, password hashes, session tokens, portal-session hashes, customer contact details, ticket descriptions, internal comments, or communication bodies.
- Ticket reporting groups tickets by status, priority, category, and created/resolved period. SLA reporting aggregates response/resolution warning and breach events from `ticket_sla_events`. Agent reporting derives assigned/resolved/open ticket counts and first-response timing from tickets/history. Satisfaction reporting aggregates the Story 12 `ticket_feedback` rating and count, without feedback message text.
- System settings are a fixed allow-list: organization name, support email, and default ticket priority. Settings are validated, auditable, and read only by administrators; they do not alter historical tickets.
- Audit entries are append-only. Record staff-user creation/edit/deactivation/role changes and setting changes, retaining actor email, action, target kind/id, redacted structured detail, and timestamp. Never record plaintext passwords, password hashes, cookies, or tokens.

## Backend Tasks

### 1 — Persist staff users, fixed roles, settings, and audit data

**File: `CRM/src/auth.ts`.** Extend the staff role union to include `manager`; retain the separate `customer` role and `PublicUser` response shape at lines 7–11. Refactor `AuthService` so staff identity lookup and active-state checks use a persisted user repository instead of its private in-memory `users` map. Keep bcrypt password verification, one-hour opaque sessions, `getUser` expiry cleanup, and `logout` semantics at lines 35–81. `getUser` must reject/deactivate existing sessions for a now-inactive staff user.

**Create file: `CRM/src/user-administration.ts`.** Export fixed staff-role literals, public staff-user projection, create/update/deactivate input contracts, system-setting keys, audit-log projection, and report response contracts. Keep password hash, plaintext password, and session state out of public/admin response types.

**Create file: `CRM/src/user-administration-validation.ts`.** Provide `{ value, errors }` validators following the existing normalized-input style. Normalize email to lowercase; require non-empty names and a valid role; require a strong create password; allow an edit password only when supplied; reject `customer` as a staff role; validate positive ids, date ranges, page values, settings keys, support email, and ticket priority.

**File: `CRM/src/database.ts`.** Add `staff_users`, `system_settings`, and `audit_logs` after the existing application tables at lines 107–119. `staff_users` needs a unique normalized email, display name, bcrypt password hash, fixed role check, active flag, and created/updated/deactivated timestamps. `system_settings` needs a constrained key, value, and update timestamp; seed the three fixed keys idempotently. `audit_logs` needs immutable actor email, action, target kind/id, redacted JSON detail, and timestamp. Add indexes for active staff email lookup, audit newest-first ordering/action filtering, and report date/grouping queries that are not already indexed. Do not modify or duplicate ticket, feedback, SLA, or customer data.

### 2 — Add parameterized administration, audit, and reporting repositories

**Create file: `CRM/src/user-administration-repository.ts`.** Construct it with `DatabaseSync` and implement parameterized row mappers plus:

```ts
createStaffUser(input): StaffUser
listStaffUsers(page: number, pageSize: number, search: string): StaffUserPage
getStaffUser(id: number): StaffUser | null
updateStaffUser(id: number, input): StaffUser | null
deactivateStaffUser(id: number, actorEmail: string): StaffUser | null
getStaffUserForLogin(email: string): StaffUserWithPassword | null
listAuditLogs(page: number, pageSize: number, action: string): AuditLogPage
getSettings(): SystemSettings
updateSettings(input, actorEmail: string): SystemSettings
```

Hash passwords inside this repository or the refactored `AuthService`, never in route handlers. Perform each admin mutation and its audit insert in one SQLite transaction. Prevent an administrator from deactivating their own active account and prevent removal/deactivation of the final active administrator; return a conflict result that the route maps to `409`.

**Create file: `CRM/src/reports-repository.ts`.** Implement read-only, parameterized aggregate methods accepting an optional validated inclusive date range. Return empty/zero report sections instead of `null`. Build ticket totals from `support_tickets`; SLA warning/breach/rate sections from `ticket_sla_events` joined only to ticket ids/dates; agent rows from `assigned_agent`, ticket status, and `response_responded_at`; satisfaction totals/average/rating distribution from `ticket_feedback`; and management-summary cards from those same aggregates. Do not call `AutomationRepository.evaluate` or mutate rows during report reads.

### 3 — Expose role-protected APIs and record auditable actions

**File: `CRM/src/server.ts`.** Construct the administration and report repositories beside the existing repositories at lines 52–57. Add `/reports` and `/admin/users`, `/admin/audit-logs`, `/admin/settings` to `protectedPagePaths` at line 31. Add `/api/reports`, `/api/admin/users`, `/api/admin/audit-logs`, and `/api/admin/settings` to `protectedApiPaths` at line 34.

Add reusable `isManagerOrAdmin` and role-aware page/API guards next to `isAdmin` at lines 44–50. Preserve agent ticket ownership checks at lines 143–151. Managers must receive `403` from every `/api/admin/*` route; agents and customers must receive `403` from both report and administration routes.

- `GET /api/reports/tickets`, `GET /api/reports/sla`, `GET /api/reports/agents`, `GET /api/reports/satisfaction`, and `GET /api/reports/management` require manager-or-admin access and return only report projections. Validate optional `from`/`to` dates before a repository query; use `400` field errors for an invalid range.
- `GET /api/admin/users`, `POST /api/admin/users`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id`, and `POST /api/admin/users/:id/deactivate` require administrator access. Return `201`, `200`, `400`, `404`, and `409` consistently; do not return password data.
- `GET /api/admin/audit-logs` requires administrator access, supports validated pagination/action filtering, and is read-only.
- `GET /api/admin/settings` and `PATCH /api/admin/settings` require administrator access. Write one audit record per changed key, with old/new values only for non-secret allow-listed settings.

Keep `/api/dashboard` at lines 200–205 agent-scoped. Add no management fields to it; the manager dashboard must use `/api/reports/management`.

## Frontend Tasks

### 4 — Add management report and administration screens

**Create file: `CRM/public/pages/reports.ts`.** Render `/reports` as an asynchronous manager/admin page. Fetch management, ticket, SLA, agent, and satisfaction report endpoints with `credentials: "same-origin"`. Provide an accessible inclusive date-range filter, loading/error/empty states, metric cards, and tables. Escape all server values through `escapeHtml`; do not render raw feedback text or ticket/customer private fields. Disable only the pending filter control and retain values after validation errors.

**Create file: `CRM/public/pages/admin-users.ts`.** Render `/admin/users` for administrators only. Provide paginated/searchable user rows plus create/edit/deactivate controls. Create/edit forms must show server field errors, never refill password fields, and disable only their active submit control. Require confirmation before deactivation and surface a `409` self/final-admin response without refreshing the list.

**Create file: `CRM/public/pages/admin-settings.ts`.** Render the fixed settings form and append-only audit-log list. Fetch only the administrator APIs, preserve values after validation failure, show an explicit no-audit-entries state, and never provide edit/delete controls for audit records.

**File: `CRM/public/pages/shared.ts`.** Add the three new protected paths to `protectedPages` at lines 1–12. Change the navigation filter at lines 33–36 so administrators see Reports plus all admin pages; managers see only Dashboard and Reports; agents retain their exact existing subset. Extend the route dispatcher at lines 55–72 to dynamically import and render the three new page modules. The client-side role filter is presentation only; keep the new server checks authoritative.

**File: `CRM/public/index.html`.** Extend protected CSS around the dashboard/rule styles at lines 71–93 for report metric grids, date filters, dense responsive tables, user forms, role/status badges, settings fields, and audit rows. At widths below 720px, stack controls and make long audit details, emails, and categories wrap rather than overflow.

## Edge Cases & Failure Modes

- Inactive user login or an existing session after deactivation: return the normal unauthenticated result, clear/forget the session, and expose no protected data; enforce through active-state lookup in `CRM/src/auth.ts` lines 55–76 and the staff-user repository.
- Attempt to deactivate yourself or the final active administrator: return `409`, make no user/audit write, and leave the account usable; enforce transactionally in `CRM/src/user-administration-repository.ts`.
- Role tampering (`customer`, unknown role, or a manager/admin path requested by an agent): return `400` for invalid input and `403` for authorization failure; enforce validation plus guards added beside `CRM/src/server.ts` lines 44–50.
- Empty database, no feedback, no SLA event, or no resolved ticket: report zero totals and empty arrays, not SQL `null`/division-by-zero values; enforce in `CRM/src/reports-repository.ts` aggregate mappers.
- Invalid, reversed, or malformed report date range: return `400` before executing aggregate SQL; enforce in `CRM/src/user-administration-validation.ts` and report handlers.
- Ticket/SLA data changes while a report is loading: each endpoint returns one consistent SQLite read result; reports are snapshots and do not create ticket history, notifications, or SLA events; enforce with read-only repository queries.
- Passwords, hashes, sessions, cookies, portal tokens, feedback messages, communications, internal comments, and customer contact data: omit from all staff-user, audit, and report projections; enforce in mappers and audit detail construction.
- Concurrent user/settings updates: use a transaction for mutation plus audit insertion; map a stale/missing id to `404` and a protected-account conflict to `409`; enforce in `CRM/src/user-administration-repository.ts`.
- HTML/Unicode in display names, audit detail, settings, or report labels: retain valid normalized data and escape every rendered value through `escapeHtml` at `CRM/public/pages/shared.ts` lines 16–18 and all new page renderers.

## Test Plan

1. **Unit — create `CRM/tests/user-administration-validation.test.ts`:** cover normalized email/name values, each staff role, rejection of customer/unknown roles, password requirements, settings allow-list/value limits, ids, pagination, and valid/invalid/reversed report date ranges.
2. **Unit — create `CRM/tests/user-administration-repository.test.ts`:** use `createDatabase(":memory:")` to test staff-user CRUD/deactivation, active lookup, self/final-admin conflict, settings mutation plus audit insert, immutable audit-list ordering, and audit redaction.
3. **Unit — create `CRM/tests/reports-repository.test.ts`:** seed tickets, SLA events, response timestamps, and `ticket_feedback`; assert ticket grouping, SLA warning/breach aggregation, agent metrics, rating average/distribution, empty values, inclusive date filtering, and absence of customer/message fields.
4. **Integration — create `CRM/tests/reports-and-administration.test.ts`:** follow `CRM/tests/auth.test.ts` lines 9–53 and `CRM/tests/dashboard.test.ts` lines 8–28. Cover manager report access, admin report access, agent/customer denial, user create/edit/deactivate/role change, settings update, audit-log visibility, and `401` after a deactivated user makes a subsequent request.
5. **Integration — modify `CRM/tests/auth.test.ts`:** extend protected-page/API loops at lines 68–95 to include report/admin paths and validate the exact manager/agent/admin permission matrix without weakening current ticket access behavior.
6. **Browser smoke:** sign in as an administrator to create a manager and agent, edit/deactivate a user, update each setting, inspect audit logs, and view every report. Sign in as the manager to view reports only, then as an agent to confirm report/admin routes are blocked.
7. **Regression:** from `CRM/`, run `npm.cmd run build` and `npm.cmd test`; retain authentication, tickets, communications, agent-work, automation, knowledge-base, portal, and public web-request coverage.

## Migration / Rollback

- The migration is additive: create staff-user, settings, and audit tables/indexes without changing existing customer, ticket, SLA, communication, feedback, or portal records.
- Seed only missing default settings with `INSERT OR IGNORE`; never overwrite an administrator-configured value during application startup.
- If a user/settings transaction fails, roll back its matching audit insert. Do not delete historical audit rows or reports as a rollback shortcut; prior versions ignore the added tables.
- Seed the existing development administrator through the new persisted staff-user path before relying on the new login lookup, so deployment does not lock out the current administrator.

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm.cmd run build` followed by `npm.cmd run dev`; verify responsive `/reports`, `/admin/users`, `/admin/audit-logs`, and `/admin/settings` screens for each role.
2. **Backend builds:** from `CRM/`, run `npm.cmd run build` and confirm TypeScript compiles the persisted-auth, administration, audit, settings, and report contracts.
3. **Regression:** from `CRM/`, run `npm.cmd test` and confirm all new report/admin suites and the existing authentication, ticket, communication, automation, portal, and public-request suites pass.

## Done Criteria

- [ ] Managers can view ticket, SLA, agent-performance, customer-satisfaction, and management-summary reports.
- [ ] The management dashboard displays protected aggregate metrics without leaking private ticket/customer content.
- [ ] Administrators can create, edit, deactivate, and assign fixed staff roles.
- [ ] Role-based server authorization rejects unauthorized report and administration reads/writes.
- [ ] Important user and settings actions create immutable, redacted audit records.
- [ ] Administrators can read/update only the supported basic system settings.
- [ ] Existing customer authentication, agent dashboard/ticket access, SLA automation, communications, and portal behavior retain regression coverage.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 14.**
