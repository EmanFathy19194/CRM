# Story 12 — Knowledge Base and Customer Portal (Story: CRM-27)

## Prerequisites

- Story 08 completed: [08-story-manage-support-tickets-CRM-23.md](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md). Reuse its `support_tickets` and `ticket_history` records; do not duplicate requests in a portal-specific ticket table.
- Story 09 completed: [09-story-manage-communication-channels-CRM-24.md](../manage-communication-channels/09-story-manage-communication-channels-CRM-24.md). Portal submissions must continue to respect the existing `web_form` channel enablement check.
- Story 11 completed: [11-story-sla-automation-and-notifications-CRM-26.md](../automation-and-notifications/11-story-sla-automation-and-notifications-CRM-26.md). Coordinate with its owner before changing ticket response fields or public status labels; portal responses must not disclose SLA rules or automation details.

---

## Story Goal

Deliver a public knowledge base and a privacy-preserving customer self-service portal.

1. Administrators can create, edit, categorize, publish, unpublish, and delete knowledge articles; visitors can search and read only published articles.
2. A customer can submit a request, establish a short-lived portal session using the customer email and one of that customer's ticket numbers, view that customer's submitted requests and status/history, and submit feedback.
3. The portal never exposes internal assignments, private comments, staff identities, communications, automation activity, or another customer's tickets.

Customer account registration, password reset, outbound magic-link delivery, article attachments, article revision history, and public commenting are out of scope.

---

## Context — Read These Files First

1. `CRM/src/database.ts` — Read `createDatabase` at lines 7–116. Add additive knowledge-base, portal-session, and ticket-feedback tables after the existing ticket/communication tables, retain `PRAGMA foreign_keys = ON`, and follow the current idempotent `CREATE TABLE IF NOT EXISTS` convention.
2. `CRM/src/server.ts` — Read the authenticated API guard at lines 24–66, ticket access helpers at lines 133–150, communications/public web-request handlers at lines 210–260, and static/public-page routes at lines 261–314. Add explicit public namespaces before the catch-all route; do not add customer endpoints to `protectedApiPaths`.
3. `CRM/src/auth.ts` — Read `AuthService`, `PublicUser`, and cookie-backed session behavior at lines 7–70. Keep article administration behind the existing `admin` role and implement the distinct, customer-scoped portal session without widening `UserRole`.
4. `CRM/src/ticket.ts` — Read the `SupportTicket` and `TicketHistoryEntry` public/internal contracts before defining a reduced portal ticket response. Do not serialize the full agent-facing ticket contract from a public endpoint.
5. `CRM/src/ticket-repository.ts` — Read ticket retrieval and `listHistory` at lines 41–69. Add customer-scoped portal lookup methods or a focused portal repository using parameterized queries; preserve `created_at DESC, id DESC` ordering.
6. `CRM/src/communication-validation.ts` — Read `validatePublicWebRequest` and its normalized-input/error pattern before adding portal access and feedback validation. Reuse its rules for a new support request rather than accepting unvalidated browser data.
7. `CRM/public/support-request.html` — Read the public form and its field limits at lines 1–40. Replace this isolated request page with the portal entry experience while preserving the endpoint's currently supported submission fields.
8. `CRM/public/support-request.ts` — Read the pending-submit, safe feedback, and reset behavior at lines 1–29. Reuse its request/error conventions in the portal client.
9. `CRM/public/pages/shared.ts` — Read `protectedPages`, `renderProtectedShell`, and `route` at lines 1–70. Keep the knowledge-base/portal routes outside this authenticated agent SPA and leave role-filtered staff navigation intact.
10. `CRM/tests/public-web-request.test.ts` — Read public request setup and the existing creation, invalid-input, and disabled-channel coverage at lines 8–50. Extend it rather than changing the current public request behavior without regression coverage.
11. `CRM/tests/tickets.test.ts` — Read ticket creation/history assertions at lines 8–43. Use its in-memory database and seeded-customer pattern for portal ownership, status, and history tests.
12. [Story 08 plan](../manage-support-tickets/08-story-manage-support-tickets-CRM-23.md) — Follow its additive SQLite and ticket-history conventions, but enforce the stricter public data projection specified by this story.

---

## Product rules (from story)

