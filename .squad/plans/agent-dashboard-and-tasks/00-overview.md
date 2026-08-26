# agent-dashboard-and-tasks — plan overview

Entry point for the **agent-dashboard-and-tasks** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 10 | [10-story-agent-dashboard-and-tasks-CRM-25.md](10-story-agent-dashboard-and-tasks-CRM-25.md) | Agent Dashboard and Tasks | CRM-25 | Story 09 — Manage Communication Channels |

## Dependency notes

Story 10 builds on Story 08's protected ticket and history contracts and Story 09's protected communication history. Dashboard queries must use the authenticated email already exposed by `AuthService` and must not change ticket, customer, or communication API responses.
