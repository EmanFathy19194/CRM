> **Fetched from jira:** [CRM-10](https://emanfathy19194.atlassian.net/browse/CRM-10)  
> *Fetched 2026-08-23T07:43:43.809Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** View Customer Details  
**Type:** Story  
**Status:** To Do

### Description

User Story

As a CRM user, I want to view detailed information about a customer so that I can understand and manage the customer's relationship with the company.

Acceptance Criteria

Customer details page displays:

	First Name.

	Last Name.

	Email.

	Phone.

	Company.

	Job Title.

	Status.

	Address.

	Notes.

	Customer contacts.

	Customer opportunities.

	Customer tasks.

	Customer activities.

Additional criteria:

	Customer information is retrieved from the backend.

	Invalid customer ID displays an appropriate error.

	Loading state is displayed while retrieving data.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-details/CRM-10/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `customer-details`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `CRM-10` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
View Customer Details
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
User Story

As a CRM user, I want to view detailed information about a customer so that I can understand and manage the customer's relationship with the company.

Acceptance Criteria

Customer details page displays:

	First Name.

	Last Name.

	Email.

	Phone.

	Company.

	Job Title.

	Status.

	Address.

	Notes.

	Customer contacts.

	Customer opportunities.

	Customer tasks.

	Customer activities.

Additional criteria:

	Customer information is retrieved from the backend.

	Invalid customer ID displays an appropriate error.

	Loading state is displayed while retrieving data.
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