- Knowledge article types are exactly `faq`, `help`, `solution`, or `guide`. A category is a required normalized string, not a free-form article type.
- Articles have `draft` or `published` status. Only `published` articles appear in public lists, search results, article routes, and the portal; administrators can see both statuses.
- Public search matches normalized article title, summary, body, category, and type. Return published matches only, ordered by most recently updated first, with deterministic id tie-breaking and pagination.
- Customer portal verification requires a normalized customer email and an existing ticket number belonging to that same customer. On success, issue an opaque, HTTP-only, same-site portal cookie valid for one hour; never return a session token in JSON.
- A portal session scopes every ticket, history, and feedback query to exactly that verified customer id. Return the generic `404` response for an unknown ticket number, an unknown email, or a ticket/email mismatch so callers cannot use the endpoint to enumerate customers or tickets.
- Portal ticket responses expose only ticket number, subject, category, status, created/updated dates, due date, escalation state, and a customer-safe activity timeline. Exclude `customerId`, customer contact fields, `assignedAgent`, priority, SLA fields, internal comments, communications, staff actor identities, and internal automation/history actions.
- Public feedback requires a portal session, ticket number owned by the session customer, a rating from 1 through 5, and a trimmed message. Allow exactly one feedback entry per ticket/customer pair; return `409` for a repeat submission. Persist feedback independently; a feedback submission does not edit the ticket or append a staff-visible ticket-history event.

## Backend Tasks

### 1 — Add knowledge-base and portal contracts, validation, and schema

- **Create file: `CRM/src/knowledge-base.ts`.** Export literal `articleTypes` and `articleStatuses` arrays, `KnowledgeArticle`, `CreateKnowledgeArticleInput`, public article-list/detail projections, portal-ticket projection, portal-activity projection, and `CreateTicketFeedbackInput` contracts. Keep article ids, timestamps, status, and publication state server-generated or server-controlled.
- **Create file: `CRM/src/knowledge-base-validation.ts`.** Export `validateKnowledgeArticle`, `validateArticleSearch`, `validatePortalAccess`, and `validateTicketFeedback`. Match the `{ value, errors }` normalization pattern used by `validatePublicWebRequest`; reject invalid enum values, missing/oversize title/category/summary/body, malformed ticket numbers, invalid rating, and empty/oversize feedback messages before repository calls.
- **Modify `CRM/src/database.ts`** at lines 54–116. Add `knowledge_articles` with type, category, title, summary, body, status, `published_at`, `created_at`, and `updated_at`; add public-list/search indexes covering status/type/category and deterministic publication/update ordering. Add `portal_sessions` with an opaque token hash, customer foreign key, expiry, and creation timestamp; add `ticket_feedback` with a ticket foreign key, customer foreign key, rating, message, timestamp, and unique `(ticket_id, customer_id)` constraint. Enforce the ticket/customer relationship in repository logic before insert; retain foreign keys and use cascade deletion only for data whose parent deletion is already supported by the application.

### 2 — Implement repositories and safe public projections

- **Create file: `CRM/src/knowledge-base-repository.ts`.** Implement parameterized admin CRUD, published list/search/detail, and article row mapping. `deleteArticle` must return `false` when absent; list/search must return the existing `{ items, page, pageSize, total, totalPages }` pagination shape.
- **Create file: `CRM/src/customer-portal-repository.ts`.** Implement portal-session creation/lookup/revocation, email-plus-ticket ownership lookup, customer-scoped ticket listing/detail/history projection, and feedback insertion. Hash the random portal token before storage, compare only hashed values, delete/ignore expired sessions during lookup, and never return the stored hash.
- Build a portal activity mapper that admits only `created`, `updated`, `status_changed`, `escalated`, and `responded` ticket-history actions. For all entries, return a customer-readable label and timestamp; omit `changedBy`, raw old/new values, and all other history actions.
- Build a portal ticket mapper directly from `support_tickets` and customer-owned history. Do not reuse `TicketRepository.getTicket` or `listHistory` as the response body because their `SupportTicket` and `TicketHistoryEntry` data include staff-only fields.

### 3 — Add administration and public HTTP APIs

