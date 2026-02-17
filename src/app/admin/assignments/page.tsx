"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Users, Check, BookCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/contexts/admin-permissions";

// -- Types ------------------------------------------------------------------

interface EventItem {
  id: string;
  title: string;
  type: string;
  status: string;
}

interface EventSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  topic: string;
}

interface EventDetail {
  id: string;
  title: string;
  eventSessions: EventSession[];
}

interface AssignmentItem {
  id: string;
  title: string;
  eventSessionId: string;
  _count: {
    completions: number;
  };
}

interface CompletionRecord {
  id: string;
  userId: string;
  completedAt: string;
  user: {
    id: string;
    name: string;
    phone: string;
  };
}

interface Registration {
  id: string;
  status: string;
  user: {
    id: string;
    name: string;
    phone: string;
  };
}

interface CombinedCompletionRow {
  userId: string;
  userName: string;
  phone: string;
  completed: boolean;
  completedAt: string | null;
}

// -- Helpers ----------------------------------------------------------------

function formatSessionLabel(session: EventSession): string {
  const date = new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.sessionDate));
  const topic = session.topic ? ` - ${session.topic}` : "";
  return `第 ${session.sessionNo} 堂 (${date})${topic}`;
}

// -- Component --------------------------------------------------------------

export default function AssignmentsPage() {
  const { canWrite } = useAdminPermissions("assignments");

  // Event selector state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Session selector state
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Assignment list state
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  // New assignment inline form state
  const [showNewInput, setShowNewInput] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Delete state
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // Selected assignment (View 2)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  // Completion detail state
  const [combinedRows, setCombinedRows] = useState<CombinedCompletionRow[]>([]);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Bulk completion state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set()
  );
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false);

  // Remove completion loading state
  const [removeLoadingUserId, setRemoveLoadingUserId] = useState<string | null>(
    null
  );

  // -- Fetch events ---------------------------------------------------------

  const fetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      setEventsError(null);
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("無法取得活動列表");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // -- Fetch sessions when event changes ------------------------------------

  const fetchSessions = useCallback(async (eventId: string) => {
    try {
      setSessionsLoading(true);
      setSessions([]);
      setSelectedSessionId("");
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("無法取得活動場次");
      const data: EventDetail = await res.json();
      setSessions(data.eventSessions ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "無法取得場次資料");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchSessions(selectedEventId);
    } else {
      setSessions([]);
      setSelectedSessionId("");
    }
  }, [selectedEventId, fetchSessions]);

  // -- Fetch assignments when session changes --------------------------------

  const fetchAssignments = useCallback(async (sessionId: string) => {
    try {
      setAssignmentsLoading(true);
      setAssignmentsError(null);
      const res = await fetch(
        `/api/assignments?eventSessionId=${sessionId}`
      );
      if (!res.ok) throw new Error("無法取得作業列表");
      const data: AssignmentItem[] = await res.json();
      setAssignments(data);
    } catch (err) {
      setAssignmentsError(
        err instanceof Error ? err.message : "發生未知錯誤"
      );
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchAssignments(selectedSessionId);
    } else {
      setAssignments([]);
    }
  }, [selectedSessionId, fetchAssignments]);

  // -- Create assignment ----------------------------------------------------

  async function handleCreateAssignment() {
    if (!newTitle.trim() || !selectedSessionId) return;

    try {
      setCreateLoading(true);
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSessionId: selectedSessionId,
          title: newTitle.trim(),
        }),
      });

      if (!res.ok) throw new Error("新增作業失敗");

      toast.success("已成功新增作業");
      setNewTitle("");
      setShowNewInput(false);
      fetchAssignments(selectedSessionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setCreateLoading(false);
    }
  }

  // -- Delete assignment ----------------------------------------------------

  async function handleDeleteAssignment(assignmentId: string) {
    if (!confirm("確定要刪除此作業嗎？此操作無法復原。")) return;

    try {
      setDeleteLoadingId(assignmentId);
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("刪除作業失敗");

      toast.success("已成功刪除作業");
      if (selectedSessionId) {
        fetchAssignments(selectedSessionId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setDeleteLoadingId(null);
    }
  }

  // -- Fetch completion detail when assignment selected ----------------------

  const fetchCompletionData = useCallback(
    async (assignmentId: string, eventId: string) => {
      try {
        setCompletionLoading(true);
        setCompletionError(null);
        setSelectedUserIds(new Set());

        const [completionsRes, registrationsRes] = await Promise.all([
          fetch(`/api/assignments/${assignmentId}/completions`),
          fetch(`/api/registrations?eventId=${eventId}`),
        ]);

        if (!completionsRes.ok) throw new Error("無法取得完成紀錄");
        if (!registrationsRes.ok) throw new Error("無法取得報名資料");

        const completionsData: CompletionRecord[] =
          await completionsRes.json();
        const registrationsData: Registration[] =
          await registrationsRes.json();

        // Build completion lookup by userId
        const completionMap = new Map<string, CompletionRecord>();
        for (const record of completionsData) {
          completionMap.set(record.userId, record);
        }

        // Only include confirmed registrations
        const confirmedRegistrations = registrationsData.filter(
          (r) => r.status === "REGISTERED"
        );

        const rows: CombinedCompletionRow[] = confirmedRegistrations.map(
          (reg) => {
            const comp = completionMap.get(reg.user.id);
            return {
              userId: reg.user.id,
              userName: reg.user.name,
              phone: reg.user.phone,
              completed: !!comp,
              completedAt: comp?.completedAt ?? null,
            };
          }
        );

        setCombinedRows(rows);
      } catch (err) {
        setCompletionError(
          err instanceof Error ? err.message : "發生未知錯誤"
        );
      } finally {
        setCompletionLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedAssignmentId && selectedEventId) {
      fetchCompletionData(selectedAssignmentId, selectedEventId);
    } else {
      setCombinedRows([]);
      setSelectedUserIds(new Set());
    }
  }, [selectedAssignmentId, selectedEventId, fetchCompletionData]);

  // -- Checkbox handlers ----------------------------------------------------

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const uncompletedUserIds = combinedRows
      .filter((r) => !r.completed)
      .map((r) => r.userId);

    if (uncompletedUserIds.every((id) => selectedUserIds.has(id))) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(uncompletedUserIds));
    }
  }

  // -- Bulk mark complete ---------------------------------------------------

  async function handleBulkComplete() {
    if (selectedUserIds.size === 0 || !selectedAssignmentId) return;

    try {
      setBulkCompleteLoading(true);
      const res = await fetch(
        `/api/assignments/${selectedAssignmentId}/completions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: Array.from(selectedUserIds),
          }),
        }
      );

      if (!res.ok) throw new Error("批次標記失敗");

      toast.success(`已成功為 ${selectedUserIds.size} 人標記完成`);
      setSelectedUserIds(new Set());

      // Refresh data
      if (selectedAssignmentId && selectedEventId) {
        fetchCompletionData(selectedAssignmentId, selectedEventId);
      }
      // Also refresh assignment list to update counts
      if (selectedSessionId) {
        fetchAssignments(selectedSessionId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBulkCompleteLoading(false);
    }
  }

  // -- Remove completion ----------------------------------------------------

  async function handleRemoveCompletion(userId: string) {
    if (!selectedAssignmentId) return;

    try {
      setRemoveLoadingUserId(userId);
      const res = await fetch(
        `/api/assignments/${selectedAssignmentId}/completions/${userId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("取消完成標記失敗");

      toast.success("已取消完成標記");

      // Refresh data
      if (selectedAssignmentId && selectedEventId) {
        fetchCompletionData(selectedAssignmentId, selectedEventId);
      }
      // Also refresh assignment list to update counts
      if (selectedSessionId) {
        fetchAssignments(selectedSessionId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setRemoveLoadingUserId(null);
    }
  }

  // -- Derived values -------------------------------------------------------

  const completedCount = combinedRows.filter((r) => r.completed).length;
  const totalCount = combinedRows.length;
  const uncompletedRows = combinedRows.filter((r) => !r.completed);
  const allUncompletedSelected =
    uncompletedRows.length > 0 &&
    uncompletedRows.every((r) => selectedUserIds.has(r.userId));

  const selectedAssignment = assignments.find(
    (a) => a.id === selectedAssignmentId
  );

  // -- Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">作業管理</h1>
        <p className="text-muted-foreground text-sm">
          管理活動作業完成狀態
        </p>
      </div>

      {/* View 2: Completion Detail */}
      {selectedAssignmentId ? (
        <div className="space-y-4">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedAssignmentId(null)}
          >
            <ArrowLeft className="size-4" />
            返回作業列表
          </Button>

          {/* Assignment title header */}
          <div className="flex items-center gap-2">
            <BookCheck className="text-muted-foreground size-5" />
            <h2 className="text-lg font-semibold">
              {selectedAssignment?.title ?? "作業"}
            </h2>
          </div>

          {/* Completion content */}
          {completionLoading && (
            <div className="flex justify-center py-12">
              <p className="text-muted-foreground">載入中...</p>
            </div>
          )}

          {completionError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {completionError}
            </div>
          )}

          {!completionLoading && !completionError && (
            <div className="space-y-4">
              {/* Summary bar */}
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-2">
                    <Users className="text-muted-foreground size-5" />
                    <span className="text-sm font-medium">
                      已完成 {completedCount} / 已報名 {totalCount} 人
                    </span>
                  </div>
                  {canWrite && selectedUserIds.size > 0 && (
                    <Button
                      onClick={handleBulkComplete}
                      disabled={bulkCompleteLoading}
                      size="sm"
                    >
                      <Check className="size-4" />
                      {bulkCompleteLoading
                        ? "標記中..."
                        : `批次標記完成 (${selectedUserIds.size} 人)`}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Completion table */}
              {combinedRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">
                    此場次尚無報名資料
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canWrite && (
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allUncompletedSelected}
                              onCheckedChange={toggleSelectAll}
                              aria-label="全選未完成人員"
                              disabled={uncompletedRows.length === 0}
                            />
                          </TableHead>
                        )}
                        <TableHead>姓名</TableHead>
                        <TableHead>完成狀態</TableHead>
                        {canWrite && <TableHead>操作</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {combinedRows.map((row) => (
                        <TableRow key={row.userId}>
                          {canWrite && (
                            <TableCell>
                              {!row.completed && (
                                <Checkbox
                                  checked={selectedUserIds.has(row.userId)}
                                  onCheckedChange={() =>
                                    toggleUserSelection(row.userId)
                                  }
                                  aria-label={`選取 ${row.userName}`}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell className="font-medium">
                            {row.userName}
                          </TableCell>
                          <TableCell>
                            {row.completed ? (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                )}
                              >
                                已完成
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                )}
                              >
                                未完成
                              </Badge>
                            )}
                          </TableCell>
                          {canWrite && (
                            <TableCell>
                              {row.completed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveCompletion(row.userId)
                                  }
                                  disabled={removeLoadingUserId === row.userId}
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                  {removeLoadingUserId === row.userId
                                    ? "取消中..."
                                    : "取消完成"}
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* View 1: Assignment List */}

          {/* Event & Session selector */}
          <Card>
            <CardHeader>
              <CardTitle>選擇活動與場次</CardTitle>
              <CardDescription>
                請先選擇活動，再選擇要管理的場次
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading && (
                <p className="text-muted-foreground text-sm">
                  載入活動列表中...
                </p>
              )}
              {eventsError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {eventsError}
                </div>
              )}
              {!eventsLoading && !eventsError && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {/* Event selector */}
                  <Select
                    value={selectedEventId}
                    onValueChange={(value) => {
                      setSelectedEventId(value);
                      setSelectedSessionId("");
                      setAssignments([]);
                      setSelectedAssignmentId(null);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[320px]">
                      <SelectValue placeholder="請選擇活動" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Session selector */}
                  {selectedEventId && (
                    <Select
                      value={selectedSessionId}
                      onValueChange={(value) => {
                        setSelectedSessionId(value);
                        setSelectedAssignmentId(null);
                      }}
                      disabled={sessionsLoading}
                    >
                      <SelectTrigger className="w-full sm:w-[320px]">
                        <SelectValue
                          placeholder={
                            sessionsLoading ? "載入場次中..." : "請選擇場次"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {formatSessionLabel(session)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Empty state: no event or session selected */}
          {(!selectedEventId || !selectedSessionId) &&
            !eventsLoading &&
            !eventsError && (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  {!selectedEventId
                    ? "請選擇活動以開始管理作業"
                    : "請選擇場次以查看作業列表"}
                </p>
              </div>
            )}

          {/* Assignment list */}
          {selectedEventId && selectedSessionId && (
            <>
              {assignmentsLoading && (
                <div className="flex justify-center py-12">
                  <p className="text-muted-foreground">載入中...</p>
                </div>
              )}

              {assignmentsError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {assignmentsError}
                </div>
              )}

              {!assignmentsLoading && !assignmentsError && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>作業列表</CardTitle>
                    </div>
                    {canWrite && !showNewInput && (
                      <Button
                        size="sm"
                        onClick={() => setShowNewInput(true)}
                      >
                        <Plus className="size-4" />
                        新增作業
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {/* Inline new assignment input */}
                    {canWrite && showNewInput && (
                      <div className="mb-4 flex items-center gap-2">
                        <Input
                          placeholder="作業名稱"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateAssignment();
                            if (e.key === "Escape") {
                              setShowNewInput(false);
                              setNewTitle("");
                            }
                          }}
                          disabled={createLoading}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={handleCreateAssignment}
                          disabled={createLoading || !newTitle.trim()}
                        >
                          {createLoading ? "新增中..." : "確認"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowNewInput(false);
                            setNewTitle("");
                          }}
                          disabled={createLoading}
                        >
                          取消
                        </Button>
                      </div>
                    )}

                    {/* Assignment table */}
                    {assignments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground">
                          此場次尚無作業
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>作業名稱</TableHead>
                              <TableHead>完成人數</TableHead>
                              <TableHead>操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {assignments.map((assignment) => (
                              <TableRow
                                key={assignment.id}
                                className="cursor-pointer"
                                onClick={() =>
                                  setSelectedAssignmentId(assignment.id)
                                }
                              >
                                <TableCell className="font-medium">
                                  {assignment.title}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {assignment._count.completions} 人已完成
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {canWrite && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAssignment(assignment.id);
                                      }}
                                      disabled={
                                        deleteLoadingId === assignment.id
                                      }
                                    >
                                      <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
