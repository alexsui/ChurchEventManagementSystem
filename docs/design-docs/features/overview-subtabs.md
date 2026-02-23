# Design: Overview Sub-tabs for Attendance & Assignments

**Date:** 2026-02-18

## Problem

The 出席 (Attendance) and 作業 (Assignments) tabs only show per-session detail views. There's no way to see a cross-session summary of all users' attendance rates or assignment completion rates at a glance.

## Design

Add a **總覽 (Overview)** sub-tab as the default view in both the 出席 and 作業 tabs. The existing per-session management views become a second sub-tab ("場次管理").

Both overviews follow the same pattern: **users as rows, sessions as columns, summary at the end**.

### 出席總覽 (Attendance Overview)

| 姓名   | 第1堂 (02/18) | 第2堂 (02/25) | 第3堂 (03/04) | 出席率 |
| ------ | :-----------: | :-----------: | :-----------: | -----: |
| 王小明 |       ✓       |       ✓       |      N/A      |    N/A |
| 李小華 |       ✓       |       ✗       |      N/A      |    N/A |

Cell logic:

- **Future session** (sessionDate > now) → `N/A`
- **Past session, attended** → `✓`
- **Past session, absent** → `✗`

出席率 column:

- Only shows a percentage when **all sessions are in the past** (no N/A remaining)
- Otherwise shows `N/A`
- Formula: `sessions attended / total sessions`

### 作業總覽 (Assignment Overview)

| 姓名   | 第1堂 (02/18) | 第2堂 (02/25) | 第3堂 (03/04) | 繳交率 |  結果  |
| ------ | :-----------: | :-----------: | :-----------: | -----: | :----: |
| 王小明 |      2/3      |       —       |      1/1      |    75% | 未通過 |
| 李小華 |      3/3      |       —       |      N/A      |    N/A |  N/A   |

Cell logic:

- **Future session** → `N/A`
- **Past session, has assignments** → fraction like `2/3` (completed/total)
- **Past session, no assignments** → `—` (dash, skipped in calculation)

繳交率 column:

- Only shows when **all sessions are in the past** (no N/A remaining)
- Formula: `total completed / total assignments` (only across past sessions that have assignments; sessions with "—" are excluded)
- Otherwise shows `N/A`

結果 column:

- Compares 繳交率 against `minAssignmentRate` threshold
- Shows 通過/未通過
- Hidden entirely if `minAssignmentRate` is not set on the event
- Shows `N/A` when 繳交率 is `N/A`

### Tab Structure Changes

**出席 tab:**

- 總覽 (default) — attendance overview table
- 場次管理 — existing QR code + manual check-in per session

**作業 tab:**

- 總覽 (default) — assignment overview table
- 場次管理 — existing per-session assignment list + completion detail

### Data Requirements

Both overviews need cross-session aggregate data. New API endpoints:

1. `GET /api/events/{eventId}/attendance-summary`
   - Returns all attendance records across all sessions for the event
   - Combined with registrations and sessions on the client

2. `GET /api/events/{eventId}/assignment-summary`
   - Returns all assignments and their completions across all sessions
   - Combined with registrations and sessions on the client

### Session Date Determination

A session is considered "past" using the same logic as `computeEffectiveStatus`:

- If `endTime` exists: past when `now >= sessionDate + endTime`
- If no `endTime`: past when `now >= sessionDate + 1 day`
