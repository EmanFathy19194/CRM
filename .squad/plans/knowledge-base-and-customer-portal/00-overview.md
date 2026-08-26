# knowledge-base-and-customer-portal — plan overview

Entry point for the **knowledge-base-and-customer-portal** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 12 | `12-story-knowledge-base-and-customer-portal-CRM-27.md` | Knowledge Base and Customer Portal | CRM-27 | Story 08 (tickets), Story 09 (communications), Story 11 (automation) |

## Dependency notes

The portal reuses the existing customer, ticket, communication, and SLA contracts. Keep its public endpoints separate from the authenticated agent APIs so a customer cannot obtain internal ticket fields, comments, assignments, automations, or another customer's data.
