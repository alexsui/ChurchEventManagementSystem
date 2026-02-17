# E2E Test Design — Playwright

## Overview

Full Playwright E2E test coverage for all 7 major user flows in the church event management system.

## Structure

```
e2e/
  playwright.config.ts           # Config: webServer, baseURL, globalSetup
  global-setup.ts                # Re-seeds DB before test run
  auth.setup.ts                  # Logs in as admin, saves storageState
  1-auth.spec.ts                 # Auth flows
  2-admin-events.spec.ts         # Event CRUD + status management
  3-public-event.spec.ts         # Public event page + registration
  4-admin-registrations.spec.ts  # Registration management
  5-admin-attendance.spec.ts     # Attendance QR + manual check-in
  6-admin-users.spec.ts          # User management + role editing
  7-checkin-flow.spec.ts         # Full QR check-in flow
```

## Setup

- **Dev server**: Auto-started via Playwright `webServer` config (`npm run dev` on port 3000)
- **Database**: Re-seeded via `npx prisma db seed` in `globalSetup` before each test run
- **Auth**: `auth.setup.ts` logs in as admin and saves `storageState` to `e2e/.auth/admin.json`; admin test files reuse this state to skip login

## Test Scenarios

### 1-auth.spec.ts
- Register new account → redirected to admin/events
- Login with existing credentials → admin dashboard
- Login with wrong password → error message
- Logout → redirected to login

### 2-admin-events.spec.ts (admin session)
- Events list shows seed data (2 events)
- Create new single event → appears in list
- Click event → detail page shows info, sessions, status buttons
- Change event status (OPEN → IN_PROGRESS) → badge updates
- Edit event via dialog → changes saved

### 3-public-event.spec.ts
- View public event detail → title, location, date, registration info
- Click "立即報名" when logged in → registration succeeds, shows QR code
- View event when not logged in → button visible (redirects to login)

### 4-admin-registrations.spec.ts (admin session)
- Select event → registrations table loads with correct count
- Filter by status → table filters correctly
- Cancel a registration → confirmation → row updates to "已取消"

### 5-admin-attendance.spec.ts (admin session)
- Select event + session → QR code tab shows QR image and URL
- Switch to manual tab → shows "已報到 3 / 已報名 3 人"
- Check a user checkbox → bulk check-in → count updates

### 6-admin-users.spec.ts (admin session)
- Users table shows all 8 seed users
- Search filters by name
- Click user → edit dialog → change role → saves
- Toggle active/inactive → status badge changes

### 7-checkin-flow.spec.ts
- Navigate to `/check-in/[sessionId]` not logged in → login prompt
- Navigate logged in as registered member → event info + "確認報到"
- Click "確認報到" → success state with time
- Visit again → "您已報到" (already checked in)

## Auth Strategy

- `auth.setup.ts` runs as a Playwright "setup" project — admin tests depend on it
- Admin tests (2-6) use `storageState: 'e2e/.auth/admin.json'`
- `1-auth.spec.ts` and `7-checkin-flow.spec.ts` manage auth inline
- Test 7 logs in as a member user (ming@example.com) for the check-in flow

## Test Isolation

- `globalSetup` re-seeds DB once before the entire run
- Numbered files run in dependency order
- `test.describe.serial()` within files when tests depend on each other
- Trade-off: simpler than per-test DB reset, order-dependent but appropriate for project size
