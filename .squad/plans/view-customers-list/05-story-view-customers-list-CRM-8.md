# Story 05 — View Customer List (Story: CRM-8)

## Prerequisites

- Story 04 completed: [04-story-add-customer-CRM-9.md](../add-customer/04-story-add-customer-CRM-9.md). Reuse its SQLite schema, `Customer` contract, validation rules, and `CustomerRepository` instead of creating a second customer store.
- Stories 01–03 completed: [01-story-login-CRM-4.md](../login/01-story-login-CRM-4.md), [02-story-protect-crm-pages-CRM-6.md](../protect-crm-pages/02-story-protect-crm-pages-CRM-6.md), and [03-story-navigation-and-logout-CRM-5.md](../navigation-and-logout/03-story-navigation-and-logout-CRM-5.md). Preserve authenticated navigation, protected `/customers`, and session/logout behavior.
- The current Customers view already fetches `GET /api/customers` and renders name, email, company, and status, but it does not render phone or created date and has no View/Edit/Delete actions.

---

## Story Goal

Display all customers available to the authenticated CRM user in a readable, responsive list with customer name, email, phone, company, status, created date, and available View, Edit, and Delete actions. Show loading, empty, and error states while retrieving data from the backend.

Customer creation is already covered by Story 04. This story adds list presentation and customer action boundaries; advanced filtering, pagination, bulk actions, export, and customer-specific authorization roles are out of scope.

---

## Context — Read These Files First

1. `CRM/public/login.ts` — Read `renderCustomers` and `submitCustomer` around lines 70–120. The current list fetches `/api/customers`, renders only four customer fields, and reuses the Add Customer view; extend this code with loading/error/empty states, full field rendering, and action controls.
2. `CRM/src/customer.ts` — Read the `Customer` and `CreateCustomerInput` contracts around lines 1–20. Use the server-generated `id`, `createdAt`, and `updatedAt` fields for list rows and action URLs; do not expose database column names to the browser.
3. `CRM/src/customer-repository.ts` — Read `createCustomer`, `listCustomers`, and `getCustomer` around lines 16–38. Extend the repository with detail, update, and delete operations using parameterized statements and deterministic list ordering.
4. `CRM/src/customer-validation.ts` — Read `validateCustomer` around lines 1–22. Reuse its normalization and field constraints for edits, and define a separate id/route validation rule for customer actions.
5. `CRM/src/server.ts` — Read the protected customer middleware and `GET /api/customers` / `POST /api/customers` handlers around lines 20–50. Keep all customer action endpoints behind the existing authentication guard and return JSON errors rather than HTML redirects.
6. `CRM/public/index.html` — Read the customer list styles around lines 40–78. Extend the current row layout into a readable table/list that remains usable at mobile widths and keeps action controls visually distinct.
7. `CRM/tests/auth.test.ts` — Read the authenticated customer tests around lines 80–102. Preserve the in-memory SQLite injection pattern when testing list and action endpoints.
8. `CRM/package.json` — Use the existing `npm test`, `npm run build`, and `npm run dev` commands from `CRM/` for verification.
9. `.squad/stories/view-customers-list/CRM-8/intake.md` — Treat the CRM-8 fields, actions, and loading/empty criteria as the product contract; attachments are listed as none.
10. [Story 04 plan](../add-customer/04-story-add-customer-CRM-9.md) — Match the customer persistence and API error conventions established by the preceding story.

---

## Implementation tasks

### 1 — Complete the customer query and action contract

- **Modify `CRM/src/customer-repository.ts`** to support `getCustomer`, `updateCustomer`, and `deleteCustomer` with parameterized SQL. Return `null` or an explicit not-found result for an unknown id; never leak SQL errors.
- **Modify `CRM/src/server.ts`** so `GET /api/customers` returns the complete safe customer projection: id, name fields, email, phone, company, status, address/notes where needed by View, and created date. Preserve deterministic ordering and the existing `401` middleware.
- Add protected `GET /api/customers/:id` for View, `PATCH /api/customers/:id` for Edit, and `DELETE /api/customers/:id` for Delete. Return `200` for successful View/Edit, `204` for successful Delete, `404` for an unknown customer, `400` for invalid ids or edit data, and `401` for unauthenticated requests.
- Keep server-managed id and timestamps immutable from client input. Reuse customer validation for editable fields and return stable JSON validation errors.
- Return a generic JSON `500` error for repository failures without exposing database paths, SQL, or stack traces.

### 2 — Render the complete Customers list

- **Modify `CRM/public/login.ts`** so `renderCustomers` shows a loading state before the `GET /api/customers` request, a readable empty state for zero records, a recoverable error state for failed requests, and a full list/table for populated results.
- Render customer name, email, phone, company, status, and a human-readable created date. Escape all server-provided text before inserting it into HTML.
- Add a View action that opens a detail view or modal containing the selected customer’s safe fields and a close/back action that preserves the list.
- Add an Edit action that reuses the customer form with existing values, submits `PATCH /api/customers/:id`, shows loading/errors, and refreshes the list after success.
- Add a Delete action with explicit confirmation, submits `DELETE /api/customers/:id`, removes the row after success, and shows a recoverable error when deletion fails.
- Keep the Add Customer action, sidebar, active Customers state, Logout control, protected auth check, and responsive layout intact.

