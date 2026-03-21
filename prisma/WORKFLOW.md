# Prisma Schema + Migration Workflow

This project uses two connection URLs:

- `DATABASE_URL`: runtime app queries (pooled connection, e.g. Neon pooler)
- `DIRECT_URL`: Prisma CLI migration/introspection commands (direct connection)

`prisma.config.ts` is configured to prefer `DIRECT_URL` and fall back to `DATABASE_URL`.

## Local Development Flow

1. Update `prisma/schema.prisma`.
2. Create/apply a local migration:

```bash
npx prisma migrate dev --name <change_name>
```

3. Seed local data only when needed:

```bash
npx prisma db seed
```

4. Run local app/tests.
5. Commit `prisma/schema.prisma`.
6. Commit `prisma/migrations/*`.

## Deployment Flow (Production)

Production migrations run automatically during Vercel's build via `prisma/safe-migrate.ts`,
which wraps `prisma migrate deploy` with two safety layers:

1. **SQL review gate** — scans pending migrations for dangerous patterns (DROP TABLE/COLUMN,
   TRUNCATE, type changes, etc.) and blocks the build unless the migration is approved in
   `prisma/migrations/reviewed.json`.
2. **Neon branch backup** — creates a point-in-time database branch before applying
   migrations, enabling instant restore if something goes wrong.

Vercel build command:

```bash
if [ "$VERCEL_ENV" = "production" ]; then npx tsx prisma/safe-migrate.ts; fi && npm run build
```

Preview and development deploys skip migrations entirely.

### If a migration is blocked

When `safe-migrate.ts` detects dangerous SQL, the Vercel build fails with a message like:

```
BLOCKED: Migration "20260321_add_venue" contains dangerous SQL:
  Line 3: ALTER TABLE "Event" DROP COLUMN "location" [DROP COLUMN]

To approve after review, add to prisma/migrations/reviewed.json:
  { "20260321_add_venue": "<your justification>" }
```

To unblock: review the SQL, add the migration name and justification to
`prisma/migrations/reviewed.json`, commit, and push. The next build will proceed.

### Local verification

Run the SQL review check locally without a database connection:

```bash
npx tsx prisma/safe-migrate.ts --check-only
```

### Neon branch backup details

- Backup branches are named `pre-migrate-{YYYYMMDD-HHmmss}`
- The 3 most recent are kept; older ones are auto-deleted
- If a migration fails, the backup branch is preserved for restore via Neon dashboard
- Requires `NEON_API_KEY`, `NEON_PROJECT_ID`, and `NEON_BRANCH_ID` env vars (set in Vercel, Production only)

### Infrastructure

| Service           | Details                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| Hosting           | Vercel (Next.js preset, auto-deploy on push to main)                           |
| Database          | Neon PostgreSQL 17, project `fragrant-breeze-16357723`, region `aws-us-east-1` |
| Production branch | `production` (`br-lucky-hill-aiyp9z7z`)                                        |
| Pooled URL        | `DATABASE_URL` (with `-pooler` in hostname, for app queries)                   |
| Direct URL        | `DIRECT_URL` (without `-pooler`, for migrations)                               |

## Important Safety Rules

- Do not run `prisma db seed` on production unless explicitly intended.
- Do not run `prisma migrate deploy` manually against production — let `safe-migrate.ts` handle it via the Vercel build.
- Always review the generated `.sql` file before committing a migration with destructive changes.
- Runtime app should use `DATABASE_URL`; migration job should provide `DIRECT_URL`.

## Script Guardrails in This Repo

1. `prisma/safe-migrate.ts` blocks destructive migrations unless approved in `reviewed.json`
   and creates a Neon branch backup before applying. See design doc:
   `docs/design-docs/features/migration-guardrails.md`.

2. `prisma/seed.ts` blocks non-local seeding unless:

```bash
ALLOW_NON_LOCAL_SEED=true
```

3. `prisma/init-production.ts` requires explicit confirmation flags:

```bash
ALLOW_PROD_INIT=true
PROD_INIT_CONFIRM=INIT_PRODUCTION_ADMINS
```

4. Local testing of `init-production.ts` additionally requires:

```bash
ALLOW_LOCAL_PROD_INIT=true
```
