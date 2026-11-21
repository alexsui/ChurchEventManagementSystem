# 打卡 (Punch) module: self check-in with attendance-rate analysis

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

## Purpose / Big Picture

The church worship team (敬拜團) wants to record who attends each rehearsal (團練) throughout 2027 and see each member's attendance rate for the year. Rehearsal dates and times are irregular, so nobody can schedule the rehearsals in advance. The existing event module cannot express this: every event must have pre-scheduled sessions with fixed dates.

After this change a staff member can create a "打卡活動" (punch activity) with a name and a date range (for example 2027/01/01–2027/12/31), maintain a roster of members with join and leave dates, and print one fixed QR code. At each rehearsal, members scan the QR code with their phone, log in, and tap "打卡". The system records that member for today's date (Taiwan time). Any day on which at least one member punched counts as one rehearsal. The admin page shows each member's attendance rate, computed only over rehearsals that happened while that person was on the roster, and exports it to Excel. If someone scans on a non-rehearsal day by mistake, the admin can delete that day's records so it no longer counts as a rehearsal.

To see it working: log in as admin, open 打卡管理 in the admin sidebar, create an activity whose range includes today, add a member, open the activity's QR link as that member and tap 打卡, then return to the admin page and see that member at 1/1 (100%).

The term "punch" is used throughout the code for 打卡 (as in punching a time card). It is deliberately different from the existing "check-in" feature, which is per-session attendance for events (`/check-in/[sessionId]`, `src/services/attendance.service.ts`).

## Progress

- [x] (2026-11-21) Requirements gathered from the requester (Grace) via chat; decided on a standalone module.
- [x] (2026-11-21) Worktree `../church-event-checkin` on branch `feature/checkin`; local Postgres 17 running in Docker container `church-events-pg`; baseline unit tests 200 passed.
- [x] (2026-11-21) Baseline e2e on `main`: 47 passed, 3 failed (pre-existing, see Surprises).
- [x] (2026-11-21) Milestone 1: schema + migration `20261121040438_add_punch_activities` + `src/services/punch.service.ts` + 34 unit tests passing.
- [x] (2026-11-21) Milestone 2: API routes under `src/app/api/punch-activities/`.
- [x] (2026-11-21) Milestone 3: admin pages `/admin/punch`, `/admin/punch/[activityId]`, member page `/punch/[activityId]`, Excel export, sidebar entry.
- [x] (2026-11-21) Milestone 4: `e2e/12-admin-punch.spec.ts` (7 tests) passing; full local e2e 54 passed / 3 failed (same 3 as baseline); unit 234 passed; `npm run build` OK; `ARCHITECTURE.md` and `docs/exec-plans/tech-debt.md` updated.

## Surprises & Discoveries

- Observation: the `MEMBER` role has no rows granting any permission (`prisma/seed.ts` and `prisma/init-production.ts` both define `MEMBER: {}`), yet the existing self check-in endpoint `POST /api/attendance` requires `attendance:read`. Member self check-in for events therefore depends on role permissions. The punch endpoint must not copy that check; it authorizes by roster membership instead.
  Evidence: `src/app/api/attendance/route.ts` POST calls `hasPermission(session.user.role, "attendance", "read")`. The e2e spec `e2e/7-checkin-flow.spec.ts` only passes because `e2e/6-admin-users.spec.ts` first promotes 林小明 (`ming@example.com`) to 組長 (TEAM_LEADER, which has attendance:read). A plain MEMBER most likely gets 403 on event self check-in. Out of scope here; reported to the user.

- Observation: the baseline e2e run on `main` (before any change) has 3 failures, all on the public events page: `1-auth` waits for heading 所有活動, `3-public-event` waits for buttons 立即報名 / 登入後報名. 47 passed. Seed event dates are likely in the past relative to today (2026-11-21), so those pages no longer show the expected content. Pre-existing; not touched by this plan.
  Evidence: `npm run test:e2e` on baseline: "3 failed … 47 passed (1.9m)".

