# reports-and-administration — plan overview

Entry point for the **reports-and-administration** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 13 | [13-story-reports-and-administration-CRM-29.md](13-story-reports-and-administration-CRM-29.md) | Reports and Administration | CRM-29 | Stories 08, 10, 11, and 12 |

## Dependency notes

Story 13 extends the existing protected role/session boundary with persisted staff users and a manager role. It aggregates the ticket, SLA, agent-work, and feedback records owned by Stories 08, 10, 11, and 12 without copying their data.
