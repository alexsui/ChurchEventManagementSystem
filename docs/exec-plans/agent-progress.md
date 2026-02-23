# Agent Progress Log

> Append-only. One entry per session.
> Goal: next agent session can continue without guessing.

---

## Entry Template (copy this section for each session)

### YYYY-MM-DD HH:MM TZ — Title

**Branch / Worktree**: `branch` / `path`
**Focus feature**: `feature_id` or short name

**What I tried**

- 1–3 bullets

**What changed**

- 1–5 bullets
- Files touched (optional): `path/a`, `path/b`

**How I verified**

- Tests: `<command>` → (pass/fail/not run)
- E2E (if relevant): what you did → (pass/fail)

**Result**

- Feature status: (passing | still failing | blocked)
- Repo state: (clean | broken) — if broken, how to reproduce in 1 line

**Next**

- Do this first: single next step
- Then: second step if needed

---

### 2026-02-23 10:30 +08:00 — Docs Restructure

**Branch / Worktree**: `main` / project root
**Focus feature**: docs infrastructure (no feature_id — cross-cutting)

**What I tried**

- Restructured `docs/` from flat `docs/plans/` into `product-specs/`, `design-docs/`, `exec-plans/`, `references/`
- Created `ARCHITECTURE.md` at project root
- Built operational tracking artifacts (`feature-list.json`, `agent-progress.md`, `tech-debt.md`)

**What changed**

- 21 files moved/renamed via `git mv` (18 from plans/ + 3 from docs root)
- 8 new files created: `ARCHITECTURE.md`, `docs/README.md`, `docs/design-docs/index.md`, `docs/design-docs/decisions/_template.md`, `docs/exec-plans/feature-list.json`, `docs/exec-plans/agent-progress.md`, `docs/exec-plans/tech-debt.md`, `docs/exec-plans/active/.gitkeep`
- PRD.md marked with [OUTDATED] banner
- `CLAUDE.md` and `AGENTS.md` updated with documentation pointers, code conventions, agent workflow
- Removed empty `docs/plans/` directory

**How I verified**

- Tests: `npm run test:run` → pass (143/143)
- E2E: not run (docs-only change, no code affected)

**Result**

- Feature status: passing (no features changed)
- Repo state: clean

**Next**

- Do this first: Fill in ADRs for key past decisions (auth provider, permission model, LINE OAuth)
- Then: Add E2E tests for assignments, teams, budget modules (see tech-debt.md)

---

### 2026-02-23 11:45 +08:00 — E2E Tests + Pre-commit Hooks

**Branch / Worktree**: `main` / project root
**Focus feature**: assignments, teams, budget, authorization (E2E coverage) + dev tooling

**What I tried**

- Wrote E2E tests for 4 untested features: assignments, teams, budget, role permissions
- Fixed pre-existing bugs: login redirect (callbackUrl), admin layout path restriction, strict mode violations
- Set up pre-commit hooks with husky + lint-staged + Prettier

**What changed**

- 4 new E2E test files: `e2e/8-admin-assignments.spec.ts` (6 tests), `e2e/9-admin-teams.spec.ts` (7 tests), `e2e/10-admin-budget.spec.ts` (6 tests), `e2e/11-admin-role-permissions.spec.ts` (4 tests)
- Fixed `e2e/auth.setup.ts`: added `?callbackUrl=%2Fadmin%2Fevents` to login URL
- Fixed `e2e/1-auth.spec.ts`, `e2e/3-public-event.spec.ts`, `e2e/7-checkin-flow.spec.ts`: updated login redirect from `/admin/events` to `/events`
- Fixed `src/app/admin/layout.tsx`: added `isAdmin ||` bypass so admin can access all admin pages (not just navItems paths)
- New files: `.husky/pre-commit`, `.prettierrc`, `.prettierignore`
- Updated `package.json`: added husky, lint-staged, prettier devDeps + lint-staged config + format scripts
- Ran `npx prettier --write .` to format entire codebase
- Updated `tech-debt.md` and `feature-list.json`

**How I verified**

- Tests: `npm run test:run` → pass (143/143)
- E2E (new tests only): `npm run test:e2e -- --grep "Admin (assignment|team|budget|role)"` → 23/23 pass
- E2E (full suite): `npm run test:e2e` → 36 pass, 5 fail (all 5 failures are pre-existing in tests 2, 4, 5, 6, 7)

**Result**

- Feature status: passing (all 4 new E2E suites pass)
- Repo state: clean
- Pre-existing E2E failures in tests 2 (create event), 4 (registrations), 5 (attendance), 6 (user edit), 7 (check-in) — not caused by this session's changes

**Next**

- Do this first: Investigate and fix 5 pre-existing E2E test failures
- Then: Set up CI/CD pipeline (GitHub Actions)
