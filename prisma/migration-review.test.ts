import { describe, it, expect } from "vitest";
import { scanSqlForDangers, checkReviewedAllowlist } from "./migration-review";

describe("scanSqlForDangers", () => {
  it("detects DROP TABLE", () => {
    const sql = 'DROP TABLE "User";';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP TABLE");
    expect(dangers[0].line).toBe(1);
  });

  it("detects DROP COLUMN", () => {
    const sql = 'ALTER TABLE "Event" DROP COLUMN "location";';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP COLUMN");
  });

  it("detects ALTER COLUMN TYPE change", () => {
    const sql = 'ALTER TABLE "Event" ALTER COLUMN "name" TYPE varchar(100);';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("ALTER COLUMN TYPE");
  });

  it("detects SET NOT NULL without DEFAULT", () => {
    const sql = 'ALTER TABLE "Event" ALTER COLUMN "title" SET NOT NULL;';
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("SET NOT NULL");
  });

  it("allows SET NOT NULL when DEFAULT is present in same migration", () => {
    const sql = [
      'ALTER TABLE "Event" ALTER COLUMN "title" SET DEFAULT \'untitled\';',
      'ALTER TABLE "Event" ALTER COLUMN "title" SET NOT NULL;',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(0);
  });

  it("detects TRUNCATE", () => {
    const dangers = scanSqlForDangers('TRUNCATE TABLE "Event";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("TRUNCATE");
  });

  it("detects DELETE FROM", () => {
    const dangers = scanSqlForDangers('DELETE FROM "Event";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DELETE FROM");
  });

  it("detects DROP INDEX", () => {
    const dangers = scanSqlForDangers('DROP INDEX "Event_title_key";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP INDEX");
  });

  it("detects DROP CONSTRAINT", () => {
    const dangers = scanSqlForDangers('ALTER TABLE "Event" DROP CONSTRAINT "Event_pkey";');
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("DROP CONSTRAINT");
  });

  it("detects ALTER TYPE RENAME VALUE", () => {
    const dangers = scanSqlForDangers("ALTER TYPE \"Role\" RENAME VALUE 'MEMBER' TO 'USER';");
    expect(dangers).toHaveLength(1);
    expect(dangers[0].pattern).toBe("ALTER TYPE RENAME VALUE");
  });

  it("ignores safe SQL", () => {
    const sql = [
      'CREATE TABLE "NewTable" ("id" TEXT NOT NULL);',
      'ALTER TABLE "Event" ADD COLUMN "venue" TEXT;',
      'CREATE INDEX "Event_title_idx" ON "Event"("title");',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(0);
  });

  it("ignores dangerous keywords in SQL comments", () => {
    const sql = [
      "-- DROP TABLE cleanup (this is just a comment)",
      "/*",
      "  Warnings:",
      "  - You are about to drop the column registrationMode",
      "*/",
      'ALTER TABLE "Event" ADD COLUMN "venue" TEXT;',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(0);
  });

  it("reports correct line numbers", () => {
    const sql = [
      "-- AlterTable",
      'ALTER TABLE "Event" ADD COLUMN "venue" TEXT;',
      "",
      "-- DropColumn",
      'ALTER TABLE "Event" DROP COLUMN "location";',
    ].join("\n");
    const dangers = scanSqlForDangers(sql);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].line).toBe(5);
  });
});

describe("checkReviewedAllowlist", () => {
  it("returns approved with justification when migration is in allowlist", () => {
    const reviewed = { "20260321_add_venue": "intentional rename" };
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({
      approved: true,
      justification: "intentional rename",
    });
  });

  it("returns not approved when migration is not in allowlist", () => {
    const reviewed = {};
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({ approved: false });
  });

  it("rejects empty justification", () => {
    const reviewed = { "20260321_add_venue": "" };
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({ approved: false });
  });

  it("rejects whitespace-only justification", () => {
    const reviewed = { "20260321_add_venue": "   " };
    const result = checkReviewedAllowlist("20260321_add_venue", reviewed);
    expect(result).toEqual({ approved: false });
  });
});
