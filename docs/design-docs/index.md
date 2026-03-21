# Design Docs

Catalog of all design documents. Each doc describes the design rationale for a
feature — what approach was chosen and why.

## Feature Designs

| Feature                | Doc                                                             | Summary                                                   |
| ---------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| Role Permissions       | [role-permissions.md](features/role-permissions.md)             | DB-backed RBAC with per-module read/write control         |
| Assignment Management  | [assignment-management.md](features/assignment-management.md)   | Per-session assignments with completion tracking          |
| E2E Tests              | [e2e-tests.md](features/e2e-tests.md)                           | Playwright test strategy and structure                    |
| Teams                  | [teams.md](features/teams.md)                                   | Two-level team model (templates + event instances)        |
| Budget                 | [budget.md](features/budget.md)                                 | Per-event budget tracking with categories                 |
| Team Template Defaults | [team-template-defaults.md](features/team-template-defaults.md) | Default members and tasks for team templates              |
| Event Detail Page      | [event-detail-page.md](features/event-detail-page.md)           | Admin event detail with team/session management           |
| Overview Subtabs       | [overview-subtabs.md](features/overview-subtabs.md)             | Admin dashboard subtab navigation                         |
| Migration Guardrails   | [migration-guardrails.md](features/migration-guardrails.md)     | Build-time migration safety with SQL review + Neon backup |

## Architecture Decision Records

ADRs live in [`decisions/`](decisions/). Use [`_template.md`](decisions/_template.md)
to create new records.

No ADRs have been recorded yet. Key decisions to document:

- Why NextAuth over Clerk/Lucia
- Why DB-backed permissions instead of config file
- Why LINE OAuth as primary provider
- Why Neon PostgreSQL over Supabase DB
