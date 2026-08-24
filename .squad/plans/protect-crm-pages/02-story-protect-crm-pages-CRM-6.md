# Story 02 — Protect CRM Pages (Story: CRM-6)

## Prerequisites

- Story 01 completed: [01-story-login-CRM-4.md](../login/01-story-login-CRM-4.md). Reuse its `AuthService` session contract and the `crm_session` cookie rather than creating a second authentication mechanism.
- The current application has no Customers, Contacts, Opportunities, Tasks, or Activities business pages or APIs. This story must establish their protected route boundaries without inventing business data or feature behavior.

---

## Story Goal

Require authentication before a user can access CRM business pages or protected backend APIs. Unauthenticated browser navigation to Dashboard, Customers, Contacts, Opportunities, Tasks, or Activities must return the user to Login; authenticated users must be allowed through to the corresponding page boundary. Unauthenticated API requests must receive HTTP `401 Unauthorized` responses.

Business data, CRUD operations, authorization roles, and page-specific workflows are out of scope. This story protects the boundaries that later business stories will populate.

---

## Context — Read These Files First

1. `CRM/src/auth.ts` — Read `AuthService.getUser` around lines 30–44 and preserve its session lookup, expiry cleanup, and `PublicUser` return shape as the single authentication check.
2. `CRM/src/server.ts` — Read `readCookie`, `createApp`, the `/api/me` handler, and the catch-all `app.get("*")` route around lines 8–63. The catch-all currently serves the Login shell for every browser path and has no protected API middleware.
3. `CRM/public/login.ts` — Read `renderLogin`, `submitLogin`, and `renderDashboard` around lines 12–50. The client currently pushes `/dashboard` after login but does not inspect the current path or call `/api/me` before rendering protected content.
4. `CRM/tests/auth.test.ts` — Match the existing Supertest/Vitest setup around lines 1–34 when adding unauthenticated and authenticated route tests.
5. `CRM/package.json` — Use the existing `npm test`, `npm run build`, and `npm run dev` scripts for verification; do not change the package manager or command names without documenting the reason.
6. `.squad/stories/protect-crm-pages/CRM-6/intake.md` — Treat the CRM-6 acceptance criteria as the product contract; attachments are listed as none.
7. [Story 01 plan](../login/01-story-login-CRM-4.md) — Follow its session-cookie and secure-authentication decisions when extending the protection boundary.

---

## Implementation tasks

### 1 — Centralize authentication checks

- **Modify `CRM/src/server.ts`** to extract the `crm_session` cookie and resolve it through `AuthService.getUser` in one reusable request guard.
- Add a protected-page route policy for `/dashboard`, `/customers`, `/contacts`, `/opportunities`, `/tasks`, and `/activities`. When no valid session exists, redirect browser requests to `/` rather than serving the business page shell.
- Add a protected-API guard that returns JSON with status `401` and a stable non-sensitive error message when the session is absent or expired. Apply it to every business-data API introduced by this story or later stories; leave `/api/login`, `/api/me`, and `/api/logout` public as required by the existing login flow.
- Preserve the existing `HttpOnly`, `SameSite`, expiry, and production `Secure` cookie behavior from the login handler.

### 2 — Enforce browser-side page protection

- **Modify `CRM/public/login.ts`** so browser startup distinguishes the public Login route from the protected route names.
- Call `/api/me` before rendering a protected page. Render the requested protected page boundary only when the response is authenticated; otherwise replace the current view with Login and navigate to `/` using the History API.
- Keep Dashboard available as the first protected page boundary and add lightweight placeholders for Customers, Contacts, Opportunities, Tasks, and Activities that contain no business data yet. Each placeholder must use the same authentication check and must not imply that business functionality is implemented.
- Handle an expired session after navigation by returning the user to Login without exposing protected content or retaining stale page state.

### 3 — Define protected API boundaries

