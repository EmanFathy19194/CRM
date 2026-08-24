# Story 03 — CRM Navigation and Logout (Story: CRM-5)

## Prerequisites

- Story 01 completed: [01-story-login-CRM-4.md](../login/01-story-login-CRM-4.md). Reuse the existing `crm_session` cookie and login contract.
- Story 02 completed: [02-story-protect-crm-pages-CRM-6.md](../protect-crm-pages/02-story-protect-crm-pages-CRM-6.md). Preserve its protected page/API boundaries and redirect behavior.
- The current application has protected route placeholders, but no shared CRM navigation component or browser history handling for logout.

---

## Story Goal

Give authenticated CRM users a visible way to navigate between protected CRM pages and securely end their session. Logout must invalidate the server session, clear the browser cookie, redirect to Login, and prevent both direct navigation and browser Back navigation from showing protected CRM content.

Business data and page-specific workflows remain out of scope. Navigation targets are the existing protected boundaries: Dashboard, Customers, Contacts, Opportunities, Tasks, and Activities.

---

## Context — Read These Files First

1. `CRM/src/server.ts` — Read `cookieName`, `readCookie`, the `/api/logout` handler, the protected page route, and the catch-all route around lines 8–80. Preserve server-side session invalidation and add response/cache behavior only where needed for logout protection.
2. `CRM/src/auth.ts` — Read `AuthService.getUser` and `logout` around lines 32–46. Reuse the existing session deletion behavior rather than adding client-only logout state.
3. `CRM/public/login.ts` — Read `protectedPages`, `renderCurrentPage`, `renderProtectedPage`, and `submitLogin` around lines 12–76. The current logout button calls `/api/logout` and `history.replaceState`, but there is no shared navigation menu or `popstate` listener.
4. `CRM/public/index.html` — Read the application shell styles around lines 1–47. Extend the existing visual language for navigation, active links, and logout states without exposing a password or session token in markup.
5. `CRM/tests/auth.test.ts` — Read the existing Supertest/Vitest cases around lines 1–71. Follow the current `request.agent(createApp(auth))` pattern for login, logout, and post-logout access checks.
6. `CRM/package.json` — Use the existing `npm run dev`, `npm run build`, and `npm test` scripts from `CRM/` for verification.
7. `.squad/stories/navigation-and-logout/CRM-5/intake.md` — Treat the CRM-5 acceptance criteria as the product contract; attachments are listed as none.

---

## Implementation tasks

### 1 — Add authenticated CRM navigation

- **Modify `CRM/public/login.ts`** so `renderProtectedPage` renders navigation links for Dashboard, Customers, Contacts, Opportunities, Tasks, and Activities, plus a visible Logout control.
- Mark the current route as active without relying on a client-only authentication flag. Navigation must use the existing protected paths so direct navigation continues through the server protection boundary.
- Add route-aware navigation handling for clicks and browser `popstate` events. Every protected navigation must call `renderCurrentPage`, which re-checks `/api/me` before rendering content.
- Keep the Login view free of protected navigation and Logout controls.

### 2 — Harden logout behavior

- **Modify `CRM/public/login.ts`** so the Logout control enters a disabled/loading state, sends `POST /api/logout` with same-origin credentials, and always returns the user to `/` after a successful response.
- On logout failure, do not claim that the session ended. Show a recoverable generic error and keep the authenticated page available for retry.
- After logout succeeds, replace the current history entry with `/` and render Login. Do not store authentication information in `localStorage`, `sessionStorage`, URL parameters, or page markup.
- Add a `popstate` handler that re-runs `renderCurrentPage`; an old protected view must never remain visible after Back or Forward navigation.
- On any protected-page authentication failure, clear the current protected view before rendering Login and replace the URL with `/`.

### 3 — Prevent protected content from browser cache

- **Modify `CRM/src/server.ts`** so protected page responses send a no-store cache policy, preventing a browser Back navigation from restoring protected HTML after logout.
- Keep unauthenticated protected-page responses as redirects to `/` and keep protected API responses as JSON `401 Unauthorized`; do not redirect API clients to HTML.
- Preserve the existing `response.clearCookie` behavior in `/api/logout` and the server-side `auth.logout` invalidation.

