# Story 07 — Manage Customer Records (Story: CRM-22)

## Prerequisites

- Story 06 completed: [06-story-view-customer-details-CRM-10.md](../customer-details/06-story-view-customer-details-CRM-10.md). Extend its protected customer detail route, safe customer projection, responsive detail layout, and Back/Forward behavior.
- Stories 01–05 completed: preserve the existing authentication guard, protected navigation, SQLite customer schema, validation, list/search/pagination, and customer CRUD conventions.
- Coordinate the shared API and database contracts across the backend and frontend owners before implementation. Do not expose attachment filesystem paths or accept client-supplied customer ids/timestamps.

---

## Story Goal

Allow an authenticated CRM user to maintain a complete customer record and its related history from the customer detail experience.

1. Edit or deactivate/delete a customer, search and filter the customer list, and keep all customer data persisted in the backend.
2. Add, edit, and delete distinct customer notes.
3. Upload, view/download, and delete customer attachments.
4. Add interactions and view their history, with interaction types limited to calls, emails, messages, meetings, and notes.
5. Ensure every note, attachment, and interaction is associated with the requested customer and cannot be accessed through another customer id.

The existing `customers.notes` field is legacy profile text; this story adds a separate notes collection and must preserve that field for backward compatibility. Contacts, opportunities, tasks, and unrelated CRM entities remain out of scope.

## Context — Read These Files First

1. `CRM/src/customer.ts` — Read `CreateCustomerInput` and `Customer` around lines 1–20. Preserve the public customer field names and server-generated id/timestamps while adding contracts for note, attachment, and interaction responses.
2. `CRM/src/customer-validation.ts` — Read `validateCustomer` and its `fields`/length rules around lines 1–22. Reuse its normalization style for customer edits and add bounded validation for note, interaction, and attachment metadata inputs.
3. `CRM/src/customer-repository.ts` — Read `mapCustomer`, `listCustomers`, `getCustomer`, `updateCustomer`, and `deleteCustomer` around lines 4–62. Extend this repository or a focused adjacent repository with parameterized customer-scoped CRUD and deterministic ordering.
4. `CRM/src/database.ts` — Read SQLite initialization around lines 1–25. Add idempotent tables/indexes and foreign keys for notes, attachments, and interactions; preserve existing databases and customer rows.
5. `CRM/src/server.ts` — Read `protectedApiPaths`, the authentication middleware, customer handlers, and protected page routes around lines 8–151. Keep all new endpoints behind the existing session guard, validate positive integer customer ids before repository calls, and retain stable `400`/`401`/`404`/`500` JSON behavior.
6. `CRM/public/pages/customers.ts` — Read `renderCustomers`, `handleAction`, and `submitCustomer` around lines 5–45. Replace the current prompt-based edit flow with a complete validated edit action, add search/filter controls, and preserve list pagination and existing View/Delete behavior.
7. `CRM/public/pages/customer-details.ts` — Read `renderCustomerDetails` around lines 3–12. Extend the existing detail view with edit/deactivate/delete controls, separate notes, attachments, and interaction-history sections, loading/error states, and customer-scoped mutation refreshes.
8. `CRM/public/pages/shared.ts` — Read `escapeHtml`, `renderProtectedShell`, and `route` around lines 1–39. Preserve HTML escaping, authentication re-checks, protected navigation, logout, and direct detail-route handling.
9. `CRM/public/index.html` — Read the customer form/list/detail styles around lines 40–78 and responsive rules around lines 80–81. Add usable controls, forms, attachment links, history rows, and mobile layouts without horizontal overflow.
10. `CRM/tests/auth.test.ts` — Read the authenticated customer, detail, and search tests around lines 80–147. Reuse the in-memory SQLite and `request.agent(createApp(auth, repository))` patterns for authenticated and cross-customer isolation tests.
11. `CRM/package.json` — Preserve `npm test`, `npm run build`, and `npm run dev`; add only the multipart/upload dependency and type declarations selected for the implementation.
12. `.squad/stories/manage-customer-records/CRM-22/intake.md` — Use the CRM-22 acceptance criteria as the product contract; the attachment list contains none.
13. [Story 05 plan](../view-customers-list/05-story-view-customers-list-CRM-8.md) and [Story 06 plan](../customer-details/06-story-view-customer-details-CRM-10.md) — Match the established customer action, safe rendering, protected API, and responsive UI conventions.

---

## Product rules (from story)

