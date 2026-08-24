# navigation-and-logout — plan overview

Entry point for the **navigation-and-logout** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 03 | [03-story-navigation-and-logout-CRM-5.md](03-story-navigation-and-logout-CRM-5.md) | CRM Navigation and Logout | CRM-5 | Story 01: User Login; Story 02: Protect CRM Pages |

## Dependency notes

Story 03 extends the `crm_session` lifecycle and protected route guards established by Stories 01 and 02. Navigation targets existing protected page boundaries; business data remains out of scope.
