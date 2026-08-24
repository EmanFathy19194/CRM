# Story 04 — Add Customer (Story: CRM-9)

## Prerequisites

- Story 01 completed: [01-story-login-CRM-4.md](../login/01-story-login-CRM-4.md). Reuse the existing TypeScript/Express application and validation conventions.
- Story 02 completed: [02-story-protect-crm-pages-CRM-6.md](../protect-crm-pages/02-story-protect-crm-pages-CRM-6.md). Keep `/customers` and customer APIs behind the existing `crm_session` authentication guard.
- Story 03 completed: [03-story-navigation-and-logout-CRM-5.md](../navigation-and-logout/03-story-navigation-and-logout-CRM-5.md). Add the Add Customer entry point within the existing authenticated navigation and Customer page boundary.
- The repository currently has no database, customer model, customer form, or customer persistence service. Add a durable SQLite store and document its local/deployment configuration before claiming database storage is complete.

---

## Story Goal

Allow an authenticated CRM user to open an Add Customer form, enter valid customer information, submit it to the backend, store it in the database, and see the new customer in the customer list with a success message.

The customer record contains first name, last name, email, phone, company, job title, status, address, and notes. Editing, deleting, importing, deduplication workflows, contact management, and customer authorization roles are out of scope.

---

## Context — Read These Files First

1. `CRM/src/server.ts` — Read `protectedApiPaths`, the protected API middleware, the `GET /api/customers` placeholder, `protectedPagePaths`, and `createApp` around lines 8–84. Replace the customer placeholder with authenticated list/create handlers while preserving `401` behavior for missing or expired sessions.
2. `CRM/src/auth.ts` — Read `AuthService.getUser` around lines 32–44 to obtain the authenticated user identity for request authorization and audit ownership if the customer schema requires it.
3. `CRM/src/validation.ts` — Read `validateLogin` and `LoginCredentials` around lines 1–13. Follow its small pure-function validation style, but keep customer validation separate from login validation.
4. `CRM/public/login.ts` — Read `protectedPages`, `renderCurrentPage`, and `renderProtectedPage` around lines 21–76. Extend the existing `/customers` protected placeholder with the customer list, Add Customer form, API submission, success state, and API error handling.
5. `CRM/public/index.html` — Read the authenticated layout and responsive styles around lines 1–60. Add customer form/list styling that fits the existing full-page sidebar layout and remains usable on narrow screens.
6. `CRM/tests/auth.test.ts` — Read the existing `request.agent(createApp(auth))` pattern around lines 45–81. Reuse it to prove customer endpoints remain protected and authenticated requests can create and retrieve records.
7. `CRM/package.json` — Preserve the existing `npm run dev`, `npm run build`, and `npm test` scripts; add database/test dependencies only when required by the selected SQLite implementation.
8. `.squad/stories/add-customer/CRM-9/intake.md` — Treat the CRM-9 fields and acceptance criteria as the product contract; attachments are listed as none.
9. [Story 02 plan](../protect-crm-pages/02-story-protect-crm-pages-CRM-6.md) — Preserve the protected `/customers` route and customer API authentication boundary.

---

## Implementation tasks

### 1 — Define durable customer storage

- **Create `CRM/src/customer.ts`** with the customer data contract and a separate create-input contract. Return records with an id and timestamps, and do not accept client-supplied ids or timestamps.
- **Create `CRM/src/customer-validation.ts`** with a pure validator for required first name, last name, email, and status; email format; phone format; and bounded lengths for every text field. Normalize email and trim text before persistence.
- **Create `CRM/src/database.ts`** using SQLite with a repository-owned database path configured outside source control. Create the customers table through an idempotent initialization/migration step with required columns, status, timestamps, and indexes needed for customer list retrieval.
- **Create `CRM/src/customer-repository.ts`** with parameterized `createCustomer` and `listCustomers` operations. Wrap inserts in a transaction, return the stored record, and never interpolate user input into SQL.
- **Modify `CRM/package.json`** to add the selected SQLite runtime and type declarations, plus any migration/initialization script required by the chosen library.
- **Modify `CRM/README.md`** to document database initialization, the local database location/configuration, the test database strategy, and the customer API commands.

### 2 — Add authenticated customer APIs

- **Modify `CRM/src/server.ts`** so `GET /api/customers` reads from `customer-repository` instead of returning a hard-coded empty array.
- Add `POST /api/customers` under the existing protected API middleware. Validate the request body with `customer-validation`, return `400` with field-level errors for invalid input, and return `201` with the persisted customer for valid input.
- Do not accept or persist unknown fields that could override ids, timestamps, ownership, or server-managed values. Do not return internal database details.
- Return a stable JSON error for persistence failures without exposing SQL, filesystem paths, or stack traces. Keep unauthenticated requests at `401 Unauthorized`.
- Ensure list results include the newly created record after a successful `POST` and use deterministic ordering, such as newest created record first.

### 3 — Build the Add Customer experience