- Customer deletion may be represented as deactivation by setting the existing customer `status` to `inactive`; retain a confirmed hard-delete path only if it does not violate related-record integrity. The UI must label the selected action accurately.
- Profile `customers.notes` remains available as legacy customer information. New note actions operate on a separate timestamped notes collection so add/edit/delete notes do not overwrite profile data.
- Attachment binaries are stored outside `public/` and are served only through authenticated customer-scoped download responses. Never return a local path to the browser.
- Interaction `type` accepts only `call`, `email`, `message`, `meeting`, or `note`.

## Backend Tasks

### 1 — Add associated customer data contracts and schema

- **Modify `CRM/src/customer.ts`** with public response types for `CustomerNote`, `CustomerAttachment`, and `CustomerInteraction`. Use server-generated ids/timestamps, nullable-safe metadata where the database can omit optional values, and a literal interaction-type union matching the product rule.
- **Modify `CRM/src/database.ts`** to create idempotent `customer_notes`, `customer_attachments`, and `customer_interactions` tables keyed by `customer_id`, with foreign keys and indexes supporting customer-scoped history/list queries. Define attachment metadata separately from the private stored binary location and choose an explicit delete policy for customer deletion.
- **Modify `CRM/package.json`** only if needed for a multipart parser. Set bounded upload size and permitted content-type/filename rules in the selected implementation.

### 2 — Extend repository and validation boundaries

- **Modify `CRM/src/customer-repository.ts`** with parameterized operations for customer update/deactivation/deletion, note create/list/update/delete, attachment metadata create/list/delete, and interaction create/list. Every related lookup and mutation must include the requested `customer_id`, return `null`/`false` for missing records, and order notes/interactions deterministically by timestamp and id.
- **Modify `CRM/src/customer-validation.ts`** or add focused validators beside it for note text, interaction type/content, attachment filename/content type/size, positive ids, and customer edit input. Reject oversized, empty, malformed, or unknown values before persistence.
- Keep customer update server-managed fields immutable. Do not use SQL string interpolation for ids, search terms, filenames, or user text.

### 3 — Expand protected customer APIs

- **Modify `CRM/src/server.ts`** to add protected endpoints under the existing customer API boundary:
  - `PATCH /api/customers/:id` for full validated customer edits and `status: "inactive"` deactivation.
  - `DELETE /api/customers/:id` for confirmed deletion if retained by the chosen integrity policy.
  - `GET/POST /api/customers/:id/notes`, `PATCH/DELETE /api/customers/:id/notes/:noteId`.
  - `GET/POST /api/customers/:id/attachments`, `GET/DELETE /api/customers/:id/attachments/:attachmentId`.
  - `GET/POST /api/customers/:id/interactions`.
- Validate customer and related-record ids before repository access. Return `400` for malformed input, `401` from the existing auth middleware, `404` when the customer or customer-owned record is absent, `201` for successful creates, `200` for reads/updates, `204` for deletes, and generic `500` errors without SQL, stack traces, or filesystem paths.
- For attachment download, verify both authenticated ownership and attachment existence, set a safe download filename/content disposition from sanitized metadata, and stream the private file without exposing its storage path. Delete metadata and binary content consistently; define cleanup behavior for partial failures.
- Keep customer search from `listCustomers` and add an explicit status/filter query parameter with validated allowed values. Return deterministic results and avoid making the filter optionality ambiguous.

## Frontend Tasks

### 4 — Complete customer list management

- **Modify `CRM/public/pages/customers.ts`** to replace prompt-based editing with a reusable form populated from the selected customer and submitted through the validated PATCH endpoint. Add a clear inactive/deactivate action and retain confirmed delete behavior if the backend exposes hard delete.
- Add status filtering alongside the existing search field, preserving page reset and pagination when either value changes. Escape all returned text and expose loading, success, validation, not-found, and generic error states through the existing feedback regions.
- Keep action buttons disabled while their request is pending and refresh only after successful server responses. Preserve authenticated navigation, View routing, list state, and Logout.

### 5 — Build the customer record workspace

- **Modify `CRM/public/pages/customer-details.ts`** to fetch the customer and its notes, attachments, and interactions for the current id. Render separate sections with add/edit/delete note controls, attachment upload/download/delete controls, and an interaction form/history list.
- Add customer edit and deactivate/delete controls that reuse the backend validation contract. Show the existing profile notes field separately from the timestamped notes collection.
- Use `FormData` for attachment uploads and show upload progress/pending state at the control level. Use authenticated download URLs or fetch-and-download behavior without placing private storage paths in the DOM.
- Render interaction type labels for calls, emails, messages, meetings, and notes, plus author/content/timestamp metadata returned by the backend. Keep each action scoped to the current customer id and refresh its section after success.
- Preserve loading, not-found, invalid-id, Back to customers, direct refresh, browser Back/Forward, and expired-session handling from the existing detail route.

