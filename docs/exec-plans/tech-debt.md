# Technical Debt

Known debt items, ordered by priority.

## High Priority

### ~~Missing E2E coverage for key modules~~ (Resolved 2026-02-23)

E2E tests added for all 4 modules:

- `e2e/8-admin-assignments.spec.ts` (6 tests)
- `e2e/9-admin-teams.spec.ts` (7 tests)
- `e2e/10-admin-budget.spec.ts` (6 tests)
- `e2e/11-admin-role-permissions.spec.ts` (4 tests)

### Integration tests require live database

- `registration.service.integration.test.ts` exists but needs a real DB connection
- No CI pipeline runs integration tests automatically

## Medium Priority

### ~~No pre-commit mechanism~~ (Resolved 2026-02-23)

Added husky + lint-staged + Prettier. Pre-commit hook runs ESLint --fix and Prettier on staged files.

### No CI/CD pipeline

- No GitHub Actions workflow for lint, test, build checks on PRs
- E2E tests not automated in CI

### QR check-in has no unit tests

- `src/lib/qrcode.ts` untested
- Check-in API route untested at unit level (covered by E2E only)

### Missing API-level validation

- Some API routes rely on Prisma for validation rather than explicit Zod schemas
- Input validation inconsistent across routes

## Low Priority

### No error boundary components

- React error boundaries not implemented for graceful failure in UI

### No i18n framework

- Chinese strings hardcoded in `constants.ts` and component files
- No structured i18n approach if English support is ever needed
