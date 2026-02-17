import { prisma } from "@/lib/prisma";

type Module =
  | "events"
  | "registrations"
  | "attendance"
  | "assignments"
  | "users"
  | "teams"
  | "budget"
  | "reports";

type Action = "read" | "write";

// In-memory cache: role -> { permissions map, expiry timestamp }
const cache = new Map<
  string,
  { permissions: Map<string, boolean>; expiresAt: number }
>();

const CACHE_TTL_MS = 60_000; // 60 seconds

function cacheKey(module: string, action: string): string {
  return `${module}:${action}`;
}

/**
 * Load permissions for a role from DB, with in-memory caching.
 */
async function getPermissionsForRole(
  role: string
): Promise<Map<string, boolean>> {
  const now = Date.now();
  const cached = cache.get(role);
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  const rows = await prisma.rolePermission.findMany({
    where: { role: role as any },
  });

  const permissions = new Map<string, boolean>();
  for (const row of rows) {
    permissions.set(cacheKey(row.module, row.action), row.allowed);
  }

  cache.set(role, { permissions, expiresAt: now + CACHE_TTL_MS });
  return permissions;
}

/**
 * Check if a role has permission for a module/action.
 * ADMIN always has full access (not stored in DB).
 */
export async function hasPermission(
  role: string,
  module: Module,
  action: Action
): Promise<boolean> {
  if (role === "ADMIN") return true;

  const permissions = await getPermissionsForRole(role);
  return permissions.get(cacheKey(module, action)) ?? false;
}

/**
 * Invalidate the in-memory permission cache.
 * Call after updating permissions via API.
 */
export function invalidatePermissionCache(): void {
  cache.clear();
}

/**
 * Assert that the current user is active.
 * Call after auth check in API routes that perform write operations.
 * Returns a 403 NextResponse if inactive, or null if active.
 */
export function assertActive(user: {
  isActive?: boolean;
}): Response | null {
  if (user.isActive === false) {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }
  return null;
}

export type { Module, Action };
