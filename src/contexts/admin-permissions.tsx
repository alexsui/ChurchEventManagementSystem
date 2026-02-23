"use client";

import React, { createContext, useContext } from "react";

type RolePermissions = Record<string, { read: boolean; write: boolean }>;

interface AdminPermissionsContextValue {
  isAdmin: boolean;
  permissions: RolePermissions | null;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextValue | null>(null);

export function AdminPermissionsProvider({
  isAdmin,
  permissions,
  children,
}: {
  isAdmin: boolean;
  permissions: RolePermissions | null;
  children: React.ReactNode;
}) {
  return (
    <AdminPermissionsContext.Provider value={{ isAdmin, permissions }}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions(module: string): {
  canRead: boolean;
  canWrite: boolean;
} {
  const ctx = useContext(AdminPermissionsContext);

  // Context not yet available (e.g. during SSR or before provider mounts)
  if (!ctx) {
    return { canRead: false, canWrite: false };
  }

  if (ctx.isAdmin) {
    return { canRead: true, canWrite: true };
  }

  const perm = ctx.permissions?.[module];
  return {
    canRead: perm?.read ?? false,
    canWrite: perm?.write ?? false,
  };
}
