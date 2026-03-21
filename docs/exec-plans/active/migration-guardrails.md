# Migration Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add build-time safety checks to prevent destructive database migrations from being applied to production without human review, and create automatic database snapshots before each migration.

**Architecture:** A single TypeScript script (`prisma/safe-migrate.ts`) runs during Vercel's production build, replacing the raw `prisma migrate deploy`. It scans pending migration SQL for dangerous patterns, checks a git-tracked allowlist (`prisma/migrations/reviewed.json`), creates a Neon database branch as a backup, then runs the migration. If dangerous SQL is found without approval, the build fails.

**Tech Stack:** TypeScript, Node.js built-in `fs`/`child_process`, Neon REST API (via `fetch`), Prisma CLI

**Spec:** `docs/design-docs/features/migration-guardrails.md`

---

## File Structure

| File                              | Responsibility                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `prisma/safe-migrate.ts`          | Main guardrail script — orchestrates SQL scanning, Neon backup, and migration execution |
| `prisma/migration-review.ts`      | SQL danger detection logic + reviewed.json checking (pure functions, easily testable)   |
| `prisma/neon-branch.ts`           | Neon API client — create branch, list branches, delete branch                           |
| `prisma/migrations/reviewed.json` | Git-tracked allowlist of approved dangerous migrations                                  |
| `prisma/migration-review.test.ts` | Unit tests for SQL scanning and review checking                                         |
| `prisma/neon-branch.test.ts`      | Unit tests for Neon API client (mocked fetch)                                           |
| `prisma/safe-migrate.test.ts`     | Unit tests for the orchestrator (mocked dependencies)                                   |

---

### Task 1: SQL Danger Scanner (`prisma/migration-review.ts`)

**Files:**

- Create: `prisma/migration-review.ts`
- Create: `prisma/migration-review.test.ts`

- [ ] **Step 1: Write failing tests for `scanSqlForDangers`**

Create `prisma/migration-review.test.ts` with tests covering each dangerous pattern. The function `scanSqlForDangers(sql: string)` should return an array of `{ line: number; content: string; pattern: string }` objects.

Test cases:

- `DROP TABLE "User"` → detected as "DROP TABLE"
- `DROP COLUMN "location"` → detected as "DROP COLUMN"
- `ALTER COLUMN "name" TYPE varchar(100)` → detected as "ALTER COLUMN TYPE"
- `SET NOT NULL` (without DEFAULT in same statement) → detected
- `DROP INDEX` → detected
- `DROP CONSTRAINT` → detected
- `TRUNCATE` → detected
- `DELETE FROM` → detected
- `ALTER TYPE "Role" RENAME VALUE` → detected
- Safe SQL like `CREATE TABLE`, `ADD COLUMN`, `ALTER COLUMN SET DEFAULT` → returns empty array
- SQL comments containing dangerous keywords (e.g., `-- DROP TABLE`) → NOT detected (comments should be stripped)

