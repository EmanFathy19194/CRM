> **Fetched from jira:** [CRM-6](https://emanfathy19194.atlassian.net/browse/CRM-6)  
> *Fetched 2026-08-23T06:39:41.913Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Protect CRM Pages  
**Type:** Story  
**Status:** To Do

### Description

User Story

As a CRM user, I want CRM pages to be protected so that unauthenticated users cannot access CRM information.

Description

All CRM pages containing business data should require authentication.

Acceptance Criteria

	Dashboard requires authentication.

	Customers require authentication.

	Contacts require authentication.

	Opportunities require authentication.

	Tasks require authentication.

	Activities require authentication.

	Unauthenticated users are redirected to Login.

	Authenticated users can access protected pages.

	Protected backend APIs reject unauthenticated requests.

	Unauthorized API requests return an appropriate 401 Unauthorized response.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/protect-crm-pages/CRM-6/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `protect-crm-pages`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `CRM-6` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Protect CRM Pages
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
User Story

As a CRM user, I want CRM pages to be protected so that unauthenticated users cannot access CRM information.

Description

All CRM pages containing business data should require authentication.

Acceptance Criteria

	Dashboard requires authentication.

	Customers require authentication.

	Contacts require authentication.

	Opportunities require authentication.

	Tasks require authentication.

	Activities require authentication.

	Unauthenticated users are redirected to Login.

	Authenticated users can access protected pages.

	Protected backend APIs reject unauthenticated requests.

	Unauthorized API requests return an appropriate 401 Unauthorized response.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
