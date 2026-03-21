"use client";

import { Fragment, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  UsersRound,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Search,
  Users,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useAdminPermissions } from "@/contexts/admin-permissions";
import { formatAdminDate } from "@/lib/formatters";

interface TeamTemplate {
  id: string;
  name: string;
  createdAt: string;
  _count: { defaultMembers: number; defaultTasks: number };
}

interface DefaultMember {
  id: string;
  userId: string;
  role: string | null;
  user: { id: string; name: string | null; phone: string | null };
}

interface DefaultTask {
  id: string;
  title: string;
}

interface TemplateDetail {
  id: string;
  name: string;
  defaultMembers: DefaultMember[];
  defaultTasks: DefaultTask[];
}

interface UserSearchResult {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export default function TeamsPage() {
  const { canWrite } = useAdminPermissions("teams");
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expanded template state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [memberRole, setMemberRole] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Add task inline
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("無法取得組別範本");
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const fetchDetail = useCallback(async (teamId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (!res.ok) throw new Error("無法取得範本詳情");
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  function toggleExpand(teamId: string) {
    if (expandedId === teamId) {
      setExpandedId(null);
      setDetail(null);
    } else {
      setExpandedId(teamId);
      fetchDetail(teamId);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "建立失敗");
      }
      toast.success(`已新增「${newName.trim()}」`);
      setNewName("");
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setCreating(false);
    }
  }

  function handleEditClick(e: React.MouseEvent, template: TeamTemplate) {
    e.stopPropagation();
    setEditingId(template.id);
    setEditName(template.name);
  }

  async function handleEditSave() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error("更新失敗");
      toast.success("已更新");
      setEditingId(null);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${deletingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("刪除失敗");
      toast.success("已刪除");
      if (expandedId === deletingId) {
        setExpandedId(null);
        setDetail(null);
      }
      setDeletingId(null);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeleting(false);
    }
  }

  // --- Default Members ---

  function openAddMemberDialog() {
    setAddMemberOpen(true);
    setMemberSearch("");
    setMemberSearchResults([]);
    setMemberRole("");
  }

  function handleMemberSearchChange(query: string) {
    setMemberSearch(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setMemberSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => searchUsers(query), 300);
  }