```typescript
import { describe, it, expect } from "vitest";
import { scanSqlForDangers } from "./migration-review";

describe("scanSqlForDangers", () => {
  it("detects DROP TABLE", () => {
    const sql = 'DROP TABLE "User";';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP TABLE");
    expect(dangers[0].line).toBe(1);
  });

  it("detects DROP COLUMN", () => {
    const sql = 'ALTER TABLE "Event" DROP COLUMN "location";';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP COLUMN");
  });

  it("detects ALTER COLUMN TYPE change", () => {
    const sql = 'ALTER TABLE "Event" ALTER COLUMN "name" TYPE varchar(100);';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("ALTER COLUMN TYPE");
  });

  it("detects SET NOT NULL without DEFAULT", () => {
    const sql = 'ALTER TABLE "Event" ALTER COLUMN "title" SET NOT NULL;';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("SET NOT NULL");
  });

  it("allows SET NOT NULL when DEFAULT is present in same migration", () => {
    const sql = [
      'ALTER TABLE "Event" ALTER COLUMN "title" SET DEFAULT \'untitled\';',
      'ALTER TABLE "Event" ALTER COLUMN "title" SET NOT NULL;',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(0);
  });

  it("detects TRUNCATE", () => {
    const dangers = scanSqlForDangers('TRUNCATE TABLE "Event";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("TRUNCATE");
  });

  it("detects DELETE FROM", () => {
    const dangers = scanSqlForDangers('DELETE FROM "Event";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DELETE FROM");
  });

  it("detects DROP INDEX", () => {
    const dangers = scanSqlForDangers('DROP INDEX "Event_title_key";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP INDEX");
  });

  it("detects DROP CONSTRAINT", () => {
    const dangers = scanSqlForDangers('ALTER TABLE "Event" DROP CONSTRAINT "Event_pkey";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP CONSTRAINT");
  });

  it("detects ALTER TYPE RENAME VALUE", () => {
    const dangers = scanSqlForDangers("ALTER TYPE \"Role\" RENAME VALUE 'MEMBER' TO 'USER';");
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("ALTER TYPE RENAME VALUE");
  });

  it("ignores safe SQL", () => {
    const sql = [
      'CREATE TABLE "NewTable" ("id" TEXT NOT NULL);',
      'ALTER TABLE "Event" ADD COLUMN "venue" TEXT;',
      'CREATE INDEX "Event_title_idx" ON "Event"("title");',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(0);
  });

  it("ignores dangerous keywords in SQL comments", () => {
    const sql = [
      "-- DROP TABLE cleanup (this is just a comment)",
      "/*",
      "  Warnings:",
      "  - You are about to drop the column registrationMode",
      "*/",
      'ALTER TABLE "Event" ADD COLUMN "venue" TEXT;',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(0);
  });

  it("reports correct line numbers", () => {
    const sql = [
      "-- AlterTable",
      'ALTER TABLE "Event" ADD COLUMN "venue" TEXT;',
      "",
      "-- DropColumn",
      'ALTER TABLE "Event" DROP COLUMN "location";',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].line).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run prisma/migration-review.test.ts`
Expected: FAIL — module `./migration-review` not found

- [ ] **Step 3: Implement `scanSqlForDangers`**

Create `prisma/migration-review.ts`. The function should:

