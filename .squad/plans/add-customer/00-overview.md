# add-customer — plan overview

Entry point for the **add-customer** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 04 | [04-story-add-customer-CRM-9.md](04-story-add-customer-CRM-9.md) | Add Customer | CRM-9 | Story 01: User Login; Story 02: Protect CRM Pages; Story 03: CRM Navigation and Logout |

## Dependency notes

Story 04 extends the protected `/customers` page and API boundary established by Stories 01–03. It introduces the repository's first durable database-backed business record; customer list/create behavior is limited to this story.
