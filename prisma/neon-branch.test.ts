import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBranch, listBranches, deleteBranch, type NeonConfig } from "./neon-branch";

const config: NeonConfig = {
  apiKey: "test-api-key",
  projectId: "test-project",
  parentBranchId: "br-main-123",
};

describe("createBranch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a branch and returns its info", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          branch: { id: "br-new-456", name: "pre-migrate-20260321" },
        }),
        { status: 201 }
      )
    );

    const result = await createBranch(config, "pre-migrate-20260321");
    expect(result).toEqual({
      id: "br-new-456",
      name: "pre-migrate-20260321",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://console.neon.tech/api/v2/projects/test-project/branches",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      })
    );
  });

  it("throws on API error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "quota exceeded" }), {
        status: 422,
      })
    );

    await expect(createBranch(config, "test")).rejects.toThrow("quota exceeded");
  });
});

describe("listBranches", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists branches filtered by prefix", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          branches: [
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
              id: "br-main",
              name: "production",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await listBranches(config, "pre-migrate-");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("pre-migrate-20260320");
    expect(result[1].name).toBe("pre-migrate-20260321");
  });
});

describe("deleteBranch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a branch", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteBranch(config, "br-old-123")).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      "https://console.neon.tech/api/v2/projects/test-project/branches/br-old-123",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("does not throw on 404 (branch already deleted)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "not found" }), { status: 404 })
    );

    await expect(deleteBranch(config, "br-gone")).resolves.toBeUndefined();
  });
});