- Observation: with Prisma 7, `npx prisma migrate dev` creates and applies the migration but does not regenerate the client; `tsc` reported `Property 'punchActivity' does not exist` until `npx prisma generate` was run.
  Evidence: `src/services/punch.service.ts(129,33): error TS2339: Property 'punchActivity' does not exist on type 'PrismaClient…'`, which went away after `npx prisma generate`.

- Observation: Playwright orders spec files lexically, so `12-admin-punch` runs between `11-…` and `2-…`, not last. The punch spec does not depend on order.

- Observation: e2e specs share one database seeded once per run, and earlier specs mutate users (6-admin-users promotes 林小明 and deactivates 周志偉). The punch spec therefore uses 劉大華 (`dahua@example.com`) as the roster member and 趙雅婷 (`yating@example.com`) as the non-member, both of whom stay MEMBER and active.

## Decision Log

- Decision: build a standalone module (new tables, pages, APIs) instead of adding a category or type to `Event`.
  Rationale: `Event` assumes pre-scheduled `EventSession` rows (creation throws without sessions), registration capacity and waitlist, a status computed from session dates, plus teams, budget and assignments panels. None of these apply. Bending `Event` would scatter "if punch" branches across the event form, service, status logic and public event list, and two future punch use cases (健走8000步 daily walking, 家庭祭壇 family altar) need different denominators. A separate module leaves production event code untouched.
  Date/Author: 2026-11-21 / Claude with user approval.

- Decision: a rehearsal is any calendar date (Asia/Taipei) on which at least one roster member punched. No session rows exist.
  Rationale: the requester chose "團員報到時，系統自動算進當天那一場". Deriving rehearsals from records avoids creating sessions and the race condition of two simultaneous first scans creating the same session.
  Date/Author: 2026-11-21 / Claude.

- Decision: attendance rate = (dates the member punched within their membership window) ÷ (rehearsal dates within their membership window). The window is `joinedOn` through `leftOn` (inclusive; `leftOn` empty means still a member). If the window contains no rehearsals the rate is shown as "—".
  Rationale: the requester confirmed the basic formula and raised the mid-year join problem without a preference. An explicit join date on the roster is fairer than counting from first punch (which hides absences right after joining) and fairer than counting all rehearsals (which penalizes late joiners). Members who leave keep their stats up to `leftOn`.
  Date/Author: 2026-11-21 / Claude, default pending requester confirmation.

- Decision: admin-side authorization reuses the existing `attendance` permission module (read for viewing, write for changes). Member-side punching requires only login, an active account, and an active roster membership for today.
  Rationale: avoids adding a permission module (which would require changes to the role-permission matrix UI, seed and production data). Roster membership is the real authorization for punching.
  Date/Author: 2026-11-21 / Claude.

- Decision: out of scope for this version: late tracking, leader-side roll call, per-month trends, walking/family-altar modes, manual punch by admin.
  Rationale: the requester did not choose them; keep the first version minimal.
  Date/Author: 2026-11-21 / Claude.

## Outcomes & Retrospective

(2026-11-21) Delivered the full scope in one session. Staff can create a punch activity, maintain a roster with join and leave dates, print one QR code, see per-member attendance rates and the list of rehearsal dates, delete a mistaken date, and export to Excel. Members punch from their phones; logging in from the punch page returns them to it. Plain `MEMBER` accounts can punch (verified in e2e with 劉大華), because punching is authorized by roster membership.

Remaining outside this plan: (1) the requester (Grace) should confirm the mid-year join rule (rate counted from the roster join date); (2) after merging to `dev`, apply the migration to the Neon dev database manually (Vercel dev/preview builds do not run migrations); (3) the walking (健走8000步) and family-altar (家庭祭壇) modes need a different denominator (days or weeks in the period) and are a future extension; (4) pre-existing issues found during the work are recorded in `docs/exec-plans/tech-debt.md`.

Lesson: deriving rehearsals from punch records (instead of creating session rows) kept the model to three tables and removed the race on the first scan of the day.

## Context and Orientation

