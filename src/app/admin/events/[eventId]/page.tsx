"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EventForm,
  type EventFormSubmitData,
  type EventFormDefaultValues,
} from "@/components/shared/event-form";
import { cn } from "@/lib/utils";
import {
  eventStatusLabels,
  eventStatusFlow,
  eventCategoryLabels,
  eventStatusClassNames,
} from "@/lib/constants";
import { formatAdminDate } from "@/lib/formatters";
import { useAdminPermissions } from "@/contexts/admin-permissions";
import { EventTeamsSection } from "@/components/shared/event-teams-section";
import { RegistrationsPanel } from "@/components/admin/registrations-panel";
import { AttendancePanel } from "@/components/admin/attendance-panel";
import { AssignmentsPanel } from "@/components/admin/assignments-panel";
import { BudgetPanel } from "@/components/admin/budget-panel";
import { fetchEventExportData } from "@/lib/export-event-data";
import { exportEventToExcel } from "@/lib/excel-export";

interface EventSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
}

interface FormField {
  id: string;
  type: "TEXT" | "YES_NO" | "SINGLE_CHOICE";
  label: string;
  options: string[];
  required: boolean;
  sortOrder: number;
}

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: "COURSE" | "LECTURE" | "CAMP" | null;
  type: "SINGLE" | "SERIES";
  status: "PLANNING" | "OPEN" | "IN_PROGRESS" | "COMPLETED";
  maxParticipants: number | null;
  minAssignmentRate: number | null;
  createdAt: string;
  eventSessions: EventSession[];
  formFields?: FormField[];
  _count: { registrations: number };
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { canWrite } = useAdminPermissions("events");
  const { canRead: canReadTeams, canWrite: canWriteTeams } = useAdminPermissions("teams");
  const { canRead: canReadRegistrations } = useAdminPermissions("registrations");
  const { canRead: canReadAttendance } = useAdminPermissions("attendance");
  const { canRead: canReadAssignments } = useAdminPermissions("assignments");
  const { canRead: canReadBudget } = useAdminPermissions("budget");

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("無法取得活動資料");
      const data = await res.json();
      setEvent(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("狀態更新失敗");
      toast.success("狀態已更新");
      fetchEvent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失敗");
    }
  }

  async function handleEdit(data: EventFormSubmitData) {
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("更新活動失敗");
      toast.success("活動已更新");
      setEditOpen(false);
      fetchEvent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      const data = await fetchEventExportData(eventId);
      exportEventToExcel(data);
      toast.success("Excel 報表已匯出");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "匯出失敗");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("刪除活動失敗");
      toast.success("活動已刪除");
      router.push("/admin/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刪除失敗");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <p className="text-muted-foreground">找不到此活動</p>
        <Button variant="outline" onClick={() => router.push("/admin/events")}>
          返回活動列表
        </Button>
      </div>
    );
  }

  const currentStatusIndex = eventStatusFlow.indexOf(
    event.status as (typeof eventStatusFlow)[number]
  );
  const nextStatus =
    currentStatusIndex < eventStatusFlow.length - 1
      ? eventStatusFlow[currentStatusIndex + 1]
      : null;

  const editDefaults: EventFormDefaultValues = {
    title: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    category: event.category ?? undefined,
    type: event.type,
    maxParticipants: event.maxParticipants,
    minAssignmentRate: event.minAssignmentRate != null ? event.minAssignmentRate * 100 : undefined,
    ...(event.type === "SINGLE" && event.eventSessions[0]
      ? {
          session: {
            sessionDate: event.eventSessions[0].sessionDate.slice(0, 10),
            startTime: event.eventSessions[0].startTime ?? "",
            endTime: event.eventSessions[0].endTime ?? "",
            topic: event.eventSessions[0].topic ?? "",
          },
        }
      : {}),
    ...(event.type === "SERIES"
      ? {
          sessions: event.eventSessions.map((s) => ({
            sessionDate: s.sessionDate.slice(0, 10),
            startTime: s.startTime ?? "",
            endTime: s.endTime ?? "",
            topic: s.topic ?? "",
          })),
        }
      : {}),
    formFields: event.formFields?.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      options: f.options,
      required: f.required,
    })),
  };

  const statusInfo = {
    label: eventStatusLabels[event.status] ?? event.status,
    className: eventStatusClassNames[event.status] ?? "",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/events")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary" className={cn(statusInfo.className)}>
              {statusInfo.label}
            </Badge>
            {event.category && (
              <Badge variant="outline">
                {eventCategoryLabels[event.category] ?? event.category}
              </Badge>
            )}
            <Badge variant="outline">{event.type === "SINGLE" ? "單場" : "系列"}</Badge>
            <span className="text-sm text-muted-foreground">
              報名人數: {event._count.registrations}
              {event.maxParticipants ? ` / ${event.maxParticipants}` : ""}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" />
            {exporting ? "匯出中..." : "匯出 Excel"}
          </Button>
          {canWrite && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                編輯
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="size-4" />
                    刪除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>確定要刪除此活動？</AlertDialogTitle>
                    <AlertDialogDescription>
                      刪除後將同時移除所有報名、出席、作業及預算紀錄，此操作無法復原。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? "刪除中..." : "確定刪除"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList variant="line" className="w-max">
            <TabsTrigger value="info">活動資訊</TabsTrigger>
            {canReadRegistrations && <TabsTrigger value="registrations">報名</TabsTrigger>}
            {canReadAttendance && <TabsTrigger value="attendance">出席</TabsTrigger>}
            {canReadAssignments && <TabsTrigger value="assignments">作業</TabsTrigger>}
            {canReadBudget && <TabsTrigger value="budget">預算</TabsTrigger>}
            {canReadTeams && <TabsTrigger value="teams">工作小組</TabsTrigger>}
          </TabsList>
        </div>

        {/* 活動資訊 Tab */}
        <TabsContent value="info">
          <div className="space-y-6">
            {/* Event Info */}
            <Card>
              <CardHeader>
                <CardTitle>活動資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {event.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">說明</p>
                    <p className="whitespace-pre-wrap">{event.description}</p>
                  </div>
                )}
                {event.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">地點</p>
                    <p>{event.location}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">建立日期</p>
                  <p>{formatAdminDate(event.createdAt)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Status Management */}
            {canWrite && (
              <Card>
                <CardHeader>
                  <CardTitle>狀態管理</CardTitle>
                  <CardDescription>變更活動狀態</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {eventStatusFlow.map((s) => {
                      const isCurrent = event.status === s;
                      return (
                        <Button
                          key={s}
                          variant={isCurrent ? "default" : "outline"}
                          size="sm"
                          disabled={isCurrent}
                          onClick={() => handleStatusChange(s)}
                        >
                          {eventStatusLabels[s]}
                        </Button>
                      );
                    })}
                  </div>
                  {nextStatus && (
                    <p className="text-sm text-muted-foreground mt-2">
                      下一步：{eventStatusLabels[nextStatus]}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>場次列表 ({event.eventSessions.length} 場)</CardTitle>
              </CardHeader>
              <CardContent>
                {event.eventSessions.length === 0 ? (
                  <p className="text-muted-foreground">尚無場次</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>堂次</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead>時間</TableHead>
                          <TableHead>主題</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {event.eventSessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell>第 {session.sessionNo} 堂</TableCell>
                            <TableCell>{formatAdminDate(session.sessionDate)}</TableCell>
                            <TableCell>
                              {session.startTime && session.endTime
                                ? `${session.startTime} - ${session.endTime}`
                                : (session.startTime ?? "-")}
                            </TableCell>
                            <TableCell>{session.topic ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 報名 Tab */}
        {canReadRegistrations && (
          <TabsContent value="registrations">
            <RegistrationsPanel eventId={eventId} />
          </TabsContent>
        )}

        {/* 出席 Tab */}
        {canReadAttendance && (
          <TabsContent value="attendance">
            <AttendancePanel eventId={eventId} />
          </TabsContent>
        )}

        {/* 作業 Tab */}
        {canReadAssignments && (
          <TabsContent value="assignments">
            <AssignmentsPanel eventId={eventId} />
          </TabsContent>
        )}

        {/* 預算 Tab */}
        {canReadBudget && (
          <TabsContent value="budget">
            <BudgetPanel eventId={eventId} />
          </TabsContent>
        )}

        {/* 工作小組 Tab */}
        {canReadTeams && (
          <TabsContent value="teams">
            <EventTeamsSection eventId={eventId} canWrite={canWriteTeams} />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Dialog */}
      {canWrite && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>編輯活動</DialogTitle>
            </DialogHeader>
            <EventForm
              mode="edit"
              defaultValues={editDefaults}
              onSubmit={handleEdit}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
