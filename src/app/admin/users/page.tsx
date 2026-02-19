"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Users, Search, Shield } from "lucide-react";
import { roleLabels, allRoles, providerLabels } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/contexts/admin-permissions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserAccount {
  provider: string;
}

interface UserItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  image: string | null;
  hasPassword?: boolean;
  accounts?: UserAccount[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "ADMIN":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    case "STAFF_ADMIN":
    case "STAFF_GENERAL":
    case "STAFF_FINANCE":
    case "STAFF_MEDIA":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "PASTOR":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    case "TEAM_LEADER":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getProviderDisplay(
  accounts?: UserAccount[],
  hasPassword?: boolean
): string {
  const methods: string[] = [];
  if (accounts && accounts.length > 0) {
    methods.push(
      ...accounts.map((a) => providerLabels[a.provider] ?? a.provider)
    );
  }
  if (hasPassword) {
    methods.push(providerLabels.credentials);
  }
  return methods.length > 0 ? methods.join(", ") : "-";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canWrite } = useAdminPermissions("users");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Edit dialog state
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---------- Fetch users ----------

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/users");
      if (!res.ok) {
        throw new Error("無法取得使用者列表");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ---------- Client-side filtering ----------

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter !== "ALL") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }
    return result;
  }, [users, searchQuery, roleFilter]);

  // ---------- Open edit dialog ----------

  function handleRowClick(user: UserItem) {
    setEditingUser(user);
    setEditRole(user.role);
    setEditIsActive(user.isActive);
  }

  function handleDialogClose() {
    setEditingUser(null);
  }

  // ---------- Save changes ----------

  async function handleSave() {
    if (!editingUser) return;

    const roleChanged = editRole !== editingUser.role;
    const activeChanged = editIsActive !== editingUser.isActive;

    if (!roleChanged && !activeChanged) {
      toast.info("沒有變更");
      return;
    }

    setSaving(true);

    try {
      // Update role if changed
      if (roleChanged) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: editRole }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "更新角色失敗");
        }
      }

      // Toggle active if changed
      if (activeChanged) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggleActive" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "更新狀態失敗");
        }
      }

      toast.success(
        `已更新 ${editingUser.name ?? editingUser.email ?? "使用者"} 的資料`
      );
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="size-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">使用者管理</h1>
            <p className="text-muted-foreground text-sm">
              管理所有使用者帳號與角色
            </p>
          </div>
        </div>
        {session?.user?.role === "ADMIN" && canWrite && (
          <Button
            variant="outline"
            onClick={() => router.push("/admin/users/roles")}
          >
            <Shield className="size-4 mr-2" />
            角色權限設定
          </Button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋姓名或 Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="篩選角色" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部角色</SelectItem>
            {allRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabels[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">載入中...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredUsers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {searchQuery.trim() ? "找不到符合條件的使用者" : "尚無使用者資料"}
          </p>
        </div>
      )}

      {/* Users table */}
      {!loading && !error && filteredUsers.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>電話</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>登入方式</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className={canWrite ? "cursor-pointer" : undefined}
                  onClick={canWrite ? () => handleRowClick(user) : undefined}
                >
                  <TableCell className="font-medium">
                    {user.name ?? "-"}
                  </TableCell>
                  <TableCell>{user.email ?? "-"}</TableCell>
                  <TableCell>{user.phone ?? "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(getRoleBadgeClass(user.role))}
                    >
                      {roleLabels[user.role] ?? user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        user.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      )}
                    >
                      {user.isActive ? "啟用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell>{getProviderDisplay(user.accounts, user.hasPassword)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯使用者</DialogTitle>
            <DialogDescription>
              {editingUser?.name ?? editingUser?.email ?? "使用者"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Role selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">角色</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇角色" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">帳號狀態</label>
                <p className="text-muted-foreground text-xs">
                  {editIsActive ? "帳號目前為啟用狀態" : "帳號目前為停用狀態"}
                </p>
              </div>
              <Switch
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
