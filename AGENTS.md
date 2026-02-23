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

Entry points — start here, follow links for details:

| What                             | Where                                                                    |
| -------------------------------- | ------------------------------------------------------------------------ |
| Architecture overview            | [`ARCHITECTURE.md`](ARCHITECTURE.md)                                     |
| Docs navigation hub              | [`docs/README.md`](docs/README.md)                                       |
| Feature status (source of truth) | [`docs/exec-plans/feature-list.json`](docs/exec-plans/feature-list.json) |
| Session handoff log              | [`docs/exec-plans/agent-progress.md`](docs/exec-plans/agent-progress.md) |
| Technical debt                   | [`docs/exec-plans/tech-debt.md`](docs/exec-plans/tech-debt.md)           |

## Agent Workflow

**Scope check** — decide if the task is _feature work_ (new features, significant refactors, bug fixes that change behavior) or _quick fix_ (typos, docs updates, config tweaks, one-line fixes). Only feature work needs the full workflow below. Quick fixes just do the work, run tests, and commit.

### Feature work

Starting a session:

1. Read `ARCHITECTURE.md` for orientation
2. Check `feature-list.json` for current feature status
3. Check `docs/exec-plans/active/` for in-progress plans

Ending a session:

1. Append an entry to `agent-progress.md` — follow the template in that file exactly
2. Update `feature-list.json` — follow the `rules` array in that file. Only set `passes: true` after you have verified the feature end-to-end yourself this session.
3. Update `tech-debt.md` if new debt was introduced or existing debt resolved

### Quick fixes

Just do the work. Run `npm run test:run` to verify nothing broke. No progress entry or feature-list update needed.
