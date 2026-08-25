# manage-support-tickets — plan overview

Entry point for the **manage-support-tickets** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 08 | [08-story-manage-support-tickets-CRM-23.md](08-story-manage-support-tickets-CRM-23.md) | Manage Support Tickets | CRM-23 | Story 07 — Manage Customer Records |

## Dependency notes

Story 08 depends on the protected customer and associated-record foundations in Story 07. Ticket creation verifies the existing customer relationship; ticket history uses the authenticated user’s existing email identity and does not add user administration.