  async function searchUsers(query: string) {
    setSearchingMembers(true);
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("搜尋失敗");
      const result = await res.json();
      setMemberSearchResults(result.data);
    } catch {
      setMemberSearchResults([]);
    } finally {
      setSearchingMembers(false);
    }
  }

  async function handleAddMember(userId: string) {
    if (!expandedId) return;
    try {
      const res = await fetch(`/api/teams/${expandedId}/default-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: memberRole.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "新增成員失敗");
      }
      toast.success("已新增預設成員");
      setAddMemberOpen(false);
      fetchDetail(expandedId);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "新增失敗");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!expandedId) return;
    try {
      const res = await fetch(`/api/teams/${expandedId}/default-members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("移除成員失敗");
      toast.success("已移除預設成員");
      fetchDetail(expandedId);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移除失敗");
    }
  }

  // --- Default Tasks ---

  async function handleAddTask() {
    if (!expandedId || !newTaskTitle.trim()) return;
    try {
      const res = await fetch(`/api/teams/${expandedId}/default-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle.trim() }),
      });
      if (!res.ok) throw new Error("新增任務失敗");
      toast.success("已新增預設任務");
      setNewTaskTitle("");
      fetchDetail(expandedId);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "新增失敗");
    }
  }

  async function handleRemoveTask(taskId: string) {
    if (!expandedId) return;
    try {
      const res = await fetch(`/api/teams/${expandedId}/default-tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("移除任務失敗");
      toast.success("已移除預設任務");
      fetchDetail(expandedId);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移除失敗");
    }
  }

  // Filter out already-added members from search results
  const filteredSearchResults = memberSearchResults.filter(
    (u) => !detail?.defaultMembers.some((m) => m.userId === u.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UsersRound className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">組別範本管理</h1>
          <p className="text-muted-foreground text-sm">
            管理全域組別範本（影音組、敬拜組等），活動可從範本選擇或自訂
          </p>
        </div>
      </div>

      {/* Add new template */}
      {canWrite && (
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="新增組別名稱..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            <Plus className="size-4 mr-1" />
            {creating ? "新增中..." : "新增"}
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">載入中...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">尚無組別範本</p>
        </div>
      )}

      {/* Templates table */}
      {!loading && templates.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>組別名稱</TableHead>
                <TableHead>預設成員</TableHead>
                <TableHead>預設任務</TableHead>
                <TableHead>建立日期</TableHead>
                {canWrite && <TableHead className="w-24">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <Fragment key={t.id}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpand(t.id)}>
                    <TableCell className="w-8">
                      {expandedId === t.id ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <Users className="size-3 mr-1" />
                        {t._count.defaultMembers}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <ListTodo className="size-3 mr-1" />
                        {t._count.defaultTasks}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatAdminDate(t.createdAt)}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleEditClick(e, t)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(t.id);
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>

                  {/* Expanded detail */}
                  {expandedId === t.id && (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 6 : 5} className="bg-muted/30 p-4">
                        {loadingDetail ? (
                          <p className="text-muted-foreground text-sm py-4 text-center">
                            載入中...
                          </p>
                        ) : detail ? (
                          <div className="grid gap-6 md:grid-cols-2">
                            {/* Default Members */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                                  <Users className="size-4" />
                                  預設成員
                                </h3>
                                {canWrite && (
                                  <Button size="sm" variant="outline" onClick={openAddMemberDialog}>
                                    <Plus className="size-3 mr-1" />
                                    新增
                                  </Button>
                                )}
                              </div>
                              {detail.defaultMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">尚無預設成員</p>
                              ) : (
                                <div className="space-y-1">
                                  {detail.defaultMembers.map((m) => (
                                    <div
                                      key={m.id}
                                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{m.user.name ?? "未命名"}</span>
                                        {m.role && (
                                          <Badge variant="outline" className="text-xs">
                                            {m.role}
                                          </Badge>
                                        )}
                                      </div>
                                      {canWrite && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-7"
                                          onClick={() => handleRemoveMember(m.userId)}
                                        >
                                          <X className="size-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Default Tasks */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                                  <ListTodo className="size-4" />
                                  預設任務
                                </h3>
                              </div>
                              {detail.defaultTasks.length === 0 && !canWrite && (
                                <p className="text-sm text-muted-foreground">尚無預設任務</p>
                              )}
                              {detail.defaultTasks.length > 0 && (
                                <div className="space-y-1">
                                  {detail.defaultTasks.map((task) => (
                                    <div
                                      key={task.id}
                                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                    >
                                      <span>{task.title}</span>
                                      {canWrite && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-7"
                                          onClick={() => handleRemoveTask(task.id)}
                                        >
                                          <X className="size-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {canWrite && (
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="新增預設任務..."
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                                    className="h-8 text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAddTask}
                                    disabled={!newTaskTitle.trim()}
                                  >
                                    <Plus className="size-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯組別名稱</DialogTitle>
          </DialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={saving || !editName.trim()}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除此組別範本嗎？已使用此範本的活動組別不會被刪除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "刪除中..." : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增預設成員</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">角色（選填）</label>
              <Input
                placeholder="例：組長、副組長"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">搜尋使用者</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋姓名或電話..."
                  value={memberSearch}
                  onChange={(e) => handleMemberSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {searchingMembers && (
              <p className="text-sm text-muted-foreground text-center">搜尋中...</p>
            )}
            {!searchingMembers && memberSearch.trim() && filteredSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">找不到使用者</p>
            )}
            {filteredSearchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredSearchResults.map((user) => (
                  <button
                    key={user.id}
                    className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => handleAddMember(user.id)}
                  >
                    <div>
                      <span className="font-medium">{user.name ?? "未命名"}</span>
                      {user.phone && (
                        <span className="text-muted-foreground ml-2">{user.phone}</span>
                      )}
                    </div>
                    <Plus className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
