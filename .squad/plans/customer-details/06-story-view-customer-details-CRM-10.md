# Story 06 — View Customer Details (Story: CRM-10)

## Prerequisites

- Story 05 completed: [05-story-view-customers-list-CRM-8.md](../view-customers-list/05-story-view-customers-list-CRM-8.md). Reuse its customer list, View action, safe customer projection, and protected customer API conventions.
- Story 04 completed: [04-story-add-customer-CRM-9.md](../add-customer/04-story-add-customer-CRM-9.md). Reuse the SQLite `Customer` schema and `CustomerRepository` rather than creating another customer store.
- Stories 01–03 completed: [01-story-login-CRM-4.md](../login/01-story-login-CRM-4.md), [02-story-protect-crm-pages-CRM-6.md](../protect-crm-pages/02-story-protect-crm-pages-CRM-6.md), and [03-story-navigation-and-logout-CRM-5.md](../navigation-and-logout/03-story-navigation-and-logout-CRM-5.md). Preserve authentication, protected navigation, and logout behavior.
- Contacts, opportunities, tasks, and activities are not currently modeled or stored in the repository. This story must show explicit empty related sections until their owning stories provide data contracts and APIs; do not invent related records.

---

## Story Goal

Allow an authenticated CRM user to open a customer details page, retrieve the selected customer from the backend, and view first name, last name, email, phone, company, job title, status, address, notes, and related Contacts, Opportunities, Tasks, and Activities sections.

Show a loading state while retrieving the record and a clear error for an invalid or unknown customer id. Related entity creation, editing, deletion, searching, and business workflows are out of scope until those entities have their own stories.

---

## Context — Read These Files First

1. `CRM/src/customer.ts` — Read the `Customer` contract around lines 1–20. Use its public fields for the details response and do not expose SQLite column names or internal database objects.
2. `CRM/src/customer-repository.ts` — Read `getCustomer` around lines 45–49. Preserve parameterized id lookup and its `null` result for an unknown customer; extend only if a dedicated detail projection is required.
3. `CRM/src/server.ts` — Read the protected API middleware, `GET /api/customers/:id`, protected page paths, and `createApp` around lines 20–95. Preserve `401` for missing/expired sessions, `400` for malformed ids, and `404` for valid but unknown ids.
4. `CRM/public/login.ts` — Read `protectedPages`, `renderCurrentPage`, `renderCustomers`, `handleCustomerAction`, and `escapeHtml` around lines 20–170. The current View action fetches a customer and displays a browser alert; replace it with a routed details view while retaining list search/pagination state where practical.
5. `CRM/public/index.html` — Read the `.protected-layout`, `.protected-content`, customer row, action, loading, and error styles around lines 20–85. Extend the existing full-page sidebar design for a readable detail page and related empty states.
6. `CRM/tests/auth.test.ts` — Read the authenticated customer action tests around lines 80–140. Reuse the in-memory SQLite and Supertest agent patterns for detail success, malformed id, not-found, and authentication cases.
7. `CRM/package.json` — Preserve `npm test`, `npm run build`, and `npm run dev` as the verification commands.
8. `.squad/stories/customer-details/CRM-10/intake.md` — Treat the CRM-10 fields, related sections, loading state, and invalid-id behavior as the product contract; attachments are listed as none.
9. [Story 05 plan](../view-customers-list/05-story-view-customers-list-CRM-8.md) — Match the list's safe rendering, responsive layout, and action conventions.

---

## Implementation tasks

### 1 — Define the customer details response

- **Modify `CRM/src/server.ts`** to keep `GET /api/customers/:id` protected and return the complete safe `Customer` projection required by the details page.
- Validate the route id as a positive integer before calling the repository. Return `400` for malformed ids, `404` with a stable JSON error for an unknown customer, and `401` through the existing authentication middleware.
- Do not include password data, session tokens, raw database rows, SQL errors, filesystem paths, or unrelated internal fields in the response.
- Do not create Contacts, Opportunities, Tasks, or Activities tables or response records in this story. Their sections must be represented as explicit empty states until their owning features exist.

### 2 — Add a routed details page

- **Modify `CRM/public/login.ts`** to add a customer details route such as `/customers/:id` while preserving the existing protected `/customers` list route.
- Replace the current browser-alert View action with navigation to the selected customer details route. Use the existing `/api/customers/:id` endpoint and request the record after the route is loaded.
- Render loading content before the request settles, the complete customer information after a successful response, and a clear not-found/invalid-id error with a Back to Customers action when the request fails.
- Escape every server-provided customer value before inserting it into HTML. Format the created date consistently with the customer list and show absent optional values as an intentional placeholder.
- Add a Back to Customers action that returns to the list without losing the existing protected navigation or authentication checks.