- **Modify `CRM/public/login.ts`** so the protected `/customers` view renders a customer list and an Add Customer form containing First Name, Last Name, Email, Phone, Company, Job Title, Status, Address, and Notes.
- Make First Name, Last Name, Email, and Status visibly required. Provide a controlled status option set with a documented default or require an explicit selection; keep the UI rule consistent with the backend validator.
- Validate email and phone formats before sending. Prevent submission while the request is in progress and show a clear loading state.
- Submit only the allowed customer fields to `POST /api/customers`. Display field-level validation errors and a generic API error without exposing raw backend details.
- After a successful `201`, show a success message, clear the form, and refresh the customer list so the new customer appears immediately.
- Preserve the sidebar, active Customers state, protected-page authentication check, Logout control, and Back/Forward behavior established by Stories 02 and 03.

### 4 — Add customer tests

- **Create `CRM/tests/customer-validation.test.ts`** for required fields, email format, phone format, status, whitespace normalization, maximum lengths, and rejection of unknown/invalid values.
- **Create `CRM/tests/customer-repository.test.ts`** using an isolated test database for insert, retrieval, deterministic ordering, generated ids/timestamps, and rollback on failed insert.
- **Modify `CRM/tests/auth.test.ts`** to verify unauthenticated `GET /api/customers` and `POST /api/customers` return JSON `401`.
- **Create `CRM/tests/customer-api.test.ts`** to verify valid authenticated creation returns `201`, invalid input returns `400` without persistence, the response omits internal fields, and a subsequent list contains the new customer.
- Add browser smoke coverage for opening Customers, opening the Add Customer form, required/format validation, loading state, success feedback, list refresh, and API error display.

---

## Edge Cases & Failure Modes

- Missing required first name, last name, email, or status: reject before persistence and return field-level `400` errors; enforce in `customer-validation` and repeat at the API boundary.
- Invalid email or phone format: prevent the browser request and reject server-side with the same normalization rules; enforce in `CRM/src/customer-validation.ts` and the form handler.
- Whitespace or mixed-case email: trim text and normalize email consistently before duplicate checks or persistence; enforce in the customer validation/repository boundary.
- Oversized or unknown fields: reject or ignore fields outside the customer contract and enforce bounded lengths before SQL execution; never allow client values to set ids or timestamps.
- Missing or invalid session: return JSON `401 Unauthorized` for both customer endpoints and do not reveal customer data; enforce through the existing middleware in `CRM/src/server.ts`.
- Duplicate submission: disable the form submit control while the request is pending and ensure the API creates at most one record per accepted request; enforce in the client state and repository transaction.
- Database unavailable or insert failure: return a generic error, keep the form data available for retry, and do not show a false success message; enforce in the API error handler and client response handling.
- Partial database initialization: run idempotent schema initialization before repository use and fail clearly without silently storing data elsewhere; enforce in `CRM/src/database.ts`.
- Empty customer list: render an intentional empty state with the Add Customer action still available; enforce in the Customers view.
- Browser refresh after creation: load from `GET /api/customers` so the persisted record remains visible and is not dependent on client memory; enforce in the protected Customers view initialization.

---

## Test Plan

1. **Unit:** validate the customer contract, required fields, email/phone formats, normalization, status values, length limits, and unknown-field handling.
2. **Unit:** test SQLite repository insert/list behavior, generated server fields, ordering, parameterization, and transaction rollback using an isolated test database.
3. **Integration:** verify unauthenticated customer list/create requests return `401` JSON.
4. **Integration:** verify authenticated valid creation returns `201` and the created customer appears in the authenticated list.
5. **Integration:** verify invalid requests return `400`, include actionable field errors, and do not create a database row.
6. **Integration:** verify database failures return a generic API error and do not produce a success response.
7. **Browser smoke:** verify the Add Customer form, validation, loading state, success message, list refresh, empty state, and API error state.

---

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, sign in with the documented test user, open Customers, create a valid customer, and verify the new record appears in the list.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm the customer types, repository, database, API, and browser changes compile.
3. **Regression:** from `CRM/`, run `npm test` and confirm login, protected routes, customer validation, repository, API, and browser-facing regression coverage passes.

---

## Done Criteria

- [ ] An authenticated user can open the Add Customer form from Customers.
- [ ] The form contains all nine requested customer fields.
- [ ] First Name, Last Name, Email, and Status are required.
- [ ] Email and phone formats are validated in the browser and backend.
- [ ] Invalid data cannot be submitted or persisted.
- [ ] Valid customer data is sent to the authenticated backend API.
- [ ] The backend validates and stores the customer in a durable SQLite database.
- [ ] A successful creation returns a success message and the new customer appears in the list.
- [ ] API errors are handled without exposing internal database details.
- [ ] Unauthenticated customer API requests remain protected with `401 Unauthorized`.
- [ ] Automated tests cover validation, persistence, API behavior, and the customer UI workflow.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 05.**