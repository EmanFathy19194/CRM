# manage-customer-records — plan overview

Entry point for the **manage-customer-records** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 07 | [07-story-manage-customer-records-CRM-22.md](07-story-manage-customer-records-CRM-22.md) | Manage Customer Records | CRM-22 | Story 06 |

## Dependency notes

- Story 07 extends the customer contracts, repository, database, protected API, list, and detail workspace established by Stories 04–06.
- Attachment storage must remain outside `public/` and customer-related APIs must enforce customer ownership on every read and mutation.
