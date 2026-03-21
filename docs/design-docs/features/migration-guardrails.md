# Prisma Migration Guardrails — Design Document

| Item    | Details                                       |
| :------ | :-------------------------------------------- |
| Version | v1.0                                          |
| Date    | 2026-03-21                                    |
| Status  | Approved                                      |
| Scope   | Build-time migration safety for Vercel + Neon |

---

## 1. Problem

Schema migrations against a production database with real data can cause data loss,
downtime, or broken state. The current setup runs `prisma migrate deploy` during
Vercel's production build with no safety checks — any migration SQL committed to
`prisma/migrations/` is applied automatically.

### Current flow

```
Push to main → Vercel build →
  if VERCEL_ENV=production: npx prisma migrate deploy
  → npm run build → deploy
```

### Risks

- Destructive SQL (DROP COLUMN, TRUNCATE) runs without review
- No backup before migration — a failed migration leaves the DB in a partial state
- No rollback strategy — Prisma does not support down migrations

## 2. Solution

A single build-time script (`prisma/safe-migrate.ts`) that wraps `prisma migrate deploy`
with two safety layers:

1. **SQL review gate** — scans pending migrations for dangerous patterns, blocks the
   build unless a human has explicitly approved them
2. **Neon branch backup** — creates a point-in-time database snapshot before applying
   migrations, enabling instant restore if something goes wrong

## 3. Dangerous SQL Detection

The script reads each pending migration's `.sql` file and scans for these patterns:

| Pattern                          | Risk                          |
| :------------------------------- | :---------------------------- |
| `DROP TABLE`                     | Entire table data loss        |
| `DROP COLUMN`                    | Column data loss              |
| `ALTER COLUMN ... TYPE`          | Type cast failures            |
| `SET NOT NULL` (without DEFAULT) | Fails on existing NULL values |
| `DROP INDEX` / `DROP CONSTRAINT` | Performance / integrity       |
| `TRUNCATE`                       | Full table data loss          |
| `DELETE FROM`                    | Partial data loss             |
| `ALTER TYPE ... RENAME VALUE`    | Breaks existing enum rows     |

When dangerous SQL is found and not approved, the build fails with a clear message:

```
BLOCKED: Migration "20260321_add_venue" contains dangerous SQL:
  Line 3: ALTER TABLE "Event" DROP COLUMN "location"

To approve after review, add to prisma/migrations/reviewed.json:
  { "20260321_add_venue": "DROP COLUMN location — intentional, data migrated in 20260320" }
```

## 4. Review Allowlist

File: `prisma/migrations/reviewed.json`

```json
{
  "20260321_add_venue": "DROP COLUMN location — intentional rename, data migrated in previous migration"
}
```

- **Key**: migration folder name (timestamp + name)
- **Value**: human-written justification explaining why the destructive SQL is safe
- Justification is required — forces the reviewer to articulate intent
- Git blame provides full audit trail (who approved, when, in which PR)

Approval flow:

1. Developer pushes code with a destructive migration
2. Vercel build fails with the BLOCKED message
3. Developer reviews the SQL, confirms it's intentional
4. Developer adds the migration to `reviewed.json` with justification, commits, pushes
5. Next build passes the review gate and proceeds

## 5. Neon Branch Backup

Before running `prisma migrate deploy`, the script creates a Neon branch as a
copy-on-write snapshot of the production database.

### Flow

1. **Create branch** via Neon API: `pre-migrate-{YYYYMMDD-HHmmss}`
2. **Run** `prisma migrate deploy`
3. **On success**: clean up old branches, keep the 3 most recent `pre-migrate-*` branches
4. **On failure**: branch exists as restore point — restore via Neon dashboard or API

### Storage cost

Neon branches use copy-on-write — no data duplication at creation time. Only divergent
writes after the branch point consume additional storage. Since branches are cleaned up
after successful deploys, the cost is negligible.

### Required environment variables (Vercel)

| Variable          | Value                      | Purpose                    |
| :---------------- | :------------------------- | :------------------------- |
| `NEON_API_KEY`    | Neon API key               | Branch create/delete/list  |
| `NEON_PROJECT_ID` | `fragrant-breeze-16357723` | Target Neon project        |
| `NEON_BRANCH_ID`  | `br-lucky-hill-aiyp9z7z`   | Production branch (parent) |

## 6. Script Execution Flow

```
prisma/safe-migrate.ts
  │
  ├─ Check for pending migrations (prisma migrate status)
  │   └─ No pending migrations → exit 0 (skip)
  │
  ├─ Read each pending migration's .sql file
  │   └─ Scan for dangerous patterns
  │       └─ Found + not in reviewed.json → exit 1 (BLOCK build)
  │
  ├─ Create Neon branch (pre-migrate-{timestamp})
  │   └─ API failure → exit 1 (refuse to migrate without backup)
  │
  ├─ Run: npx prisma migrate deploy
  │   ├─ Success → delete old pre-migrate branches (keep last 3)
  │   └─ Failure → exit 1 (branch preserved as restore point)
  │
  └─ exit 0
```

## 7. Vercel Integration

### Build command change

**From:**

```bash
if [ "$VERCEL_ENV" = "production" ]; then npx prisma migrate deploy; fi && npm run build
```

**To:**

```bash
if [ "$VERCEL_ENV" = "production" ]; then npx tsx prisma/safe-migrate.ts; fi && npm run build
```

Preview and development deploys are unaffected.

## 8. New Files

| File                              | Purpose                                          |
| :-------------------------------- | :----------------------------------------------- |
| `prisma/safe-migrate.ts`          | Guardrail script (SQL review + backup + migrate) |
| `prisma/migrations/reviewed.json` | Allowlist for approved dangerous migrations      |

## 9. Non-Goals

- **Down migrations**: Prisma doesn't support them. The Neon branch is the rollback.
- **Preview environment databases**: Out of scope. Only production deploys are guarded.
- **Manual promote workflow**: Not needed at current project scale (see design discussion).
- **CI-based approval gates**: Vercel builds can't pause for approval. The file-based
  allowlist achieves the same outcome through git workflow.
