"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  X,
  Link as LinkIcon,
  ListTodo,
  Users,
  Search,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ==================== Types ====================

interface EventTeamData {
  id: string;
  eventId: string;
  teamId: string | null;
  customName: string | null;
  sopLinks: string[];
  team: { id: string; name: string } | null;
  members: {
    id: string;
    userId: string;
    role: string | null;
    user: {
      id: string;
      name: string | null;
      phone: string | null;
      image: string | null;
    };
  }[];
  tasks: {
    id: string;
    title: string;
    assigneeId: string | null;
    status: string;
    assignee: { id: string; name: string | null } | null;
  }[];
}

interface TeamTemplate {
  id: string;
  name: string;
}

interface UserSearchResult {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

// ==================== Constants ====================

const taskStatusConfig: Record<string, { label: string; className: string }> = {
  PENDING: { label: "待處理", className: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "進行中", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "已完成", className: "bg-green-100 text-green-700" },
};

const taskStatusFlow = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

function getNextTaskStatus(current: string): string {
  const idx = taskStatusFlow.indexOf(
    current as (typeof taskStatusFlow)[number]
  );
  if (idx === -1) return "PENDING";
  return taskStatusFlow[(idx + 1) % taskStatusFlow.length];
}

// ==================== Component ====================

export function EventTeamsSection({
  eventId,
  canWrite,
}: {
  eventId: string;
  canWrite: boolean;
}) {
  const [eventTeams, setEventTeams] = useState<EventTeamData[]>([]);
  const [loading, setLoading] = useState(true);

  // Add team dialog state
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [customTeamName, setCustomTeamName] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);

