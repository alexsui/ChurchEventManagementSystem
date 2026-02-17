"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EventForm,
  type EventFormSubmitData,
  type EventFormDefaultValues,
} from "@/components/shared/event-form";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/contexts/admin-permissions";
import { EventTeamsSection } from "@/components/shared/event-teams-section";
import { RegistrationsPanel } from "@/components/admin/registrations-panel";
import { AttendancePanel } from "@/components/admin/attendance-panel";
import { AssignmentsPanel } from "@/components/admin/assignments-panel";
import { BudgetPanel } from "@/components/admin/budget-panel";

interface EventSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
}

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: "COURSE" | "LECTURE" | "CAMP" | null;
  type: "SINGLE" | "SERIES";
  status: "PLANNING" | "OPEN" | "IN_PROGRESS" | "COMPLETED";
  registrationMode: "PER_SESSION" | "FULL_SERIES";
  maxParticipants: number | null;
  minAssignmentRate: number | null;
  createdAt: string;
  eventSessions: EventSession[];
  _count: { registrations: number };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  PLANNING: { label: "企劃中", className: "bg-gray-100 text-gray-700" },
  OPEN: { label: "報名中", className: "bg-green-100 text-green-700" },
  IN_PROGRESS: { label: "進行中", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "已結束", className: "bg-slate-100 text-slate-700" },
};

const categoryLabels: Record<string, string> = {
  COURSE: "課程",
  LECTURE: "講座",
  CAMP: "營會",
};

const statusFlow = ["PLANNING", "OPEN", "IN_PROGRESS", "COMPLETED"] as const;

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateStr));
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { canWrite } = useAdminPermissions("events");
  const { canRead: canReadTeams, canWrite: canWriteTeams } =
    useAdminPermissions("teams");
  const { canRead: canReadRegistrations } =
    useAdminPermissions("registrations");
  const { canRead: canReadAttendance } = useAdminPermissions("attendance");
  const { canRead: canReadAssignments } = useAdminPermissions("assignments");
  const { canRead: canReadBudget } = useAdminPermissions("budget");

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const currentStatusIndex = statusFlow.indexOf(
    event.status as (typeof statusFlow)[number]
  );
  const nextStatus =
    currentStatusIndex < statusFlow.length - 1
      ? statusFlow[currentStatusIndex + 1]
      : null;

  const editDefaults: EventFormDefaultValues = {
    title: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    category: event.category ?? undefined,
    type: event.type,
    registrationMode: event.registrationMode,
    maxParticipants: event.maxParticipants,
    minAssignmentRate:
      event.minAssignmentRate != null
        ? event.minAssignmentRate * 100
        : undefined,
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
  };

  const statusInfo = statusConfig[event.status] ?? {
    label: event.status,
    className: "",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/events")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className={cn(statusInfo.className)}>
              {statusInfo.label}
            </Badge>
            {event.category && (
              <Badge variant="outline">
                {categoryLabels[event.category] ?? event.category}
              </Badge>
            )}
            <Badge variant="outline">
              {event.type === "SINGLE" ? "單場" : "系列"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              報名人數: {event._count.registrations}
              {event.maxParticipants ? ` / ${event.maxParticipants}` : ""}
            </span>
          </div>
        </div>
        {canWrite && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            編輯
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList variant="line">
          <TabsTrigger value="info">活動資訊</TabsTrigger>
          {canReadRegistrations && (
            <TabsTrigger value="registrations">報名</TabsTrigger>
          )}
          {canReadAttendance && (
            <TabsTrigger value="attendance">出席</TabsTrigger>
          )}
          {canReadAssignments && (
            <TabsTrigger value="assignments">作業</TabsTrigger>
          )}
          {canReadBudget && (
            <TabsTrigger value="budget">預算</TabsTrigger>
          )}
        </TabsList>

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
                    <p className="text-sm font-medium text-muted-foreground">
                      說明
                    </p>
                    <p className="whitespace-pre-wrap">{event.description}</p>
                  </div>
                )}
                {event.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      地點
                    </p>
                    <p>{event.location}</p>
                  </div>
                )}
                {event.type === "SERIES" && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      報名模式
                    </p>
                    <p>
                      {event.registrationMode === "PER_SESSION"
                        ? "單場報名"
                        : "整期報名"}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    建立日期
                  </p>
                  <p>{formatDate(event.createdAt)}</p>
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
                    {statusFlow.map((s) => {
                      const info = statusConfig[s];
                      const isCurrent = event.status === s;
                      return (
                        <Button
                          key={s}
                          variant={isCurrent ? "default" : "outline"}
                          size="sm"
                          disabled={isCurrent}
                          onClick={() => handleStatusChange(s)}
                        >
                          {info.label}
                        </Button>
                      );
                    })}
                  </div>
                  {nextStatus && (
                    <p className="text-sm text-muted-foreground mt-2">
                      下一步：{statusConfig[nextStatus].label}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>
                  場次列表 ({event.eventSessions.length} 場)
                </CardTitle>
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
                            <TableCell>
                              {formatDate(session.sessionDate)}
                            </TableCell>
                            <TableCell>
                              {session.startTime && session.endTime
                                ? `${session.startTime} - ${session.endTime}`
                                : session.startTime ?? "-"}
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

            {/* Event Teams */}
            {canReadTeams && (
              <EventTeamsSection
                eventId={eventId}
                canWrite={canWriteTeams}
              />
            )}
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