### 3 — Make list states and actions accessible

- **Modify `CRM/public/index.html`** to style the list as a readable table on wide screens and a non-overflowing stacked row/card layout on narrow screens. Keep created date and actions visible without clipping.
- Give every action an accessible name containing the customer name, provide confirmation text for Delete, and expose loading/success/error feedback through status or alert regions.
- Ensure View/Edit/Delete controls are disabled while their operation is pending and cannot submit duplicate requests.
- Preserve `Cache-Control: no-store` behavior for protected page responses and do not cache or store customer data in browser storage.

### 4 — Add list and action tests

- **Modify `CRM/tests/auth.test.ts`** to verify authenticated list results contain phone and created date and unauthenticated list/action requests remain `401` JSON.
- **Create `CRM/tests/customer-list-api.test.ts`** for deterministic ordering, complete safe projection, View success/not-found, Edit validation/success/not-found, Delete success/not-found, and generic persistence failure responses.
- **Create `CRM/tests/customer-list-ui.test.ts`** or the repository’s chosen browser test file for loading, empty, populated, API-error, View, Edit, Delete confirmation, Delete success, and Delete failure states.
- Verify action responses never expose password data, internal database fields, or raw exception text.

---

## Edge Cases & Failure Modes

- No customers: show the empty state and keep Add Customer available; enforce in `renderCustomers` after a successful empty list response.
- Slow list request: show a loading state immediately and prevent duplicate list requests from overlapping page initialization; enforce in the Customers view request lifecycle.
- List request failure or expired session: show a recoverable error or return to Login when the API reports `401`; enforce in the client response handler and existing auth boundary.
- Missing or invalid customer id: return `400` for malformed ids and `404` for valid but unknown ids; enforce in route handlers before repository calls.
- View/Edit/Delete for an unknown customer: show a not-found message and leave the remaining list usable; enforce in API status handling and action UI state.
- Invalid edit data: return field-level `400` errors and preserve the edit form values for correction; reuse `validateCustomer`.
- Delete confirmation cancelled: do not call the API or change the list; enforce in the Delete action handler.
- Duplicate View/Edit/Delete clicks: disable the active control until completion and avoid duplicate mutations; enforce in client action state.
- API or database failure during Edit/Delete: keep the row and show a retryable generic error; do not remove or update the row optimistically before success.
- Unsafe customer text: escape names, company, notes, and other server values before HTML rendering; enforce through the existing `escapeHtml` helper.
- Long names, phone numbers, or dates on mobile: wrap or stack content without horizontal page overflow or clipped actions; enforce in responsive list styles.
- Direct navigation without authentication: preserve protected `/customers` redirect and protected API `401` behavior from Story 02.

---

## Test Plan

1. **Unit:** test customer projection, safe date formatting, id validation, and action-state transitions.
2. **Unit:** test repository list ordering, detail lookup, update, delete, not-found results, and parameterized mutation behavior using an isolated SQLite database.
3. **Integration:** verify authenticated `GET /api/customers` returns all required list fields and deterministic ordering.
4. **Integration:** verify View, Edit, and Delete endpoints succeed for an existing customer and return correct `400`/`404`/`401` responses for invalid requests.
5. **Integration:** verify failed mutations do not alter the stored row and responses contain no internal database details.
6. **Browser smoke:** verify loading, populated list, empty state, and API error state.
7. **Browser smoke:** verify View opens the selected customer, Edit persists changes and refreshes the row, and Delete requires confirmation before removing a customer.
8. **Browser smoke:** verify responsive rendering at narrow width keeps fields and available actions usable.

---

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, sign in, open Customers, confirm all required columns/fields and states, then exercise View, Edit, and Delete.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm the repository, API, UI, and test changes compile.
3. **Regression:** from `CRM/`, run `npm test` and confirm login, protection, Add Customer, list retrieval, View, Edit, Delete, and error-state tests pass.

---

## Done Criteria

- [ ] Authenticated Customers displays customer name, email, phone, company, status, and created date.
- [ ] Customers are retrieved from the backend through an authenticated API.
- [ ] Loading state is visible while the list request is pending.
- [ ] Empty state is visible when no customers exist.
- [ ] Customer data is displayed in a readable responsive list/table.
- [ ] View action displays the selected customer safely.
- [ ] Edit action validates and persists customer changes.
- [ ] Delete action requires confirmation and removes the customer only after successful API completion.
- [ ] API errors and not-found responses are displayed without exposing internal details.
- [ ] Unauthenticated users cannot access customer list or action APIs.
- [ ] Automated and browser smoke tests cover list fields, states, and all available actions.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 06.**