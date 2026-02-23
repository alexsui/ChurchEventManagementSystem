"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAdminPermissions } from "@/contexts/admin-permissions";
import { roleLabels, moduleLabels } from "@/lib/constants";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLES = Object.entries(roleLabels)
  .filter(([key]) => key !== "ADMIN")
  .map(([value, label]) => ({ value, label }));

const MODULES = Object.entries(moduleLabels).map(([value, label]) => ({ value, label }));

type PermissionMatrix = Record<string, Record<string, { read: boolean; write: boolean }>>;

export default function RolesPermissionPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canWrite } = useAdminPermissions("users");
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canWrite) {
      router.replace("/admin/users");
      return;
    }
    fetch("/api/role-permissions")
      .then((res) => {
        if (!res.ok) throw new Error("無法載入權限設定");
        return res.json();
      })
      .then(setMatrix)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [canWrite, router]);

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">無權限存取此頁面</p>
      </div>
    );
  }

  if (!canWrite) {
    return null;
  }

  function toggle(role: string, module: string, action: "read" | "write") {
    setMatrix((prev) => {
      const next = structuredClone(prev);
      if (!next[role]) next[role] = {};
      if (!next[role][module]) next[role][module] = { read: false, write: false };

      if (action === "write") {
        const newVal = !next[role][module].write;
        next[role][module].write = newVal;
        // write implies read
        if (newVal) next[role][module].read = true;
      } else {
        const newVal = !next[role][module].read;
        next[role][module].read = newVal;
        // unchecking read also unchecks write
        if (!newVal) next[role][module].write = false;
      }

      return next;
    });
  }

  function getPermission(role: string, module: string, action: "read" | "write"): boolean {
    return matrix[role]?.[module]?.[action] ?? false;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matrix),
      });
      if (!res.ok) throw new Error("儲存失敗");
      toast.success("權限設定已儲存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/users")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">角色權限設定</h1>
          <p className="text-sm text-muted-foreground">
            設定各角色對系統模組的存取權限（統籌者永遠擁有所有權限）
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>權限矩陣</CardTitle>
          <CardDescription>R = 讀取，W = 寫入。勾選寫入會自動勾選讀取。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-30 min-w-[120px]">角色</TableHead>
                  {MODULES.map((m) => (
                    <TableHead key={m.value} className="text-center min-w-[100px]">
                      {m.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLES.map((role) => (
                  <TableRow key={role.value}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      {role.label}
                    </TableCell>
                    {MODULES.map((mod) => (
                      <TableCell key={mod.value} className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <label className="flex items-center gap-1 text-xs">
                            <Checkbox
                              checked={getPermission(role.value, mod.value, "read")}
                              onCheckedChange={() => toggle(role.value, mod.value, "read")}
                            />
                            R
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <Checkbox
                              checked={getPermission(role.value, mod.value, "write")}
                              onCheckedChange={() => toggle(role.value, mod.value, "write")}
                            />
                            W
                          </label>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存設定"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
