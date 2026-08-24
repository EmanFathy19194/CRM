# view-customers-list — plan overview

Entry point for the **view-customers-list** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 05 | [05-story-view-customers-list-CRM-8.md](05-story-view-customers-list-CRM-8.md) | View Customer List | CRM-8 | Story 04: Add Customer; Stories 01–03 authentication and navigation |

## Dependency notes

Story 05 extends the SQLite customer store and protected Customers boundary from Story 04. It adds complete list presentation and View/Edit/Delete action contracts; customer creation remains owned by Story 04.
