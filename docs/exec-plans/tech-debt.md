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

### Member self check-in for events requires a role permission (discovered 2026-11-21)

- `POST /api/attendance` requires `attendance:read`, but the `MEMBER` role has no permissions (`prisma/seed.ts`, `prisma/init-production.ts`), so plain members likely get 403 when scanning an event QR code
- `e2e/7-checkin-flow.spec.ts` only passes because `e2e/6-admin-users.spec.ts` first promotes 林小明 to 組長
- The punch module (`/api/punch-activities/[id]/today`) authorizes by roster membership instead

### Date-dependent e2e failures on the public events page (discovered 2026-11-21)

- `e2e/1-auth.spec.ts` (heading 所有活動) and `e2e/3-public-event.spec.ts` (buttons 立即報名 / 登入後報名) fail on `main`
- Likely cause: seed event dates are now in the past, so those pages no longer show the expected content

## Medium Priority

### ~~No pre-commit mechanism~~ (Resolved 2026-02-23)

Added husky + lint-staged + Prettier. Pre-commit hook runs ESLint --fix and Prettier on staged files.

### No CI/CD pipeline

- No GitHub Actions workflow for lint, test, build checks on PRs
- E2E tests not automated in CI

### QR check-in has no unit tests

- `src/lib/qrcode.ts` untested
- Check-in API route untested at unit level (covered by E2E only)

### Punch roster user search requires `users:read`

- Adding roster members on `/admin/punch/[activityId]` searches via `GET /api/users`, which requires `users:read`; staff with only `attendance:write` cannot search users (same limitation as the teams page)

### Missing API-level validation

- Some API routes rely on Prisma for validation rather than explicit Zod schemas
- Input validation inconsistent across routes

## Low Priority

### No error boundary components

- React error boundaries not implemented for graceful failure in UI

### No i18n framework

- Chinese strings hardcoded in `constants.ts` and component files
- No structured i18n approach if English support is ever needed