  // Add member dialog state
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<
    UserSearchResult[]
  >([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [memberRole, setMemberRole] = useState("");

  // Delete team confirmation
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);

  // New SOP link input per team
  const [newSopLinks, setNewSopLinks] = useState<Record<string, string>>({});

  // New task input per team
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>(
    {}
  );

  // ==================== Fetch teams ====================

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/teams`);
      if (!res.ok) throw new Error("無法取得工作小組");
      const data = await res.json();
      setEventTeams(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "載入工作小組失敗");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // ==================== Add team ====================

  async function openAddTeamDialog() {
    setAddTeamOpen(true);
    setSelectedTemplateId(null);
    setCustomTeamName("");
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("無法取得組別範本");
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "載入範本失敗");
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function handleAddTeam() {
    if (!selectedTemplateId && !customTeamName.trim()) return;
    setAddingTeam(true);
    try {
      const body: { teamId?: string; customName?: string } = {};
      if (selectedTemplateId) {
        body.teamId = selectedTemplateId;
      } else {
        body.customName = customTeamName.trim();
      }
      const res = await fetch(`/api/events/${eventId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "新增工作小組失敗");
      }
      toast.success("已新增工作小組");
      setAddTeamOpen(false);
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setAddingTeam(false);
    }
  }

  // ==================== Delete team ====================

  async function handleDeleteTeam() {
    if (!deleteTeamId) return;
    setDeletingTeam(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/teams/${deleteTeamId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("刪除工作小組失敗");
      toast.success("已刪除工作小組");
      setDeleteTeamId(null);
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeletingTeam(false);
    }
  }

  // ==================== Members ====================

  function openAddMemberDialog(eventTeamId: string) {
    setAddMemberTeamId(eventTeamId);
    setMemberSearch("");
    setMemberSearchResults([]);
    setMemberRole("");
  }

  async function searchUsers(query: string) {
    if (!query.trim()) {
      setMemberSearchResults([]);
      return;
    }
    setSearchingMembers(true);
    try {
      const res = await fetch(
        `/api/users?search=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("搜尋使用者失敗");
      const data = await res.json();
      setMemberSearchResults(data);
    } catch {
      setMemberSearchResults([]);
    } finally {
      setSearchingMembers(false);
    }
  }

  async function handleAddMember(userId: string) {
    if (!addMemberTeamId) return;
    try {
      const res = await fetch(
        `/api/events/${eventId}/teams/${addMemberTeamId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            role: memberRole.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "新增成員失敗");
      }
      toast.success("已新增成員");
      setAddMemberTeamId(null);
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "新增成員失敗");
    }
  }

  async function handleRemoveMember(eventTeamId: string, userId: string) {
    try {
      const res = await fetch(
        `/api/events/${eventId}/teams/${eventTeamId}/members/${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("移除成員失敗");
      toast.success("已移除成員");
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移除失敗");
    }
  }

  // ==================== SOP Links ====================

  async function handleAddSopLink(eventTeam: EventTeamData) {
    const newLink = newSopLinks[eventTeam.id]?.trim();
    if (!newLink) return;

    try {
      const updatedLinks = [...eventTeam.sopLinks, newLink];
      const res = await fetch(
        `/api/events/${eventId}/teams/${eventTeam.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sopLinks: updatedLinks }),
        }
      );
      if (!res.ok) throw new Error("新增 SOP 連結失敗");
      toast.success("已新增 SOP 連結");
      setNewSopLinks((prev) => ({ ...prev, [eventTeam.id]: "" }));
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "新增連結失敗");
    }
  }

  async function handleRemoveSopLink(
    eventTeam: EventTeamData,
    index: number
  ) {
    try {
      const updatedLinks = eventTeam.sopLinks.filter((_, i) => i !== index);
      const res = await fetch(
        `/api/events/${eventId}/teams/${eventTeam.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sopLinks: updatedLinks }),
        }
      );
      if (!res.ok) throw new Error("移除 SOP 連結失敗");
      toast.success("已移除 SOP 連結");
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移除連結失敗");
    }
  }

  // ==================== Tasks ====================

  async function handleCreateTask(eventTeamId: string) {
    const title = newTaskTitles[eventTeamId]?.trim();
    if (!title) return;

    try {
      const res = await fetch(
        `/api/events/${eventId}/teams/${eventTeamId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }
      );
      if (!res.ok) throw new Error("新增任務失敗");
      toast.success("已新增任務");
      setNewTaskTitles((prev) => ({ ...prev, [eventTeamId]: "" }));
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "新增任務失敗");
    }
  }

  async function handleToggleTaskStatus(
    eventTeamId: string,
    taskId: string,
    currentStatus: string
  ) {
    const nextStatus = getNextTaskStatus(currentStatus);
    try {
      const res = await fetch(
        `/api/events/${eventId}/teams/${eventTeamId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!res.ok) throw new Error("更新任務狀態失敗");
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失敗");
    }
  }

  async function handleDeleteTask(eventTeamId: string, taskId: string) {
    try {
      const res = await fetch(
        `/api/events/${eventId}/teams/${eventTeamId}/tasks/${taskId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("刪除任務失敗");
      toast.success("已刪除任務");
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  // ==================== Helpers ====================

  function getTeamDisplayName(team: EventTeamData): string {
    return team.team?.name ?? team.customName ?? "未命名小組";
  }

  // ==================== Render ====================

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              工作小組 ({eventTeams.length})
            </CardTitle>
            {canWrite && (
              <Button size="sm" onClick={openAddTeamDialog}>
                <Plus className="size-4 mr-1" />
                新增小組
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-muted-foreground text-center py-4">載入中...</p>
          )}

          {!loading && eventTeams.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              尚無工作小組
            </p>
          )}

          {!loading && eventTeams.length > 0 && (
            <div className="space-y-4">
              {eventTeams.map((team) => (
                <Card key={team.id} className="border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {getTeamDisplayName(team)}
                        {team.team && team.customName && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({team.customName})
                          </span>
                        )}
                      </CardTitle>
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTeamId(team.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Members section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          成員 ({team.members.length})
                        </h4>
                        {canWrite && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddMemberDialog(team.id)}
                          >
                            <Plus className="size-3 mr-1" />
                            新增成員
                          </Button>
                        )}
                      </div>
                      {team.members.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          尚無成員
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {team.members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {member.user.name ?? "未設定姓名"}
                                </span>
                                {member.role && (
                                  <Badge variant="secondary" className="text-xs">
                                    {member.role}
                                  </Badge>
                                )}
                              </div>
                              {canWrite && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  onClick={() =>
                                    handleRemoveMember(team.id, member.userId)
                                  }
                                >
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SOP Links section */}
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <LinkIcon className="size-3.5" />
                        SOP 連結 ({team.sopLinks.length})
                      </h4>
                      {team.sopLinks.length === 0 && !canWrite && (
                        <p className="text-sm text-muted-foreground">
                          尚無 SOP 連結
                        </p>
                      )}
                      {team.sopLinks.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {team.sopLinks.map((link, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50"
                            >
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline truncate max-w-[80%]"
                              >
                                {link}
                              </a>
                              {canWrite && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  onClick={() =>
                                    handleRemoveSopLink(team, idx)
                                  }
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
                            placeholder="輸入 SOP 連結 URL..."
                            className="text-sm"
                            value={newSopLinks[team.id] ?? ""}
                            onChange={(e) =>
                              setNewSopLinks((prev) => ({
                                ...prev,
                                [team.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddSopLink(team);
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddSopLink(team)}
                            disabled={!newSopLinks[team.id]?.trim()}
                          >
                            新增
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Tasks section */}
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <ListTodo className="size-3.5" />
                        任務 ({team.tasks.length})
                      </h4>
                      {team.tasks.length === 0 && !canWrite && (
                        <p className="text-sm text-muted-foreground">
                          尚無任務
                        </p>
                      )}
                      {team.tasks.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {team.tasks.map((task) => {
                            const statusInfo = taskStatusConfig[task.status] ??
                              taskStatusConfig.PENDING;
                            return (
                              <div
                                key={task.id}
                                className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {canWrite ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0"
                                      onClick={() =>
                                        handleToggleTaskStatus(
                                          team.id,
                                          task.id,
                                          task.status
                                        )
                                      }
                                      title="點擊切換狀態"
                                    >
                                      <Badge
                                        variant="secondary"
                                        className={`text-xs cursor-pointer ${statusInfo.className}`}
                                      >
                                        {statusInfo.label}
                                        <ChevronRight className="size-3 ml-0.5" />
                                      </Badge>
                                    </Button>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className={`text-xs ${statusInfo.className}`}
                                    >
                                      {statusInfo.label}
                                    </Badge>
                                  )}
                                  <span className="text-sm truncate">
                                    {task.title}
                                  </span>
                                  {task.assignee && (
                                    <span className="text-xs text-muted-foreground">
                                      ({task.assignee.name ?? "未知"})
                                    </span>
                                  )}
                                </div>
                                {canWrite && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={() =>
                                      handleDeleteTask(team.id, task.id)
                                    }
                                  >
                                    <X className="size-3" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {canWrite && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="輸入新任務標題..."
                            className="text-sm"
                            value={newTaskTitles[team.id] ?? ""}
                            onChange={(e) =>
                              setNewTaskTitles((prev) => ({
                                ...prev,
                                [team.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleCreateTask(team.id);
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateTask(team.id)}
                            disabled={!newTaskTitles[team.id]?.trim()}
                          >
                            新增
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Team Dialog */}
      <Dialog open={addTeamOpen} onOpenChange={setAddTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增工作小組</DialogTitle>
            <DialogDescription>
              從範本選擇或自訂小組名稱
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template selection */}
            <div>
              <p className="text-sm font-medium mb-2">從範本選擇</p>
              {loadingTemplates ? (
                <p className="text-sm text-muted-foreground">載入範本中...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無範本</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <Button
                      key={t.id}
                      variant={
                        selectedTemplateId === t.id ? "default" : "outline"
                      }
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        setSelectedTemplateId(
                          selectedTemplateId === t.id ? null : t.id
                        );
                        setCustomTeamName("");
                      }}
                    >
                      {t.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom name */}
            <div>
              <p className="text-sm font-medium mb-2">或自訂名稱</p>
              <Input
                placeholder="自訂小組名稱..."
                value={customTeamName}
                onChange={(e) => {
                  setCustomTeamName(e.target.value);
                  setSelectedTemplateId(null);
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTeamOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleAddTeam}
              disabled={
                addingTeam ||
                (!selectedTemplateId && !customTeamName.trim())
              }
            >
              {addingTeam ? "新增中..." : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={addMemberTeamId !== null}
        onOpenChange={(open) => {
          if (!open) setAddMemberTeamId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增成員</DialogTitle>
            <DialogDescription>搜尋使用者並新增為小組成員</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">角色（選填）</p>
              <Input
                placeholder="例如：組長、組員..."
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">搜尋使用者</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="輸入姓名或電話..."
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    searchUsers(e.target.value);
                  }}
                />
              </div>
            </div>

            {searchingMembers && (
              <p className="text-sm text-muted-foreground">搜尋中...</p>
            )}

            {!searchingMembers && memberSearch && memberSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">找不到使用者</p>
            )}

            {memberSearchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {memberSearchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                    onClick={() => handleAddMember(user.id)}
                  >
                    <p className="text-sm font-medium">
                      {user.name ?? "未設定姓名"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.phone ?? user.email ?? ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirmation Dialog */}
      <Dialog
        open={deleteTeamId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTeamId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除此工作小組嗎？相關的成員和任務也會一併刪除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTeamId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTeam}
              disabled={deletingTeam}
            >
              {deletingTeam ? "刪除中..." : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
