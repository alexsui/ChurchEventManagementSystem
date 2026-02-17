import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/authorization";

describe("hasPermission", () => {
  describe("ADMIN", () => {
    it("has full access to all modules", () => {
      expect(hasPermission("ADMIN", "events", "write")).toBe(true);
      expect(hasPermission("ADMIN", "users", "write")).toBe(true);
      expect(hasPermission("ADMIN", "budget", "write")).toBe(true);
      expect(hasPermission("ADMIN", "reports", "read")).toBe(true);
      expect(hasPermission("ADMIN", "teams", "write")).toBe(true);
      expect(hasPermission("ADMIN", "assignments", "write")).toBe(true);
    });
  });

  describe("STAFF_ADMIN", () => {
    it("can read/write events, registrations, attendance", () => {
      expect(hasPermission("STAFF_ADMIN", "events", "write")).toBe(true);
      expect(hasPermission("STAFF_ADMIN", "registrations", "write")).toBe(true);
      expect(hasPermission("STAFF_ADMIN", "attendance", "write")).toBe(true);
    });

    it("cannot access budget", () => {
      expect(hasPermission("STAFF_ADMIN", "budget", "read")).toBe(false);
      expect(hasPermission("STAFF_ADMIN", "budget", "write")).toBe(false);
    });

    it("can read but not write users", () => {
      expect(hasPermission("STAFF_ADMIN", "users", "read")).toBe(true);
      expect(hasPermission("STAFF_ADMIN", "users", "write")).toBe(false);
    });
  });

  describe("STAFF_GENERAL", () => {
    it("can read/write budget", () => {
      expect(hasPermission("STAFF_GENERAL", "budget", "read")).toBe(true);
      expect(hasPermission("STAFF_GENERAL", "budget", "write")).toBe(true);
    });

    it("can read events but not write", () => {
      expect(hasPermission("STAFF_GENERAL", "events", "read")).toBe(true);
      expect(hasPermission("STAFF_GENERAL", "events", "write")).toBe(false);
    });
  });

  describe("STAFF_FINANCE", () => {
    it("can read/write budget", () => {
      expect(hasPermission("STAFF_FINANCE", "budget", "read")).toBe(true);
      expect(hasPermission("STAFF_FINANCE", "budget", "write")).toBe(true);
    });

    it("cannot write events", () => {
      expect(hasPermission("STAFF_FINANCE", "events", "write")).toBe(false);
    });
  });

  describe("PASTOR", () => {
    it("has read access to most modules", () => {
      expect(hasPermission("PASTOR", "events", "read")).toBe(true);
      expect(hasPermission("PASTOR", "users", "read")).toBe(true);
      expect(hasPermission("PASTOR", "attendance", "read")).toBe(true);
      expect(hasPermission("PASTOR", "teams", "read")).toBe(true);
    });

    it("cannot access budget", () => {
      expect(hasPermission("PASTOR", "budget", "read")).toBe(false);
    });

    it("cannot write to any module", () => {
      expect(hasPermission("PASTOR", "events", "write")).toBe(false);
      expect(hasPermission("PASTOR", "users", "write")).toBe(false);
    });
  });

  describe("STAFF_MEDIA", () => {
    it("can read events and teams only", () => {
      expect(hasPermission("STAFF_MEDIA", "events", "read")).toBe(true);
      expect(hasPermission("STAFF_MEDIA", "teams", "read")).toBe(true);
    });

    it("cannot access other modules", () => {
      expect(hasPermission("STAFF_MEDIA", "budget", "read")).toBe(false);
      expect(hasPermission("STAFF_MEDIA", "users", "read")).toBe(false);
      expect(hasPermission("STAFF_MEDIA", "registrations", "read")).toBe(false);
    });
  });

  describe("TEAM_LEADER", () => {
    it("can read events, registrations, attendance, assignments, teams", () => {
      expect(hasPermission("TEAM_LEADER", "events", "read")).toBe(true);
      expect(hasPermission("TEAM_LEADER", "registrations", "read")).toBe(true);
      expect(hasPermission("TEAM_LEADER", "attendance", "read")).toBe(true);
      expect(hasPermission("TEAM_LEADER", "assignments", "read")).toBe(true);
      expect(hasPermission("TEAM_LEADER", "teams", "read")).toBe(true);
    });

    it("cannot write to any module", () => {
      expect(hasPermission("TEAM_LEADER", "events", "write")).toBe(false);
    });
  });

  describe("MEMBER", () => {
    it("can read events, registrations, attendance, assignments, users", () => {
      expect(hasPermission("MEMBER", "events", "read")).toBe(true);
      expect(hasPermission("MEMBER", "registrations", "read")).toBe(true);
      expect(hasPermission("MEMBER", "attendance", "read")).toBe(true);
      expect(hasPermission("MEMBER", "users", "read")).toBe(true);
    });

    it("cannot write to any module", () => {
      expect(hasPermission("MEMBER", "events", "write")).toBe(false);
      expect(hasPermission("MEMBER", "users", "write")).toBe(false);
    });

    it("cannot access budget", () => {
      expect(hasPermission("MEMBER", "budget", "read")).toBe(false);
    });
  });

  describe("unknown role", () => {
    it("returns false for unknown roles", () => {
      expect(hasPermission("UNKNOWN", "events", "read")).toBe(false);
    });
  });
});
