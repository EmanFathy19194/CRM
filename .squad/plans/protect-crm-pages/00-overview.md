# protect-crm-pages — plan overview

Entry point for the **protect-crm-pages** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 02 | [02-story-protect-crm-pages-CRM-6.md](02-story-protect-crm-pages-CRM-6.md) | Protect CRM Pages | CRM-6 | Story 01: User Login |

## Dependency notes

Story 02 extends Story 01's session cookie and `AuthService` contract. The current repository has no business-data pages or APIs, so this story establishes protected route boundaries and placeholders; later stories own the business content.
