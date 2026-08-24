> **Fetched from jira:** [CRM-9](https://emanfathy19194.atlassian.net/browse/CRM-9)  
> *Fetched 2026-08-23T07:18:51.018Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Add Customer  
**Type:** Story  
**Status:** To Do

### Description

User Story

As a CRM user, I want to add a new customer so that I can store customer information in the CRM.

Customer Information

	First Name

	Last Name

	Email

	Phone

	Company

	Job Title

	Status

	Address

	Notes

Acceptance Criteria

	User can open the Add Customer form.

	First Name is required.

	Last Name is required.

	Email is required.

	Email format is validated.

	Phone format is validated.

	Company can be entered.

	Job Title can be entered.

	Status is required.

	Address can be entered.

	Notes can be entered.

	User cannot submit invalid data.

	Customer data is sent to the backend.

	Backend validates the submitted data.

	Customer is stored in the database.

	Success message is displayed after successful creation.

	New customer appears in the customer list.

	API errors are handled and displayed appropriately.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/add-customer/CRM-9/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `add-customer`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `CRM-9` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Add Customer
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
User Story

As a CRM user, I want to add a new customer so that I can store customer information in the CRM.

Customer Information

	First Name

	Last Name

	Email

	Phone

	Company

	Job Title

	Status

	Address

	Notes

Acceptance Criteria

	User can open the Add Customer form.

	First Name is required.

	Last Name is required.

	Email is required.

	Email format is validated.

	Phone format is validated.

	Company can be entered.

	Job Title can be entered.

	Status is required.

	Address can be entered.

	Notes can be entered.

	User cannot submit invalid data.

	Customer data is sent to the backend.

	Backend validates the submitted data.

	Customer is stored in the database.

	Success message is displayed after successful creation.

	New customer appears in the customer list.

	API errors are handled and displayed appropriately.
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
