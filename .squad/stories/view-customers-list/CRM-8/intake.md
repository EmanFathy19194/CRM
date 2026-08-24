> **Fetched from jira:** [CRM-8](https://emanfathy19194.atlassian.net/browse/CRM-8)  
> *Fetched 2026-08-23T07:26:15.638Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** View Customer List  
**Type:** Story  
**Status:** To Do

### Description

User Story

As a CRM user, I want to view a list of customers so that I can easily access and manage customer information.

Description

The Customers page should display all customers available to the authenticated user.

Acceptance Criteria

The customer list displays:

	Customer name.

	Email.

	Phone.

	Company.

	Status.

	Created date.

	Available actions.

Available actions:

	View.

	Edit.

	Delete.

Additional criteria:

	Customers are retrieved from the backend.

	Loading state is displayed.

	Empty state is displayed when there are no customers.

	Customer data is displayed in a readable table/list.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/view-customers-list/CRM-8/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `view-customers-list`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `CRM-8` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
View Customer List
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
User Story

As a CRM user, I want to view a list of customers so that I can easily access and manage customer information.

Description

The Customers page should display all customers available to the authenticated user.

Acceptance Criteria

The customer list displays:

	Customer name.

	Email.

	Phone.

	Company.

	Status.

	Created date.

	Available actions.

Available actions:

	View.

	Edit.

	Delete.

Additional criteria:

	Customers are retrieved from the backend.

	Loading state is displayed.

	Empty state is displayed when there are no customers.

	Customer data is displayed in a readable table/list.
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