### 4 — Add navigation and logout regression coverage

- **Modify `CRM/tests/auth.test.ts`** using the existing Supertest agent setup.
- Verify the Logout endpoint returns `204`, invalidates the session, clears the `crm_session` cookie, and prevents later protected page/API access.
- Verify login remains usable after logout and a new login creates a new usable session.
- Verify protected page responses include the no-store cache policy and unauthenticated access still redirects to `/`.
- Add browser-level coverage for visible navigation links, active route state, Logout visibility for authenticated users, redirect to Login after logout, and Back/Forward behavior after logout.
- Verify a failed logout request leaves the user authenticated and presents a retryable error rather than navigating away.

---

## Edge Cases & Failure Modes

- Logout with no cookie: return a successful idempotent response and leave the user at Login; enforce this in `/api/logout` and the client logout handler.
- Logout with an invalid or expired cookie: clear the cookie and do not expose protected content; rely on `AuthService.logout` and the protected route guard.
- Double-click Logout: disable the control after the first click and avoid duplicate requests or inconsistent navigation; enforce this in `renderProtectedPage`.
- Logout network failure: retain the protected view, show a generic retryable error, and do not pretend the session ended; enforce this in the client request handler.
- Browser Back after logout: re-check `/api/me`, prevent cached protected HTML with `Cache-Control: no-store`, and replace invalid protected history entries with `/`; enforce this in `CRM/src/server.ts` and `CRM/public/login.ts`.
- Direct URL entry after logout: protected page routes must redirect to Login and protected APIs must return `401`; enforce this in the existing server route policy.
- Browser Forward or `popstate` to a protected route: authenticate before rendering and show Login when the session is absent; enforce this in the client navigation handler.
- Login route after logout: keep Login public and do not show authenticated navigation until a successful login response; enforce this in `renderLogin` and `renderCurrentPage`.

---

## Test Plan

1. **Unit:** test client navigation state for active links, protected-route selection, logout loading state, and logout failure handling.
2. **Integration:** log in with `request.agent`, call `/api/logout`, assert `204`, cookie clearing, session invalidation, and `401`/redirect behavior afterward.
3. **Integration:** assert protected page responses use `Cache-Control: no-store` and unauthenticated requests redirect to Login.
4. **Integration:** log in again after logout and verify the replacement session can access protected pages.
5. **Browser smoke:** verify all six navigation links and Logout are visible for an authenticated user and the selected route is highlighted.
6. **Browser smoke:** click Logout, verify Login is shown, then use Back and Forward and verify no protected content is rendered without a valid session.
7. **Browser smoke:** simulate a failed logout response and verify the user remains on the protected page with a retryable error.

---

## Verification Steps

1. **Frontend runs:** from `CRM/`, run `npm run dev`, log in with the documented test user, navigate all six protected links, log out, and test Back/Forward navigation.
2. **Backend builds:** from `CRM/`, run `npm run build` and confirm the TypeScript and client changes compile.
3. **Regression:** from `CRM/`, run `npm test` and confirm login, logout invalidation, cache policy, navigation, and protected-route tests pass.

---

## Done Criteria

- [ ] Authenticated users see navigation links for Dashboard, Customers, Contacts, Opportunities, Tasks, and Activities.
- [ ] Authenticated users see and can activate a Logout control.
- [ ] Logout invalidates the server session and clears the browser authentication cookie.
- [ ] Logout redirects the user to Login.
- [ ] Protected pages and APIs remain inaccessible after logout.
- [ ] Protected page responses prevent browser caching of authenticated content.
- [ ] Browser Back and Forward navigation cannot reveal protected content after logout.
- [ ] Navigation and logout failures are handled without claiming a false authenticated or logged-out state.
- [ ] Automated and browser smoke tests cover successful logout, repeated logout, failed logout, and history navigation.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 04.**