- **Modify `CRM/src/server.ts`** at lines 24–66 and 245–314. Construct the new repositories from `customerRepository.getDatabase()`. Add `/api/articles` to the authenticated path list and require `isAdmin` for every write, publish/unpublish, and admin list/detail route. Preserve the current admin restriction for customer and communication management.
- Add admin `GET /api/articles`, `POST /api/articles`, `GET /api/articles/:id`, `PATCH /api/articles/:id`, and `DELETE /api/articles/:id`. Validate article ids with the existing positive-integer convention; return `201`, `200`, `204`, `400`, `404`, and generic non-sensitive `500` responses consistently with the surrounding handlers.
- Add public `GET /api/public/articles`, `GET /api/public/articles/:id`, and search query support. The handler must query published records only, validate pagination/search/type/category input, and return `404` for draft or absent articles.
- Preserve `POST /api/public/web-requests` at lines 245–260 and its `web_form` enablement behavior. Extend its success response only with a portal-entry URL containing the non-secret ticket number; do not return customer ids, email addresses, opaque portal credentials, staff ticket fields, or any internal communication data.
- Add public `POST /api/public/portal-sessions` to verify email/ticket-number ownership, set the HTTP-only portal cookie, and return only a successful-session response; add `DELETE /api/public/portal-sessions` to clear it. Add portal-cookie middleware used by `GET /api/public/portal/tickets`, `GET /api/public/portal/tickets/:ticketNumber`, `GET /api/public/portal/tickets/:ticketNumber/history`, and `POST /api/public/portal/tickets/:ticketNumber/feedback`.
- Serve `/knowledge-base`, `/knowledge-base/:id`, and `/portal` as explicit public pages beside `/support/request` at lines 312–314. Keep all staff page routing and the final SPA fallback unchanged.

## Frontend Tasks

### 4 — Create the public knowledge-base experience

- **Create file: `CRM/public/knowledge-base.html`.** Provide the unauthenticated knowledge-base shell with search, type/category filters, article-result container, article-detail state, clear navigation to `/portal`, and accessible empty/error/loading states.
- **Create file: `CRM/public/knowledge-base.ts`.** Fetch only the public article API using `credentials: "same-origin"`, render all server strings through an HTML-escaping helper, debounce search input, synchronize filters/page/detail navigation with the URL, and render no article body from draft/unpublished API responses.
- **Modify `CRM/public/index.html`** at lines 67–90. Add an administrator Knowledge Base link and responsive styles for the protected article management page, without exposing it to `agent` users through the `protectedPages` role filter in `CRM/public/pages/shared.ts` lines 32–35.
- **Create file: `CRM/public/pages/knowledge-base.ts`.** Add the protected administrator list/search/filter view and create/edit/delete/publish controls. Disable active submit/delete controls during requests, preserve input and show field errors on failure, and refresh only after a successful API response.
- **Modify `CRM/public/pages/shared.ts`** at lines 1–70. Add `/admin/knowledge-base` to `protectedPages` and dispatch it to `renderKnowledgeBase`; reserve public `/knowledge-base` for the standalone public client. Update `protectedPagePaths` in `CRM/src/server.ts` lines 28–31 with the same `/admin/knowledge-base` route, preserving the existing role filter.

### 5 — Replace the isolated request form with the customer portal

- **Modify `CRM/public/support-request.html`** at lines 26–38. Keep submission fields and the public `POST /api/public/web-requests` flow, then add links to knowledge-base search and portal access. After a successful request, present the ticket number and a direct portal action without writing email or ticket data into browser storage.
- **Create file: `CRM/public/portal.html`.** Render a public portal shell with an initial email/ticket-number verification form and a session-only workspace containing submitted-ticket list, status/history detail, feedback form, knowledge-base search link, submit-request link, and logout action.
- **Create file: `CRM/public/portal.ts`.** Submit verification with `credentials: "same-origin"`; after success fetch ticket list/detail/history from the portal endpoints. Escape every API value before DOM insertion, route status/history navigation with the URL, clear page state after logout/401/404, and keep form values plus API field errors on validation failure. Do not include customer email, ticket payloads, or portal cookies in `localStorage`, query strings, or rendered debug output.
- Update the public CSS in `CRM/public/support-request.html` and the new public pages so article cards, ticket rows, history events, long text, and feedback controls wrap and remain usable below 720px.

## Edge Cases & Failure Modes

