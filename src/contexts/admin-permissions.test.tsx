// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import {
  AdminPermissionsProvider,
  useAdminPermissions,
} from "./admin-permissions";

describe("useAdminPermissions", () => {
  it("returns canRead:false, canWrite:false when no provider is present", () => {
    const { result } = renderHook(() => useAdminPermissions("events"));
    expect(result.current).toEqual({ canRead: false, canWrite: false });
  });

  it("returns canRead:true, canWrite:true for admin users", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminPermissionsProvider isAdmin={true} permissions={null}>
        {children}
      </AdminPermissionsProvider>
    );

    const { result } = renderHook(() => useAdminPermissions("events"), {
      wrapper,
    });
    expect(result.current).toEqual({ canRead: true, canWrite: true });
  });

  it("returns canRead:true, canWrite:false for read-only permission", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminPermissionsProvider
        isAdmin={false}
        permissions={{ events: { read: true, write: false } }}
      >
        {children}
      </AdminPermissionsProvider>
    );

    const { result } = renderHook(() => useAdminPermissions("events"), {
      wrapper,
    });
    expect(result.current).toEqual({ canRead: true, canWrite: false });
  });

  it("returns canRead:true, canWrite:true for read+write permission", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminPermissionsProvider
        isAdmin={false}
        permissions={{ events: { read: true, write: true } }}
      >
        {children}
      </AdminPermissionsProvider>
    );

    const { result } = renderHook(() => useAdminPermissions("events"), {
      wrapper,
    });
    expect(result.current).toEqual({ canRead: true, canWrite: true });
  });

  it("returns canRead:false, canWrite:false for a module with no permission entry", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminPermissionsProvider
        isAdmin={false}
        permissions={{ events: { read: true, write: false } }}
      >
        {children}
      </AdminPermissionsProvider>
    );

    const { result } = renderHook(() => useAdminPermissions("users"), {
      wrapper,
    });
    expect(result.current).toEqual({ canRead: false, canWrite: false });
  });

  it("returns canRead:false, canWrite:false for non-admin with null permissions", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminPermissionsProvider isAdmin={false} permissions={null}>
        {children}
      </AdminPermissionsProvider>
    );

    const { result } = renderHook(() => useAdminPermissions("events"), {
      wrapper,
    });
    expect(result.current).toEqual({ canRead: false, canWrite: false });
  });
});