1. Strip SQL comments (both `--` line comments and `/* */` block comments)
2. Check each remaining line against the dangerous patterns using case-insensitive regex
3. Special case: `SET NOT NULL` is only dangerous if no `SET DEFAULT` appears for the same column in the same migration file
4. Return array of `{ line: number; content: string; pattern: string }` (line numbers refer to the original SQL, not the stripped version)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run prisma/migration-review.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/migration-review.ts prisma/migration-review.test.ts
git commit -m "feat: add SQL danger scanner for migration review"
```

---

### Task 2: Review Allowlist Checker (`prisma/migration-review.ts`)

**Files:**

- Modify: `prisma/migration-review.ts`
- Modify: `prisma/migration-review.test.ts`

- [ ] **Step 1: Write failing tests for `checkReviewedAllowlist`**

Add tests to `prisma/migration-review.test.ts`. The function `checkReviewedAllowlist(migrationName: string, reviewed: Record<string, string>)` returns `{ approved: boolean; justification?: string }`.

```typescript
describe("checkReviewedAllowlist", () => {
  it("returns approved with justification when migration is in allowlist", () => {
    const reviewed = { "20260321_add_venue": "intentional rename" };
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({ approved: true, justification: "intentional rename" });
  });

  it("returns not approved when migration is not in allowlist", () => {
    const reviewed = {};
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({ approved: false });
  });

  it("rejects empty justification", () => {
    const reviewed = { "20260321_add_venue": "" };
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({ approved: false });
  });

  it("rejects whitespace-only justification", () => {
    const reviewed = { "20260321_add_venue": "   " };
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({ approved: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run prisma/migration-review.test.ts`
Expected: FAIL — `checkReviewedAllowlist` not exported

- [ ] **Step 3: Implement `checkReviewedAllowlist`**

Add to `prisma/migration-review.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run prisma/migration-review.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/migration-review.ts prisma/migration-review.test.ts
git commit -m "feat: add reviewed.json allowlist checker"
```

---

### Task 3: Neon Branch API Client (`prisma/neon-branch.ts`)

**Files:**

- Create: `prisma/neon-branch.ts`
- Create: `prisma/neon-branch.test.ts`

- [ ] **Step 1: Write failing tests for Neon branch operations**

The module exports three functions:

- `createBranch(config: NeonConfig, name: string): Promise<{ id: string; name: string }>`
- `listBranches(config: NeonConfig, prefix: string): Promise<Array<{ id: string; name: string; created_at: string }>>`
- `deleteBranch(config: NeonConfig, branchId: string): Promise<void>`

Where `NeonConfig = { apiKey: string; projectId: string; parentBranchId: string }`.

Tests should mock `global.fetch` and verify:

- `createBranch` calls `POST /projects/{id}/branches` with correct body and returns branch info
- `createBranch` throws on API error with the error message from the response
- `listBranches` calls `GET /projects/{id}/branches` and filters by prefix
- `deleteBranch` calls `DELETE /projects/{id}/branches/{branchId}`
- `deleteBranch` does not throw on 404 (branch already deleted)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBranch, listBranches, deleteBranch, type NeonConfig } from "./neon-branch";

const config: NeonConfig = {
  apiKey: "test-api-key",
  projectId: "test-project",
  parentBranchId: "br-main-123",
};

describe("createBranch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a branch and returns its info", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          branch: { id: "br-new-456", name: "pre-migrate-20260321" },
        }),
        { status: 201 }
      )
    );

    const result = await createBranch(config, "pre-migrate-20260321");
    expect(result).toEqual({ id: "br-new-456", name: "pre-migrate-20260321" });

    expect(fetch).toHaveBeenCalledWith(
      "https://console.neon.tech/api/v2/projects/test-project/branches",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      })
    );
  });

  it("throws on API error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "quota exceeded" }), { status: 422 })
    );

    await expect(createBranch(config, "test")).rejects.toThrow("quota exceeded");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run prisma/neon-branch.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `neon-branch.ts`**

Implement using `fetch` (available in Node 18+, which Vercel uses). The Neon API base URL is `https://console.neon.tech/api/v2`. All requests need `Authorization: Bearer {apiKey}` and `Content-Type: application/json`.

API endpoints:

- Create: `POST /projects/{projectId}/branches` with body `{ endpoints: [{ type: "read_only" }], branch: { parent_id: parentBranchId, name: branchName } }`
- List: `GET /projects/{projectId}/branches`
- Delete: `DELETE /projects/{projectId}/branches/{branchId}`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run prisma/neon-branch.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/neon-branch.ts prisma/neon-branch.test.ts
git commit -m "feat: add Neon branch API client for migration backups"
```

---

### Task 4: Orchestrator Script (`prisma/safe-migrate.ts`)

**Files:**

- Create: `prisma/safe-migrate.ts`
- Create: `prisma/safe-migrate.test.ts`

- [ ] **Step 1: Write failing tests for the orchestrator**

The orchestrator function `safeMigrate()` coordinates the full flow. Tests should mock:

- `child_process.execSync` for `prisma migrate status` and `prisma migrate deploy`
- `fs.readFileSync` for reading migration SQL files and `reviewed.json`
- `fs.readdirSync` for listing migration directories
- The neon-branch module functions

Test scenarios:

- No pending migrations → exits successfully without creating a branch
- Pending migration with safe SQL → creates branch, runs migrate, cleans up old branches
- Pending migration with dangerous SQL not in reviewed.json → throws with BLOCKED message
- Pending migration with dangerous SQL that IS in reviewed.json → proceeds
- Neon branch creation fails → throws (refuses to migrate without backup)
- `prisma migrate deploy` fails → throws (branch preserved as restore point)
- Branch cleanup keeps only the 3 most recent `pre-migrate-*` branches

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run prisma/safe-migrate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `safe-migrate.ts`**

The script should:

1. Run `prisma migrate status` via `execSync` and parse output to find pending migrations. If the output contains "Database schema is up to date" or similar, exit 0.
2. For each pending migration directory in `prisma/migrations/`, read the `migration.sql` file.
3. Run `scanSqlForDangers` on each SQL file. If dangers are found, check `reviewed.json`.
4. If any dangerous migration is not approved, print a clear BLOCKED message and `process.exit(1)`.
5. Read Neon config from env vars: `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID`.
6. Call `createBranch` with name `pre-migrate-{YYYYMMDD-HHmmss}`.
7. Run `npx prisma migrate deploy` via `execSync`.
8. On success: call `listBranches` with prefix `pre-migrate-`, sort by `created_at`, delete all but the 3 most recent.
9. On failure: log that the backup branch exists for restore, then `process.exit(1)`.

The script should be both importable (for testing) and directly executable (has a `main()` that calls `safeMigrate()` and handles process exit).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run prisma/safe-migrate.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Run all tests**

Run: `npx vitest run prisma/`
Expected: all tests in `prisma/` PASS

- [ ] **Step 6: Commit**

```bash
git add prisma/safe-migrate.ts prisma/safe-migrate.test.ts
git commit -m "feat: add safe-migrate orchestrator script"
```

---

### Task 5: Reviewed.json and Vercel Build Command

**Files:**

- Create: `prisma/migrations/reviewed.json`
- Modify: `.env.example` (add new env vars)

- [ ] **Step 1: Create empty reviewed.json**

Create `prisma/migrations/reviewed.json` with empty object:

```json
{}
```

- [ ] **Step 2: Update `.env.example`**

Add the new Neon env vars to `.env.example`:

```
# Neon API (for migration guardrails — production only)
NEON_API_KEY=your-neon-api-key
NEON_PROJECT_ID=your-neon-project-id
NEON_BRANCH_ID=your-neon-production-branch-id
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/reviewed.json .env.example
git commit -m "feat: add reviewed.json allowlist and Neon env var docs"
```

- [ ] **Step 5: Update Vercel build command**

The Vercel build command must be updated manually in the Vercel dashboard (Project Settings → General → Build Command):

**From:**
if [ "$VERCEL_ENV" = "production" ]; then npx prisma migrate deploy; fi && npm run build

**To:**
if [ "$VERCEL_ENV" = "production" ]; then npx tsx prisma/safe-migrate.ts; fi && npm run build

- [ ] **Step 6: Add Neon env vars to Vercel**

Add these environment variables in Vercel dashboard (Project Settings → Environment Variables), scoped to Production only:

- `NEON_API_KEY` — generate from Neon dashboard → Account Settings → API Keys
- `NEON_PROJECT_ID` — `fragrant-breeze-16357723`
- `NEON_BRANCH_ID` — `br-lucky-hill-aiyp9z7z`

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Test locally with a fake dangerous migration**

Create a temporary test migration directory and SQL file to verify the scanner catches it:

```bash
mkdir -p prisma/migrations/99990101000000_test_danger
echo 'ALTER TABLE "Event" DROP COLUMN "location";' > prisma/migrations/99990101000000_test_danger/migration.sql
```

Run: `npx tsx prisma/safe-migrate.ts`
Expected: script outputs BLOCKED message and exits with code 1.

- [ ] **Step 2: Test approval flow**

Add the test migration to reviewed.json:

```json
{
  "99990101000000_test_danger": "test migration — verifying guardrail approval flow"
}
```

Run the script again (it will fail at Neon API since we don't have env vars locally, but it should get past the review gate).

- [ ] **Step 3: Clean up test migration**

```bash
rm -rf prisma/migrations/99990101000000_test_danger
```

Reset `reviewed.json` back to `{}`.

- [ ] **Step 4: Update design doc status**

Change status from "Draft" to "Approved" in `docs/design-docs/features/migration-guardrails.md`.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "docs: mark migration guardrails design as approved"
```

---

## Progress

- [ ] Task 1: SQL Danger Scanner
- [ ] Task 2: Review Allowlist Checker
- [ ] Task 3: Neon Branch API Client
- [ ] Task 4: Orchestrator Script
- [ ] Task 5: Reviewed.json and Vercel Build Command
- [ ] Task 6: End-to-End Verification

## Decision Log

| Date       | Decision                                     | Rationale                                                                             |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2026-03-21 | File-based approval over env var override    | Git audit trail, no risk of forgetting to unset                                       |
| 2026-03-21 | Keep auto-deploy, don't add manual promote   | Small team, avoid slowing down non-migration deploys                                  |
| 2026-03-21 | Keep Neon over migrating to Supabase         | Neon branching is better for migration safety; observability solved by Sentry instead |
| 2026-03-21 | Single build-time script over GitHub Actions | Simpler, no extra infrastructure, fits Vercel's model                                 |