- **Modify `CRM/src/server.ts`** to register protected route prefixes for the business-data API surface that this story establishes. The routes must reject missing, malformed, or expired sessions before any handler can access data.
- Return `401 Unauthorized` for unauthenticated requests and do not redirect API clients to HTML. Return only a generic authentication error body.
- Keep the existing login and logout behavior compatible with the current frontend and test user.

### 4 — Add regression coverage

- **Modify `CRM/tests/auth.test.ts`** using the existing `createApp(auth)` and Supertest pattern.
- Test unauthenticated requests to `/api/me` and each protected API boundary return `401` with JSON rather than the Login HTML response.
- Test authenticated access by logging in through `/api/login`, forwarding the returned `crm_session` cookie, and asserting the Dashboard and each protected page boundary are reachable.
- Test browser route handling for unauthenticated and authenticated requests to `/dashboard`, `/customers`, `/contacts`, `/opportunities`, `/tasks`, and `/activities`.
- Test expired or invalid session cookies are treated as unauthenticated and cannot access protected content.
- Test Login and Logout remain public and continue to work after the protection guard is added.

---

## Edge Cases & Failure Modes

- No session cookie: redirect protected browser routes to `/` and return JSON `401` for protected APIs; enforce this in the shared guards in `CRM/src/server.ts`.
- Invalid or expired session cookie: treat it exactly like a missing session and do not expose the protected page shell; rely on `AuthService.getUser` expiry cleanup in `CRM/src/auth.ts`.
- API request to a protected path: return `401 Unauthorized` JSON, never a browser redirect or `index.html`; enforce this before protected API handlers in `CRM/src/server.ts`.
- Authenticated user requests any listed CRM page: allow the route boundary and render only the page placeholder until business stories add data; enforce this in `CRM/public/login.ts` and the route policy.
- Login, `/api/me`, and logout without a session: keep them usable so a user can establish or clear authentication; preserve the public route registrations in `CRM/src/server.ts`.
- Direct navigation or refresh on a protected page: re-check `/api/me` instead of trusting the URL or prior in-memory state; enforce this during client startup in `CRM/public/login.ts`.
- Session expires while the user is viewing a protected page: stop rendering protected content on the next auth check and return to Login; cover this with an expired-session test.
- Unknown future CRM route: do not accidentally classify arbitrary URLs as protected or expose data; keep the protected route list explicit and test the known six paths.

---

## Test Plan

1. **Unit:** test the authentication guard's missing, invalid, expired, and valid session decisions using the existing `AuthService` session behavior.
2. **Integration:** verify unauthenticated `GET` requests to all six protected browser paths redirect to `/`.
3. **Integration:** verify authenticated requests to all six protected browser paths receive their protected page boundary.
4. **Integration:** verify unauthenticated protected API requests return `401` JSON and never return the Login HTML document.
5. **Integration:** verify a login-created session permits protected API and page access, while logout removes that access.
6. **Browser smoke:** verify direct navigation to each protected path redirects unauthenticated users to Login and authenticated users see the matching placeholder.

---

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, open each protected path in a browser, and verify unauthenticated redirects plus authenticated placeholder access.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm the TypeScript protection changes compile.
3. **Regression:** from `CRM/`, run `npm test` and confirm login, logout, session expiry, page protection, and API `401` tests pass.

---

## Done Criteria

- [ ] Dashboard requires authentication.
- [ ] Customers, Contacts, Opportunities, Tasks, and Activities require authentication.
- [ ] Unauthenticated browser requests to protected pages redirect to Login.
- [ ] Authenticated users can access all six protected page boundaries.
- [ ] Protected backend APIs reject missing, invalid, and expired sessions.
- [ ] Unauthorized API requests return JSON with HTTP `401 Unauthorized`.
- [ ] Login, `/api/me`, and Logout remain usable as public authentication endpoints.
- [ ] Direct navigation and page refresh re-check authentication before rendering protected content.
- [ ] Automated and browser smoke tests cover both unauthenticated and authenticated paths.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 03.**