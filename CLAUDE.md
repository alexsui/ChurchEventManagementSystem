# Project Instructions

## Git Worktrees

Always create worktrees as **sibling directories** to the project, never inside `.worktrees/` within the project. Placing worktrees inside the project causes Node module resolution to walk up and find the main repo's `node_modules`, leading to duplicate dependency issues (e.g., dual React instances breaking hooks).

```
# Good - sibling directory
git worktree add ../church-event-<feature-name> -b feature/<feature-name>

# Bad - inside project
git worktree add .worktrees/<feature-name> -b feature/<feature-name>
```

## Testing

Run tests using the npm scripts defined in package.json:

- `npm test` — starts vitest in watch mode
- `npm run test:run` — single vitest run (no watch)
- `npm run test:integration` — runs integration tests (needs live DB)
- `npm run test:e2e` — runs Playwright e2e tests

Conventions:

- Unit tests are co-located: `foo.service.ts` → `foo.service.test.ts`
- Default Vitest environment is `node`. React/component tests opt into jsdom via `// @vitest-environment jsdom` file-level directive.
- E2E tests are numbered (`1-auth`, `2-admin-events`, …) for sequential execution order.

## Prisma / Database

- Schema changes: `npx prisma migrate dev --name <change_name>`
- Two connection URLs: `DATABASE_URL` (pooled, for app) and `DIRECT_URL` (direct, for migrations)
- See `prisma/WORKFLOW.md` for full migration and deployment workflow
- Seed and production init scripts have safety guardrails — see env flags in `.env.example`

## Code Conventions

- **Service layer**: Business logic lives in `src/services/*.service.ts`. Services throw custom `*ServiceError` classes (e.g., `RegistrationServiceError`).
- **API routes**: Thin handlers — authenticate, authorize, call service, return JSON. No business logic in routes.
- **Chinese UI strings**: All labels and display text go in `src/lib/constants.ts`. Components import from there.
- **Permissions**: Use `hasPermission(role, module, action)` from `src/lib/authorization.ts`. ADMIN role bypasses all checks.

## Documentation

| What                   | Where                                                          |
| ---------------------- | -------------------------------------------------------------- |
| Architecture overview  | [`ARCHITECTURE.md`](ARCHITECTURE.md)                           |
| Docs navigation hub    | [`docs/README.md`](docs/README.md)                             |
| ExecPlan specification | [`docs/PLANS.md`](docs/PLANS.md)                               |
| Active execution plans | [`docs/exec-plans/active/`](docs/exec-plans/active/)           |
| Technical debt         | [`docs/exec-plans/tech-debt.md`](docs/exec-plans/tech-debt.md) |

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `docs/PLANS.md`) from design to implementation. ExecPlans are living documents — their Progress, Decision Log, and Outcomes sections serve as the handoff mechanism between sessions.

## MCP Servers

- **Vercel**: Scoped to `samuels-projects-af36681c/church-event-management-system`. Read operations (list deployments, get logs, get project info) are safe. **Mutating actions (deploy, environment variable changes) require explicit human confirmation before execution.**
- **Neon**: Database operations. Use for branch management and SQL queries. Do not drop production branches without confirmation.

## Agent Workflow

**Scope check** — decide if the task is _feature work_ (new features, significant refactors, bug fixes that change behavior) or _quick fix_ (typos, docs updates, config tweaks, one-line fixes). Only feature work needs the full workflow below. Quick fixes just do the work, run tests, and commit.

### Feature work

Starting a session:

1. Read `ARCHITECTURE.md` for orientation
2. Check `docs/exec-plans/active/` for in-progress plans
3. If continuing work, read the active ExecPlan's Progress section

Ending a session:

1. Update the active ExecPlan's Progress section
2. Update `docs/exec-plans/tech-debt.md` if debt was introduced or resolved
