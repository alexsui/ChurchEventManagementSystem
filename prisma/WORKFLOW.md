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

## Deployment Flow (Staging/Production)

1. Deploy code that includes the new migration files.
2. Run migration in deployment pipeline/server environment:

```bash
npx prisma migrate deploy
```

## Important Safety Rules

- Do not run `prisma db seed` on production unless explicitly intended.
- Prefer running `prisma migrate deploy` in CI/deployment, not from a local machine pointed at production.
- Runtime app should use `DATABASE_URL`; migration job should provide `DIRECT_URL`.

## Script Guardrails in This Repo

1. `prisma/seed.ts` blocks non-local seeding unless:

```bash
ALLOW_NON_LOCAL_SEED=true
```

2. `prisma/init-production.ts` requires explicit confirmation flags:

```bash
ALLOW_PROD_INIT=true
PROD_INIT_CONFIRM=INIT_PRODUCTION_ADMINS
```

3. Local testing of `init-production.ts` additionally requires:

```bash
ALLOW_LOCAL_PROD_INIT=true
```
