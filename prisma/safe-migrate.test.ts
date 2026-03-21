import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as neonBranch from "./neon-branch";
import { safeMigrate } from "./safe-migrate";

vi.mock("child_process");
vi.mock("fs");
vi.mock("./neon-branch");

const NEON_ENV = {
  NEON_API_KEY: "test-key",
  NEON_PROJECT_ID: "test-project",
  NEON_BRANCH_ID: "br-main-123",
};

beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries(NEON_ENV)) {
    vi.stubEnv(key, value);
  }
});

describe("safeMigrate", () => {
  it("exits successfully when no pending migrations", async () => {
    vi.mocked(childProcess.execSync).mockReturnValueOnce(
      Buffer.from("Database schema is up to date - no pending migrations.")
    );

    await safeMigrate();

    expect(neonBranch.createBranch).not.toHaveBeenCalled();
    expect(childProcess.execSync).toHaveBeenCalledTimes(1);
  });

  it("proceeds with safe migrations", async () => {
    vi.mocked(childProcess.execSync)
      .mockReturnValueOnce(
        Buffer.from("Following migration have not yet been applied:\n20260322000000_add_venue\n")
      )
      .mockReturnValueOnce(Buffer.from("All migrations applied."));

    vi.mocked(fs.readdirSync).mockReturnValueOnce([
      "20260322000000_add_venue",
    ] as unknown as fs.Dirent[]);

    // readFileSync order: reviewed.json first, then migration SQL
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}") // reviewed.json
      .mockReturnValueOnce('ALTER TABLE "Event" ADD COLUMN "venue" TEXT;');

    vi.mocked(neonBranch.createBranch).mockResolvedValueOnce({
      id: "br-backup",
      name: "pre-migrate-20260322",
    });

    vi.mocked(neonBranch.listBranches).mockResolvedValueOnce([
      {
        id: "br-backup",
        name: "pre-migrate-20260322",
        created_at: "2026-03-22T00:00:00Z",
      },
    ]);

    await safeMigrate();

    expect(neonBranch.createBranch).toHaveBeenCalledTimes(1);
    expect(childProcess.execSync).toHaveBeenCalledTimes(2);
  });

  it("blocks dangerous migrations not in reviewed.json", async () => {
    vi.mocked(childProcess.execSync).mockReturnValueOnce(
      Buffer.from("Following migration have not yet been applied:\n20260322000000_drop_col\n")
    );

    vi.mocked(fs.readdirSync).mockReturnValueOnce([
      "20260322000000_drop_col",
    ] as unknown as fs.Dirent[]);

    // reviewed.json first (empty), then dangerous SQL
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}") // reviewed.json — not approved
      .mockReturnValueOnce('ALTER TABLE "Event" DROP COLUMN "location";');

    await expect(safeMigrate()).rejects.toThrow("BLOCKED");
    expect(neonBranch.createBranch).not.toHaveBeenCalled();
  });

  it("allows dangerous migrations that are in reviewed.json", async () => {
    vi.mocked(childProcess.execSync)
      .mockReturnValueOnce(
        Buffer.from("Following migration have not yet been applied:\n20260322000000_drop_col\n")
      )
      .mockReturnValueOnce(Buffer.from("All migrations applied."));

    vi.mocked(fs.readdirSync).mockReturnValueOnce([
      "20260322000000_drop_col",
    ] as unknown as fs.Dirent[]);

    // reviewed.json first (with approval), then dangerous SQL
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(
        JSON.stringify({
          "20260322000000_drop_col": "intentional — data migrated",
        })
      )
      .mockReturnValueOnce('ALTER TABLE "Event" DROP COLUMN "location";');

    vi.mocked(neonBranch.createBranch).mockResolvedValueOnce({
      id: "br-backup",
      name: "pre-migrate-20260322",
    });
    vi.mocked(neonBranch.listBranches).mockResolvedValueOnce([]);

    await safeMigrate();

    expect(neonBranch.createBranch).toHaveBeenCalledTimes(1);
    expect(childProcess.execSync).toHaveBeenCalledTimes(2);
  });

  it("throws when Neon branch creation fails", async () => {
    vi.mocked(childProcess.execSync).mockReturnValueOnce(
      Buffer.from("Following migration have not yet been applied:\n20260322000000_safe\n")
    );

    vi.mocked(fs.readdirSync).mockReturnValueOnce([
      "20260322000000_safe",
    ] as unknown as fs.Dirent[]);

    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}") // reviewed.json
      .mockReturnValueOnce('ALTER TABLE "Event" ADD COLUMN "venue" TEXT;');

    vi.mocked(neonBranch.createBranch).mockRejectedValueOnce(
      new Error("Neon API createBranch failed: quota exceeded")
    );

    await expect(safeMigrate()).rejects.toThrow("quota exceeded");
    expect(childProcess.execSync).toHaveBeenCalledTimes(1);
  });

  it("throws when prisma migrate deploy fails, preserving backup branch", async () => {
    vi.mocked(childProcess.execSync)
      .mockReturnValueOnce(
        Buffer.from("Following migration have not yet been applied:\n20260322000000_safe\n")
      )
      .mockImplementationOnce(() => {
        throw new Error("Migration failed: column does not exist");
      });

    vi.mocked(fs.readdirSync).mockReturnValueOnce([
      "20260322000000_safe",
    ] as unknown as fs.Dirent[]);

    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}") // reviewed.json
      .mockReturnValueOnce('ALTER TABLE "Event" ADD COLUMN "venue" TEXT;');

    vi.mocked(neonBranch.createBranch).mockResolvedValueOnce({
      id: "br-backup",
      name: "pre-migrate-20260322",
    });

    await expect(safeMigrate()).rejects.toThrow("Migration failed");
    // Should NOT clean up branches (backup preserved)
    expect(neonBranch.listBranches).not.toHaveBeenCalled();
  });

  it("cleans up old branches, keeping only the 3 most recent", async () => {
    vi.mocked(childProcess.execSync)
      .mockReturnValueOnce(
        Buffer.from("Following migration have not yet been applied:\n20260325000000_safe\n")
      )
      .mockReturnValueOnce(Buffer.from("All migrations applied."));

    vi.mocked(fs.readdirSync).mockReturnValueOnce([
      "20260325000000_safe",
    ] as unknown as fs.Dirent[]);

    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}") // reviewed.json
      .mockReturnValueOnce('ALTER TABLE "Event" ADD COLUMN "venue" TEXT;');

    vi.mocked(neonBranch.createBranch).mockResolvedValueOnce({
      id: "br-5",
      name: "pre-migrate-20260325",
    });

    vi.mocked(neonBranch.listBranches).mockResolvedValueOnce([
      {
        id: "br-1",
        name: "pre-migrate-20260320",
        created_at: "2026-03-20T00:00:00Z",
      },
      {
        id: "br-2",
        name: "pre-migrate-20260321",
        created_at: "2026-03-21T00:00:00Z",
      },
      {
        id: "br-3",
        name: "pre-migrate-20260322",
        created_at: "2026-03-22T00:00:00Z",
      },
      {
        id: "br-4",
        name: "pre-migrate-20260323",
        created_at: "2026-03-23T00:00:00Z",
      },
      {
        id: "br-5",
        name: "pre-migrate-20260325",
        created_at: "2026-03-25T00:00:00Z",
      },
    ]);

    vi.mocked(neonBranch.deleteBranch).mockResolvedValue(undefined);

    await safeMigrate();

    expect(neonBranch.deleteBranch).toHaveBeenCalledTimes(2);
    expect(neonBranch.deleteBranch).toHaveBeenCalledWith(expect.anything(), "br-1");
    expect(neonBranch.deleteBranch).toHaveBeenCalledWith(expect.anything(), "br-2");
  });
});