This is a Next.js 16 App Router application (TypeScript, React 19) using Prisma 7 with PostgreSQL, NextAuth v5 for login, Tailwind and shadcn/ui components (in `src/components/ui/`), and Vitest plus Playwright for tests. The UI is in Traditional Chinese.

Layers: pages under `src/app/` call REST API routes under `src/app/api/`. API routes are thin: they call `auth()` from `src/lib/auth.ts` to get the logged-in user, check permissions with `hasPermission(role, module, action)` from `src/lib/authorization.ts` (ADMIN always passes), call a service function, and return JSON. Write endpoints also call `assertActive(session.user)`, which returns a 403 response for deactivated accounts. Business logic lives in `src/services/*.service.ts`; services throw a custom error class with a `code` string, and routes map codes to HTTP statuses (see `src/app/api/attendance/route.ts` for the pattern). Unit tests sit next to the service (`foo.service.test.ts`) and mock `@/lib/prisma` with `vi.hoisted` (see `src/services/attendance.service.test.ts`).

The database schema is `prisma/schema.prisma`; the generated client is imported from `@/generated/prisma/client`. `prisma/seed.ts` wipes and reseeds the local database; the Playwright global setup (`e2e/global-setup.ts`) runs the seed before every e2e run. Seed users all have password `password123`; `admin@church.org` is ADMIN, `ming@example.com`, `meiling@example.com`, `dahua@example.com`, `yating@example.com`, `zhiwei@example.com` are MEMBER.

The admin shell is `src/app/admin/layout.tsx`. Its `navItems` array defines sidebar links, each tied to a permission module; the layout hides links the user cannot read and redirects away from admin paths that do not start with a visible link's `href`. Admin pages read permissions with `useAdminPermissions(module)` from `src/contexts/admin-permissions.tsx`.

Existing pieces reused here: `QRCodeDisplay` (`src/components/shared/qrcode-display.tsx`) renders a QR code for a URL with copy and download buttons; `src/lib/excel-export.ts` builds `.xlsx` files client-side with the `xlsx` package; user search for adding people is `GET /api/users?search=...` returning `{ data: User[] }` (requires `users:read`, the same limitation the teams page already has); the login page accepts `?callbackUrl=` and returns there after login.

Dates: a "date-only" value in this plan is a calendar date string `YYYY-MM-DD`. In the database it is a Postgres `date` column (`@db.Date`), which Prisma reads and writes as a JavaScript `Date` at UTC midnight. "Today" always means today in the Asia/Taipei time zone, because Vercel servers run in UTC and a rehearsal at 08:00 Taiwan time is still the previous day in UTC.

## Plan of Work

Milestone 1 adds the data model and all business rules. In `prisma/schema.prisma` add three models. `PunchActivity` has `id`, `title`, `startDate` and `endDate` (both `@db.Date`), timestamps, and relations to members. `PunchMember` has `id`, `activityId`, `userId`, `joinedOn` (`@db.Date`), optional `leftOn` (`@db.Date`), timestamps, a unique constraint on `(activityId, userId)`, and cascade deletes from both the activity and the user. `PunchRecord` has `id`, `memberId`, `date` (`@db.Date`), `punchedAt` (default now), a unique constraint on `(memberId, date)`, and a cascade delete from the member, so removing a mistaken roster entry also removes that person's records. Add `punchMemberships PunchMember[]` to `User`. Create the migration with `npx prisma migrate dev --name add_punch_activities`; it only creates tables, so `prisma/safe-migrate.ts --check-only` must pass without approval. Add `await prisma.punchActivity.deleteMany();` to the cleanup block at the top of `prisma/seed.ts` so e2e runs start clean.