### 3 — Render related CRM sections safely

- **Modify `CRM/public/login.ts`** to render separate Contacts, Opportunities, Tasks, and Activities sections on the details page.
- Because related entities do not exist yet, show an explicit empty-state message in each section and do not imply that related data was loaded successfully.
- Structure the sections so later stories can replace each empty state with an authenticated API-backed list without changing the customer details route contract.
- Keep Logout available and ensure direct navigation, browser Back/Forward, and expired sessions still re-run the existing `/api/me` check before protected content is shown.

### 4 — Style and test the details workflow

- **Modify `CRM/public/index.html`** with responsive detail-field, related-section, loading, error, and back-action styles. Keep long notes, addresses, names, and dates readable on mobile without horizontal overflow.
- **Modify `CRM/tests/auth.test.ts`** to cover detail success with every customer field, malformed ids, unknown ids, unauthenticated detail access, and safe omission of internal fields.
- Add browser smoke coverage for View navigation, loading state, complete details rendering, related empty states, invalid-id error, Back to Customers, and Logout.

---

## Edge Cases & Failure Modes

- Missing authentication: return JSON `401` from the detail API and redirect protected browser navigation to Login; enforce through existing auth middleware and `renderCurrentPage`.
- Malformed customer id such as text, decimal, zero, or negative values: return `400` without querying the repository; enforce in `GET /api/customers/:id`.
- Well-formed but unknown id: return `404` with a generic "Customer not found." response and show a recoverable details error; enforce in the API and details view.
- Slow detail request: show loading content before the response and avoid displaying stale customer data from a prior route; enforce in the details renderer.
- Backend/database failure: show a generic recoverable error without exposing SQL, paths, or stack traces; enforce in the API error boundary and client response handling.
- Missing optional phone, company, job title, address, or notes: render a consistent placeholder rather than blank ambiguous space; enforce in the details field renderer.
- Unsafe customer text: escape all names, contact values, notes, and addresses before HTML insertion; reuse `escapeHtml`.
- Related entities unavailable: show explicit empty states for Contacts, Opportunities, Tasks, and Activities, not false successful loading states or invented data.
- Direct refresh or browser Back/Forward to `/customers/:id`: re-check `/api/me` before rendering and do not rely on in-memory customer data; enforce in `renderCurrentPage`.
- Long notes or addresses: wrap content and keep the details page within the viewport on narrow screens; enforce in responsive CSS.

---

## Test Plan

1. **Unit:** test positive integer id validation, safe customer projection, optional-field placeholders, date formatting, and HTML escaping.
2. **Integration:** verify authenticated `GET /api/customers/:id` returns all required customer fields and omits internal fields.
3. **Integration:** verify malformed ids return `400`, unknown ids return `404`, and unauthenticated requests return `401` JSON.
4. **Integration:** verify the existing customer list View action target resolves to the details route and preserves protected navigation.
5. **Browser smoke:** verify loading, complete customer details, related Contacts/Opportunities/Tasks/Activities empty states, invalid-id error, and Back to Customers.
6. **Browser smoke:** verify direct details navigation and refresh require authentication and Logout remains available.

---

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, sign in, open Customers, select View for a customer, and verify all details and related empty states.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm the details route/client changes compile.
3. **Regression:** from `CRM/`, run `npm test` and confirm login, protected routes, customer list, detail API, invalid-id, not-found, and browser-facing tests pass.

---

## Done Criteria

- [ ] Authenticated users can open a customer details page from the Customers list.
- [ ] The details page displays first name, last name, email, phone, company, job title, status, address, and notes.
- [ ] Customer information is retrieved from the protected backend endpoint.
- [ ] Loading state is displayed while customer details are retrieved.
- [ ] Invalid and unknown customer ids display appropriate non-sensitive errors.
- [ ] Contacts, Opportunities, Tasks, and Activities sections are present with explicit empty states until related stories provide data.
- [ ] Customer values are escaped and internal database/session fields are not exposed.
- [ ] Back to Customers, sidebar navigation, authentication checks, and Logout continue to work.
- [ ] Responsive styling keeps long customer fields readable without horizontal overflow.
- [ ] Automated and browser smoke tests cover the details workflow and failure paths.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 07.**