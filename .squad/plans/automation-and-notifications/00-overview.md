# automation-and-notifications — plan overview

Entry point for the **automation-and-notifications** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 11 | [11-story-sla-automation-and-notifications-CRM-26.md](11-story-sla-automation-and-notifications-CRM-26.md) | SLA, Automation and Notifications | CRM-26 | Story 08; Story 10 |

## Dependency notes

Story 11 builds on the ticket lifecycle and immutable history delivered by Story 08 and uses the protected agent-dashboard pattern from Story 10 for in-app SLA notifications. Execute it after both stories; it adds only nullable ticket fields and additive persistence.