Then create `src/services/punch.service.ts` exporting `PunchServiceError` and these functions. Date helpers: `taipeiToday(now)` returns the Asia/Taipei date string for an instant; `parseDateOnly(value)` validates `YYYY-MM-DD` (and that it is a real calendar date) and returns a UTC-midnight `Date`, throwing `INVALID_DATE`; `formatDateOnly(date)` returns the `YYYY-MM-DD` string. Pure statistics: `computePunchStats(dates, members)` takes the sorted list of rehearsal date strings and, per member, `joinedOn`, `leftOn` and the member's own punched dates, and returns `attendedDates`, `attended`, `eligible` and `rate` (`null` when `eligible` is 0) following the decision log formula. Data functions: `listPunchActivities()`, `createPunchActivity({ title, startDate, endDate })`, `updatePunchActivity(id, …)`, `deletePunchActivity(id)`, `getPunchActivityDetail(id)` (activity, the rehearsal dates with punch counts, and member stats), `addPunchMember(activityId, { userId, joinedOn })`, `updatePunchMember(activityId, memberId, { joinedOn, leftOn })`, `removePunchMember(activityId, memberId)`, `deletePunchDate(activityId, date)`, `getTodayStatus(activityId, userId | undefined, now)` and `punchToday(activityId, userId, now)`. Validation: title required; `startDate <= endDate`; `leftOn` empty or `>= joinedOn`. A member is active on date `d` when `joinedOn <= d` and (`leftOn` empty or `leftOn >= d`). `punchToday` throws `NOT_FOUND` (no activity), `OUT_OF_RANGE` (today outside the activity range), `NOT_MEMBER` (no active membership today), and `ALREADY_PUNCHED` (unique violation, Prisma error code `P2002`). Error codes for the other functions: `NOT_FOUND`, `MEMBER_NOT_FOUND`, `USER_NOT_FOUND`, `ALREADY_MEMBER`, `INVALID_INPUT`, `INVALID_DATE`.

Write `src/services/punch.service.test.ts` covering the time-zone boundary of `taipeiToday`, `parseDateOnly` rejection cases, `computePunchStats` (full attendance, mid-year join, left member, member with no eligible rehearsals), and each `punchToday` outcome with a mocked Prisma client.

Milestone 2 adds the API routes under `src/app/api/punch-activities/`. `route.ts`: GET list (attendance:read), POST create (attendance:write). `[activityId]/route.ts`: GET detail with stats (attendance:read), PATCH and DELETE (attendance:write). `[activityId]/members/route.ts`: POST add member. `[activityId]/members/[memberId]/route.ts`: PATCH dates, DELETE. `[activityId]/dates/[date]/route.ts`: DELETE all records on that date. `[activityId]/today/route.ts`: GET (no login required) returns `{ activity, today, status, punchedAt }` where `status` is one of `NOT_LOGGED_IN`, `OUT_OF_RANGE`, `NOT_MEMBER`, `READY`, `PUNCHED`; POST (login and active account required, no module permission) punches. Status codes: `NOT_FOUND`/`MEMBER_NOT_FOUND` 404, `NOT_MEMBER` 403, `ALREADY_PUNCHED`/`ALREADY_MEMBER` 409, validation errors 400.

Milestone 3 adds the UI. Add a sidebar item `{ href: "/admin/punch", label: "打卡管理", icon: Stamp, module: "attendance" }` in `src/app/admin/layout.tsx`. `src/app/admin/punch/page.tsx` lists activities (title, range, member count) with a create dialog. `src/app/admin/punch/[activityId]/page.tsx` shows the activity with edit and delete, a QR card for `${origin}/punch/${id}` using `QRCodeDisplay`, a 成員與出席率 table (name, phone, join date, leave date, attended/eligible, rate, edit and remove actions) with user search to add members and an 匯出 Excel button, and a 團練日期 table (date, number of punches, delete). `src/app/(public)/punch/[activityId]/page.tsx` is the phone page: it shows the activity title and today's date and renders one state per status, with a 前往登入 link that returns to the page after login and a 打卡 button that turns into a success state. Shared user-facing status messages go into `src/lib/constants.ts`. Add `exportPunchStatsToExcel` to `src/lib/excel-export.ts`: one sheet 出席率 with columns 姓名, 電話, 加入日期, 退出日期, 出席次數, 應出席次數, 出席率, followed by one column per rehearsal date showing ✓, ✗, or blank when outside the member's window.

