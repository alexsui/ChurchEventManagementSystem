export type NeonConfig = {
  apiKey: string;
  projectId: string;
  parentBranchId: string;
};

const NEON_API_BASE = "https://console.neon.tech/api/v2";

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function assertOk(res: Response, action: string): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new Error(`Neon API ${action} failed: ${msg}`);
  }
}

export async function createBranch(
  config: NeonConfig,
  name: string
): Promise<{ id: string; name: string }> {
  const res = await fetch(`${NEON_API_BASE}/projects/${config.projectId}/branches`, {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({
      endpoints: [{ type: "read_only" }],
      branch: { parent_id: config.parentBranchId, name },
    }),
  });

  await assertOk(res, "createBranch");
  const data = (await res.json()) as {
    branch: { id: string; name: string };
  };
  return { id: data.branch.id, name: data.branch.name };
}

export async function listBranches(
  config: NeonConfig,
  prefix: string
): Promise<Array<{ id: string; name: string; created_at: string }>> {
  const res = await fetch(`${NEON_API_BASE}/projects/${config.projectId}/branches`, {
    method: "GET",
    headers: headers(config.apiKey),
  });

  await assertOk(res, "listBranches");
  const data = (await res.json()) as {
    branches: Array<{ id: string; name: string; created_at: string }>;
  };
  return data.branches.filter((b) => b.name.startsWith(prefix));
}

export async function deleteBranch(config: NeonConfig, branchId: string): Promise<void> {
  const res = await fetch(`${NEON_API_BASE}/projects/${config.projectId}/branches/${branchId}`, {
    method: "DELETE",
    headers: headers(config.apiKey),
  });

  // 404 = already deleted, treat as success
  if (res.status === 404) return;
  await assertOk(res, "deleteBranch");
}
