import "dotenv/config";

type DbTarget = {
  databaseUrl: string;
  host: string | null;
  isLocal: boolean;
};

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "postgres",
  "db",
  "host.docker.internal",
]);

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Refusing to run database script."
    );
  }
  return url;
}

function getHost(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPrivateIp(host: string): boolean {
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  if (LOCAL_HOSTS.has(host)) return true;
  if (host.endsWith(".local")) return true;
  if (isPrivateIp(host)) return true;
  return false;
}

export function resolveDbTarget(): DbTarget {
  const databaseUrl = getDatabaseUrl();
  const host = getHost(databaseUrl);
  return {
    databaseUrl,
    host,
    isLocal: isLocalHost(host),
  };
}

export function assertSafeForSeed(scriptName: string): DbTarget {
  const target = resolveDbTarget();
  if (target.isLocal) return target;

  if (process.env.ALLOW_NON_LOCAL_SEED === "true") {
    return target;
  }

  throw new Error(
    `[${scriptName}] Refusing to seed a non-local database host (${target.host ?? "unknown"}).\n` +
      "This is a safety guard against accidentally wiping staging/production.\n" +
      "If you really intend this, set ALLOW_NON_LOCAL_SEED=true explicitly."
  );
}

export function assertSafeForProductionInit(scriptName: string): DbTarget {
  const target = resolveDbTarget();

  if (target.isLocal && process.env.ALLOW_LOCAL_PROD_INIT !== "true") {
    throw new Error(
      `[${scriptName}] Refusing to run against local DB host (${target.host ?? "unknown"}).\n` +
        "This script is for production bootstrap. If you are testing locally,\n" +
        "set ALLOW_LOCAL_PROD_INIT=true explicitly."
    );
  }

  if (process.env.ALLOW_PROD_INIT !== "true") {
    throw new Error(
      `[${scriptName}] Missing ALLOW_PROD_INIT=true.\n` +
        "This explicit flag is required to prevent accidental execution."
    );
  }

  if (process.env.PROD_INIT_CONFIRM !== "INIT_PRODUCTION_ADMINS") {
    throw new Error(
      `[${scriptName}] Missing confirmation.\n` +
        "Set PROD_INIT_CONFIRM=INIT_PRODUCTION_ADMINS to continue."
    );
  }

  return target;
}