Milestone 4 adds `e2e/12-admin-punch.spec.ts` covering the full scenario, runs the whole e2e suite locally, and updates `ARCHITECTURE.md` (new Punch module paragraph, service list) and this plan.

## Concrete Steps

All commands run from the worktree root `/Users/samuel/Developer/church-event-checkin`. Local Postgres must be running (`docker start church-events-pg`; connection settings come from `.env`).

    npx prisma migrate dev --name add_punch_activities
    npx tsx prisma/safe-migrate.ts --check-only
    npm run test:run
    npx tsc --noEmit
    npm run lint
    npm run test:e2e -- --reporter=line

## Validation and Acceptance

Unit tests: `npm run test:run` passes, including the new `src/services/punch.service.test.ts`.

End-to-end (`npm run test:e2e`), new spec `e2e/12-admin-punch.spec.ts`: as admin, create an activity covering today, add 劉大華 (`dahua@example.com`) to the roster, and see a QR code on the detail page. Not logged in, `/punch/<id>` shows a 前往登入 link. As `dahua@example.com`, open `/punch/<id>`, tap 打卡, see 打卡成功; reload and see 今天已打卡. As 趙雅婷 (`yating@example.com`, not on the roster), open the page and see the not-on-roster message. As admin, see 劉大華 at 1 / 1 and 100%, download an `.xlsx`, delete today's date, and see 劉大華 at 0 / 0 with rate "—". The pre-existing 3 baseline failures are expected to remain; everything else must pass.

## Idempotence and Recovery

The migration only creates tables; rolling back locally means `npx prisma migrate reset` (local only, wipes data). The seed wipes punch tables, so e2e runs are repeatable. Never run seed or manual `migrate deploy` against production; production migrations run in the Vercel build via `prisma/safe-migrate.ts`. Vercel preview/dev deploys do not run migrations: after pushing this branch to `dev`, apply the migration to the Neon dev database manually with `DIRECT_URL` and `DATABASE_URL` set to the Neon dev connection string and `npx prisma migrate deploy`.

## Artifacts and Notes

New punch spec, run alone:

    npx playwright test --config e2e/playwright.config.ts 12-admin-punch --reporter=line
    …
    8 passed (19.1s)        (7 punch tests + the auth setup project)

Full local suite after the change:

    npm run test:e2e -- --reporter=line
    3 failed
      e2e/1-auth.spec.ts:16:7 › Auth flows › login with existing credentials → events page
      e2e/3-public-event.spec.ts:15:7 › … click 立即報名 when logged in → registration succeeds
      e2e/3-public-event.spec.ts:35:7 › … view event when not logged in → login button visible
    54 passed (1.9m)

The same three tests fail on `main` before the change.

Unit tests and build:

    npm run test:run   →  Test Files 16 passed (16), Tests 234 passed (234)
    npm run build      →  ✓ Compiled successfully; routes /admin/punch, /admin/punch/[activityId], /punch/[activityId], /api/punch-activities/…

Local database for development and e2e: a Docker container `church-events-pg` (image `postgres:17`) on port 5432, using the credentials from `.env`. Start it with `docker start church-events-pg`.

## Interfaces and Dependencies

No new libraries. In `src/services/punch.service.ts`:

    export class PunchServiceError extends Error { code: string }
    export function taipeiToday(now?: Date): string
    export function parseDateOnly(value: string): Date
    export function formatDateOnly(date: Date): string
    export interface PunchMemberInput { joinedOn: string; leftOn: string | null; punchedDates: string[] }
    export interface PunchMemberStats { attendedDates: string[]; attended: number; eligible: number; rate: number | null }
    export function computePunchStats(dates: string[], member: PunchMemberInput): PunchMemberStats
    export type TodayStatus = "NOT_LOGGED_IN" | "OUT_OF_RANGE" | "NOT_MEMBER" | "READY" | "PUNCHED"

---

Revision note (2026-11-21): plan created, then updated at completion with progress, discoveries (Prisma 7 generate step, e2e ordering, pre-existing failures, member permission gap), outcomes, and evidence. Moved from `active/` to `completed/`.