### 6 — Style and browser coverage

- **Modify `CRM/public/index.html`** with compact forms, action groups, note rows, attachment rows, interaction history, confirmation/error feedback, and responsive rules for long filenames/text. Keep the existing design language and ensure controls remain usable on narrow screens.
- Use `escapeHtml` for all server-provided names, note text, interaction content, filenames, and metadata. Do not render arbitrary attachment MIME types or unsanitized HTML.

## Edge Cases & Failure Modes

- Unknown or cross-customer note/attachment/interaction id: return `404` and make no mutation; enforce customer ownership in repository queries and route handlers in `CRM/src/server.ts` and `CRM/src/customer-repository.ts`.
- Missing/expired session: return JSON `401` for every customer-related API and redirect protected pages through the existing `route` auth check; enforce in `CRM/src/server.ts` and `CRM/public/pages/shared.ts`.
- Malformed, zero, negative, or decimal ids: return `400` before database/file access; enforce at the API boundary.
- Empty or overlong note/interaction content, invalid interaction type, or invalid customer edit: return field-level `400` and preserve form values; enforce in validation and the corresponding frontend form handlers.
- Unsupported, oversized, malformed, or path-traversal attachment: reject before writing a file, sanitize the display filename, and never serve from `public/`; enforce in the multipart boundary and attachment storage service.
- Partial attachment write/delete: do not report success until metadata and binary cleanup are consistent; return a generic retryable error and log only server-side diagnostics.
- Duplicate submits/uploads: disable the active control while pending and refresh after one successful response; enforce in `customers.ts` and `customer-details.ts`.
- Empty notes, attachments, or interaction history: show explicit section empty states while keeping add controls available; enforce in the detail renderer.
- Unsafe Unicode/HTML in customer or related text: preserve valid Unicode as text and escape all HTML insertion; enforce through `escapeHtml` and safe filename handling.
- Customer deactivation/filtering: inactive records remain associated and searchable only according to the selected filter; do not silently hard-delete when the UI says deactivate.
- Customer deletion with related rows: apply the chosen foreign-key cascade/restrict policy consistently and return a recoverable error if deletion is refused; enforce in `database.ts`, repository mutations, and API responses.

## Test Plan

1. **Unit:** test customer, note, attachment metadata, and interaction validators, including length limits, allowed interaction types, positive ids, filename/content-type/size rules, and normalization.
2. **Unit:** test repository CRUD and deterministic ordering for each related record type, customer ownership isolation, deactivation, deletion policy, and parameterized queries with an in-memory database.
3. **Integration:** extend `CRM/tests/auth.test.ts` or add focused API tests for authenticated customer edit/deactivate/delete, search/filter results, and unauthenticated `401` behavior.
4. **Integration:** add note API tests for create/list/update/delete, empty content rejection, not-found, and cross-customer access denial.
5. **Integration:** add interaction API tests for all five allowed types, history ordering, invalid types, not-found, and cross-customer access denial.
6. **Integration:** add attachment API tests for upload metadata, authenticated download, delete, unsupported/oversized/path-traversal rejection, missing files, and cross-customer access denial. Assert responses never expose private filesystem paths.
7. **Browser smoke:** cover customer search/status filter, edit, deactivate/delete confirmation, notes CRUD, attachment upload/download/delete, interaction creation/history, loading/error/empty states, and responsive detail rendering.
8. **Regression:** retain existing login, protected page, add-customer, list, search, detail, and logout tests from `CRM/tests/auth.test.ts`.

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, sign in, search/filter customers, edit/deactivate one, then exercise notes, attachments, and all interaction types on its detail page.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm TypeScript, schema initialization, API, client, and upload handling compile.
3. **Regression:** from `CRM/`, run `npm test` and confirm existing authentication/customer tests plus the new repository, API, attachment, and browser-facing coverage pass.

## Done Criteria

- [ ] Authenticated users can edit customer information and deactivate or delete a customer according to the documented policy.
- [ ] Customers can be searched and filtered through the backend-backed list.
- [ ] Customer records and all related records persist in the backend and remain associated with the correct customer.
- [ ] Users can add, edit, and delete distinct customer notes.
- [ ] Users can upload, view/download, and delete customer attachments without exposed private paths.
- [ ] Users can add interactions and view history for calls, emails, messages, meetings, and notes.
- [ ] Invalid input, unauthorized access, unknown ids, unsafe files, and backend failures produce recoverable non-sensitive errors.
- [ ] Existing authentication, navigation, customer creation, detail routing, responsive layout, and logout behavior continue to work.
- [ ] Automated and browser smoke tests cover the acceptance criteria and customer-isolation boundary.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 08.**