- Draft or deleted article requested through a public list, search, or detail URL: return no draft data and use `404` for direct lookup; enforce in the published query methods introduced beside `CRM/src/database.ts` lines 54–73 and public article handlers added to `CRM/src/server.ts` before line 261.
- Invalid article input, invalid type/status, or blank category/title/body: return `400` field errors and persist nothing; enforce in `CRM/src/knowledge-base-validation.ts` and the admin handlers.
- Unknown customer email, unknown ticket number, or a ticket belonging to a different customer during portal verification: return the same generic `404`, set no portal cookie, and reveal no ownership data; enforce in `CustomerPortalRepository` and `POST /api/public/portal-sessions`.
- Missing, malformed, expired, revoked, or tampered portal cookie: return `401`, clear client portal state, and show the verification form; enforce in portal-cookie middleware and `CRM/public/portal.ts`.
- Customer attempts to request a ticket/history/feedback record outside its portal session: return `404` with no staff or customer fields; enforce customer-id predicates in every portal repository query.
- Ticket contains internal comments, communications, agent assignment, priority, SLA fields, automation entries, or history actor values: omit them from every public projection; enforce in the dedicated mapper rather than `TicketRepository.getTicket`/`listHistory` at `CRM/src/ticket-repository.ts` lines 41–69.
- Replayed or double-clicked feedback submission: disable the submit control while pending; the unique `(ticket_id, customer_id)` constraint returns `409` after the first successful feedback and leaves the original feedback intact; enforce in `ticket_feedback` schema, the repository insert, and `CRM/public/portal.ts`.
- Disabled `web_form` channel: preserve the existing `403` response and create neither ticket nor communication; enforce in `CRM/src/server.ts` lines 245–260 and retain the regression at `CRM/tests/public-web-request.test.ts` lines 41–50.
- Search input containing HTML, Unicode, punctuation, empty text, or a stale page number: normalize/filter with parameters, escape rendered output, return a stable empty result, and clamp pagination; enforce in validation/repository and `CRM/public/knowledge-base.ts`.

## Test Plan

1. **Unit — create `CRM/tests/knowledge-base-validation.test.ts`:** cover normalized article fields, every article type/status, text limits, valid/invalid portal ticket number and email, ratings 1–5, feedback text limits, search/filter validation, and malformed pagination.
2. **Unit — create `CRM/tests/knowledge-base-repository.test.ts`:** use `createDatabase(":memory:")` to cover article CRUD, publish state, published-only deterministic search/filter/pagination, absent delete/update behavior, hashed/expired portal sessions, customer-scoped ticket projections, filtered activity actions, and feedback persistence.
3. **Integration — create `CRM/tests/knowledge-base.test.ts`:** seed admin/agent sessions using the pattern in `CRM/tests/tickets.test.ts` lines 8–19; cover admin authorization and article create/edit/delete/publish lifecycle, public published list/search/detail, and `404` for drafts.
4. **Integration — create `CRM/tests/customer-portal.test.ts`:** create two customers and tickets with the existing request helper pattern in `CRM/tests/public-web-request.test.ts` lines 15–31. Cover portal verification, cookie reuse, list/detail/status/history projection, cross-customer denial, expiry/logout denial, feedback validation/persistence, and public-field redaction.
5. **Integration — modify `CRM/tests/public-web-request.test.ts`:** retain the current ticket-plus-communication assertions at lines 17–32 and assert the success payload/link can start the portal flow without leaking customer identity or a portal secret.
6. **Browser smoke:** create and publish each article type as an administrator; search/view them anonymously; submit a request; verify with its email/ticket number; inspect ticket status/history; submit feedback; verify responsive layouts; and confirm an agent cannot open the article administration page.
7. **Regression:** from `CRM/`, retain all tickets, communications, automation, agent-work, authentication, and public-web-request suites.

## Migration / Rollback

- The schema changes are additive: create knowledge articles, portal sessions, and feedback tables/indexes without changing existing customer, ticket, communication, or history rows.
- If deployment fails after schema initialization, leave empty additive tables in place; the previous application ignores them. Do not drop populated article or feedback data as a rollback shortcut.
- If portal-session or feedback writes fail, roll back the current transaction and do not set a success cookie or show a success message. Expired sessions are safe to retain temporarily because lookup rejects them; remove them during normal session cleanup.

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`; verify public `/knowledge-base`, `/portal`, and `/support/request`, then log in as an administrator to create/publish/search/edit/delete an article and verify agent access remains restricted.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm TypeScript compiles the knowledge-base/portal contracts, repositories, routes, and public/protected clients.
3. **Regression:** from `CRM/`, run `npm test` and confirm all new knowledge-base/portal suites plus existing authentication, ticket, communication, automation, and public request tests pass.

## Done Criteria

- [ ] Administrators can create, edit, delete, categorize, and publish/unpublish knowledge articles.
- [ ] Anonymous visitors can search and read published FAQs, help articles, solutions, and guides, but cannot retrieve drafts.
- [ ] Customers can submit a support ticket through the existing public request flow.
- [ ] A verified customer portal session lists only that customer's submitted tickets and exposes each ticket's safe status/history projection.
- [ ] Portal verification and every portal resource prevent cross-customer data disclosure.
- [ ] Customers can submit validated feedback for their own tickets.
- [ ] Internal assignments, comments, communications, automation data, SLA details, customer contact data, and staff identities never appear in public responses.
- [ ] Existing staff authentication, ticket, communication, automation, and public request behavior continues to pass regression tests.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 13.**
