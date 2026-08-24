# Story 01 — User Login (Story: CRM-4)

## Prerequisites

- The `CRM/` application directory is currently empty. Establish the TypeScript application structure before implementing this story.
- No existing frontend framework, backend framework, authentication service, route table, persistence layer, or test runner is present in the repository. The implementation owner must select and document these as part of the initial scaffold.

---

## Story Goal

Deliver a secure login flow for registered CRM users. A user can open the Login page, enter a validated email and password, submit the form, receive a clear result, and reach the Dashboard after successful authentication.

This story includes the minimum authentication contract required by the login flow. User registration, password reset, roles and permissions, session administration, and Dashboard business features are out of scope except for the post-login destination.

---

## Context — Read These Files First

1. `CRM/` — Confirm that the application directory is empty before choosing the TypeScript frontend and backend structure; do not assume an existing framework or naming convention.
2. `.squad/stories/login/CRM-4/intake.md` — Use the User Login description and acceptance criteria as the product contract; attachments are listed as none.
3. `.squad/config.yaml` — Preserve the repository's declared `typescript` primary language and `login` feature planning conventions.
4. There is no sibling story plan or implementation precedent under `.squad/plans/`; establish the first plan structure without copying an unverified pattern.

---

## Implementation tasks

### 1 — Establish the application contract

- **Create the TypeScript project structure under `CRM/`** using the team-approved frontend and backend frameworks. Record the selected framework, package manager, start command, build command, and test command in the project documentation.
- Define a single login request contract containing an email and password, and a response contract that does not return the password. Keep the authentication result compatible with the chosen session or token mechanism.
- Define the Dashboard route or destination as part of the application routing contract so successful login has a real target.
- Add a deterministic development/test user or authentication stub for automated tests. Do not store real credentials in source control.

### 2 — Implement the login page

- **Create the Login page under `CRM/`** using the selected frontend structure.
- Render email and password controls, with the password masked by default.
- Enforce required-field validation and email-format validation before sending a request.
- Submit the credentials through the backend client contract. Disable duplicate submission and show a loading state until the request settles.
- Display a non-sensitive, user-appropriate error for invalid credentials or an unavailable backend. Do not echo the password or expose raw provider errors.
- On a successful response, persist authentication information using the selected secure mechanism and redirect to the Dashboard.

### 3 — Implement backend authentication

- **Create the authentication endpoint and service under `CRM/`** using the selected backend structure.
- Validate the request shape and reject missing or malformed credentials with a client error without attempting authentication.
- Look up the registered user through the selected persistence boundary and verify the password using a password-hashing library. Never compare or store plaintext passwords.
- Return a generic authentication failure for unknown users and incorrect passwords so the endpoint does not reveal which emails are registered.
- On success, issue the selected secure session or token response with an explicit expiration policy. Do not include password hashes or other sensitive account fields.
- Apply the selected transport protections for credentials and authentication state, including HTTPS in deployed environments and secure cookie attributes when cookies are used.

### 4 — Add focused tests and verification

- **Create frontend tests under `CRM/`** for required email, required password, invalid email format, masked password rendering, loading-state behavior, successful redirect, and displayed invalid-credential errors.
- **Create backend tests under `CRM/`** for valid credentials, invalid credentials, unknown users, malformed requests, password-hash verification, and omission of sensitive fields from responses.
- Add an integration test covering the frontend-to-backend login contract and successful Dashboard navigation using only a test user or stub.
- Add a smoke check for the Login route and the unauthenticated-to-authenticated transition after the scaffold commands are defined.

---

## Edge Cases & Failure Modes

- Empty email or password: block submission and show field validation; enforce this in the Login page and repeat it at the authentication endpoint.
- Malformed email: block submission before the request and reject it server-side; use the same normalization rule in both layers.
- Incorrect password or unknown email: return the same generic authentication error and do not reveal which condition occurred; enforce this in the authentication service.
- Double submission: keep the submit control in its loading state and prevent a second request until the first completes; test this in the Login page.
- Backend timeout or unavailable service: stop the loading state and show a recoverable generic error without losing the password in logs; enforce this in the frontend request boundary and logging policy.
- Password exposure: mask the input, exclude passwords from logs and response bodies, and store only a slow password hash; enforce this across the Login page, request handling, and authentication service.
- Expired or missing authentication state: reject protected Dashboard access and return the user to Login; enforce this in the route guard or backend authorization boundary selected during scaffolding.
- Credential transport: never send credentials over an insecure deployed connection; enforce HTTPS at the deployment boundary and secure cookie settings when applicable.

---

## Test Plan

1. **Unit, frontend:** validate required fields, email format, password masking, submit loading state, and generic error rendering.
2. **Unit, backend:** validate request shape, password-hash verification, generic failures, successful authentication, expiration metadata, and sensitive-field omission.
3. **Integration:** submit valid credentials through the real test client boundary and assert authentication state plus Dashboard navigation.
4. **Integration:** submit invalid credentials and assert no authenticated state is created and the generic error is shown.
5. **Smoke:** start the scaffolded application with its documented command, open the Login route, and verify the successful test-user flow.

---

## Verification Steps

1. **Frontend runs:** run the frontend start command documented during scaffolding from `CRM/` and verify the Login route manually.
2. **Backend builds:** run the backend build and test commands documented during scaffolding from `CRM/`.
3. **Regression:** run the complete test command documented during scaffolding and confirm the Login-to-Dashboard integration test passes.

---

## Done Criteria

- [ ] The CRM TypeScript application structure and documented development commands exist under `CRM/`.
- [ ] A user can access the Login page.
- [ ] Email and password inputs are available; password text is masked.
- [ ] Required-field and email-format validation prevents invalid submissions.
- [ ] Credentials are sent to the backend through a defined contract.
- [ ] The backend validates credentials without storing or returning plaintext passwords.
- [ ] Valid credentials create secure authentication state and redirect to the Dashboard.
- [ ] Invalid credentials show a generic appropriate error.
- [ ] The Login button shows a loading state and prevents duplicate requests.
- [ ] Frontend, backend, integration, and smoke coverage verifies the acceptance criteria.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 02.**