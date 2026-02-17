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

const ROLE_PERMISSIONS: Record<string, Partial<Record<Module, Action[]>>> = {
  ADMIN: {
    events: ["read", "write"],
    registrations: ["read", "write"],
    attendance: ["read", "write"],
    assignments: ["read", "write"],
    users: ["read", "write"],
    teams: ["read", "write"],
    budget: ["read", "write"],
    reports: ["read", "write"],
  },
  STAFF_ADMIN: {
    events: ["read", "write"],
    registrations: ["read", "write"],
    attendance: ["read", "write"],
    assignments: ["read"],
    users: ["read"],
    teams: ["read"],
    reports: ["read"],
  },
  STAFF_GENERAL: {
    events: ["read"],
    registrations: ["read"],
    budget: ["read", "write"],
    reports: ["read"],
  },
  STAFF_FINANCE: {
    events: ["read"],
    registrations: ["read"],
    budget: ["read", "write"],
    reports: ["read"],
  },
  PASTOR: {
    events: ["read"],
    registrations: ["read"],
    attendance: ["read"],
    assignments: ["read"],
    users: ["read"],
    teams: ["read"],
    reports: ["read"],
  },
  STAFF_MEDIA: {
    events: ["read"],
    teams: ["read"],
  },
  TEAM_LEADER: {
    events: ["read"],
    registrations: ["read"],
    attendance: ["read"],
    assignments: ["read"],
    teams: ["read"],
  },
  MEMBER: {
    events: ["read"],
    registrations: ["read"],
    attendance: ["read"],
    assignments: ["read"],
    users: ["read"],
  },
};

export function hasPermission(
  role: string,
  module: Module,
  action: Action
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  const moduleActions = permissions[module];
  if (!moduleActions) return false;
  return moduleActions.includes(action);
}

export { ROLE_PERMISSIONS };
export type { Module, Action };
