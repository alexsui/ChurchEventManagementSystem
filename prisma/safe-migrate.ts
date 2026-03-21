import { execSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { scanSqlForDangers, checkReviewedAllowlist } from "./migration-review";
import { createBranch, listBranches, deleteBranch, type NeonConfig } from "./neon-branch";

const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");
const REVIEWED_JSON = path.join(MIGRATIONS_DIR, "reviewed.json");
const MAX_BACKUP_BRANCHES = 3;
const BRANCH_PREFIX = "pre-migrate-";

function getMigrateStatus(): string {
  try {
    return execSync("npx prisma migrate status", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error: unknown) {
    // prisma migrate status exits with code 1 when there are pending migrations
    // but still outputs the status text to stdout
    const err = error as { stdout?: string; stderr?: string };
    if (err.stdout) return err.stdout;
    throw error;
  }
}

function hasPendingMigrations(status: string): boolean {
  return !status.includes("Database schema is up to date");
}

function getPendingMigrationDirs(): string[] {
  const entries = readdirSync(MIGRATIONS_DIR, { encoding: "utf-8" });
  return entries.filter((entry) => /^\d{14}_/.test(entry)).sort();
}

function readMigrationSql(migrationName: string): string {
  const sqlPath = path.join(MIGRATIONS_DIR, migrationName, "migration.sql");
  return readFileSync(sqlPath, "utf-8");
}

function readReviewedJson(): Record<string, string> {
  try {
    const content = readFileSync(REVIEWED_JSON, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function getNeonConfig(): NeonConfig {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  const parentBranchId = process.env.NEON_BRANCH_ID;

  if (!apiKey || !projectId || !parentBranchId) {
    throw new Error(
      "Missing Neon environment variables. Required: NEON_API_KEY, NEON_PROJECT_ID, NEON_BRANCH_ID"
    );
  }

  return { apiKey, projectId, parentBranchId };
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

/**
 * Scan all migration SQL files for unreviewed dangers.
 * Does NOT require a database connection.
 * Useful for local verification and pre-commit checks.
 */
export function checkOnly(): void {
  console.log("📋 Scanning all migrations for unreviewed dangerous SQL...\n");

  const migrationDirs = getPendingMigrationDirs();
  const reviewed = readReviewedJson();
  const blocked: string[] = [];

  for (const migrationName of migrationDirs) {
    const sql = readMigrationSql(migrationName);
    const dangers = scanSqlForDangers(sql);

    if (dangers.length === 0) continue;

    const review = checkReviewedAllowlist(migrationName, reviewed);
    if (review.approved) {
      console.log(
        `⚠️  Migration "${migrationName}" has dangerous SQL but is approved: ${review.justification}`
      );
      continue;
    }

    const dangerLines = dangers
      .map((d) => `  Line ${d.line}: ${d.content.trim()} [${d.pattern}]`)
      .join("\n");

    blocked.push(
      `BLOCKED: Migration "${migrationName}" contains dangerous SQL:\n${dangerLines}\n\n` +
        `To approve after review, add to prisma/migrations/reviewed.json:\n` +
        `  { "${migrationName}": "<your justification>" }`
    );
  }

  if (blocked.length > 0) {
    throw new Error(`\n🚫 ${blocked.length} migration(s) blocked:\n\n${blocked.join("\n\n")}`);
  }

  console.log("✅ All migrations pass review checks.");
}

export async function safeMigrate(): Promise<void> {
  // Step 1: Check for pending migrations
  const status = getMigrateStatus();
  if (!hasPendingMigrations(status)) {
    console.log("✅ No pending migrations. Skipping.");
    return;
  }

  console.log("📋 Pending migrations detected. Running safety checks...\n");

  // Step 2: Scan migration SQL for dangerous patterns
  const migrationDirs = getPendingMigrationDirs();
  const reviewed = readReviewedJson();
  const blocked: string[] = [];

  for (const migrationName of migrationDirs) {
    const sql = readMigrationSql(migrationName);
    const dangers = scanSqlForDangers(sql);

    if (dangers.length === 0) continue;

    const review = checkReviewedAllowlist(migrationName, reviewed);
    if (review.approved) {
      console.log(
        `⚠️  Migration "${migrationName}" has dangerous SQL but is approved: ${review.justification}`
      );
      continue;
    }

    const dangerLines = dangers
      .map((d) => `  Line ${d.line}: ${d.content.trim()} [${d.pattern}]`)
      .join("\n");

    blocked.push(
      `BLOCKED: Migration "${migrationName}" contains dangerous SQL:\n${dangerLines}\n\n` +
        `To approve after review, add to prisma/migrations/reviewed.json:\n` +
        `  { "${migrationName}": "<your justification>" }`
    );
  }

  if (blocked.length > 0) {
    throw new Error(`\n🚫 ${blocked.length} migration(s) blocked:\n\n${blocked.join("\n\n")}`);
  }

  // Step 3: Create Neon branch backup
  const neonConfig = getNeonConfig();
  const branchName = `${BRANCH_PREFIX}${formatTimestamp()}`;

  console.log(`📸 Creating Neon branch backup: ${branchName}`);
  const branch = await createBranch(neonConfig, branchName);
  console.log(`✅ Backup branch created: ${branch.id} (${branch.name})\n`);

  // Step 4: Run prisma migrate deploy
  console.log("🚀 Running prisma migrate deploy...");
  try {
    execSync("npx prisma migrate deploy", {
      encoding: "utf-8",
      stdio: "inherit",
    });
  } catch (error) {
    console.error(
      `\n❌ Migration failed! Backup branch "${branch.name}" (${branch.id}) is preserved for restore.`
    );
    console.error(
      "   Restore via Neon dashboard or: neon branches reset <production-branch> --parent " +
        branch.id
    );
    throw error;
  }

  console.log("\n✅ Migrations applied successfully.");

  // Step 5: Clean up old backup branches
  console.log("🧹 Cleaning up old backup branches...");
  try {
    const branches = await listBranches(neonConfig, BRANCH_PREFIX);
    const sorted = branches.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const toDelete = sorted.slice(MAX_BACKUP_BRANCHES);

    for (const old of toDelete) {
      console.log(`  Deleting: ${old.name} (${old.id})`);
      await deleteBranch(neonConfig, old.id);
    }

    console.log(`✅ Kept ${Math.min(sorted.length, MAX_BACKUP_BRANCHES)} backup branch(es).`);
  } catch (error) {
    // Cleanup failure is non-fatal
    console.warn("⚠️  Branch cleanup failed (non-fatal):", error);
  }
}

// Direct execution
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("safe-migrate.ts") || process.argv[1].endsWith("safe-migrate.js"));

if (isDirectRun) {
  const isCheckOnly = process.argv.includes("--check-only");

  if (isCheckOnly) {
    try {
      checkOnly();
      process.exit(0);
    } catch (error) {
      console.error((error as Error).message ?? error);
      process.exit(1);
    }
  } else {
    safeMigrate()
      .then(() => {
        console.log("\n🎉 Safe migration complete.");
        process.exit(0);
      })
      .catch((error) => {
        console.error(error.message ?? error);
        process.exit(1);
      });
  }
}
