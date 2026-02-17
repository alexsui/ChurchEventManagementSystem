"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface EventItem {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  _count: {
    eventSessions: number;
    registrations: number;
  };
}

interface Registration {
  id: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    phone: string;
  };
  eventSession: {
    sessionNo: number;
    sessionDate: string;
  };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "已報名", className: "bg-green-100 text-green-700" },
  WAITLISTED: { label: "候補", className: "bg-yellow-100 text-yellow-700" },
  CANCELLED: { label: "已取消", className: "bg-red-100 text-red-700" },
};

const statusFilterOptions = [
  { value: "ALL", label: "全部" },
  { value: "CONFIRMED", label: "已報名" },
  { value: "WAITLISTED", label: "候補" },
  { value: "CANCELLED", label: "已取消" },
];

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export default function RegistrationsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState<string | null>(
    null
  );

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      setEventsError(null);
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error("無法取得活動列表");
      }
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setEventsError(
        err instanceof Error ? err.message : "發生未知錯誤"
      );
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const fetchRegistrations = useCallback(async (eventId: string) => {
    try {
      setRegistrationsLoading(true);
      setRegistrationsError(null);
      const res = await fetch(`/api/registrations?eventId=${eventId}`);
      if (!res.ok) {
        throw new Error("無法取得報名資料");
      }
      const data = await res.json();
      setRegistrations(data);
    } catch (err) {
      setRegistrationsError(
        err instanceof Error ? err.message : "發生未知錯誤"
      );
    } finally {
      setRegistrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (selectedEventId) {
      fetchRegistrations(selectedEventId);
    } else {
      setRegistrations([]);
    }
  }, [selectedEventId, fetchRegistrations]);

  async function handleCancel(registrationId: string, userName: string) {
    const confirmed = window.confirm(
      `確定要取消 ${userName} 的報名嗎？`
    );
    if (!confirmed) return;

    try {
      setCancellingId(registrationId);
      const res = await fetch(`/api/registrations/${registrationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("取消報名失敗");
      }
      toast.success(`已取消 ${userName} 的報名`);
      if (selectedEventId) {
        fetchRegistrations(selectedEventId);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "操作失敗"
      );
    } finally {
      setCancellingId(null);
    }
  }

  const filteredRegistrations =
    statusFilter === "ALL"
      ? registrations
      : registrations.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">報名管理</h1>
        <p className="text-muted-foreground text-sm">
          管理活動報名資料
        </p>
      </div>

      {/* Event Selector */}
      <Card>
        <CardHeader>
          <CardTitle>選擇活動</CardTitle>
          <CardDescription>
            請選擇要查看報名資料的活動
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
              <Select
                value={selectedEventId}
                onValueChange={(value) => {
                  setSelectedEventId(value);
                  setStatusFilter("ALL");
                }}
              >
                <SelectTrigger className="w-full sm:w-[320px]">
                  <SelectValue placeholder="請選擇活動" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} ({event._count.registrations} 人報名)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedEventId && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty state: no event selected */}
      {!selectedEventId && !eventsLoading && !eventsError && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            請選擇活動以查看報名資料
          </p>
        </div>
      )}

      {/* Loading registrations */}
      {selectedEventId && registrationsLoading && (
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">載入中...</p>
        </div>
      )}

      {/* Error loading registrations */}
      {selectedEventId && registrationsError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {registrationsError}
        </div>
      )}

      {/* Empty state: no registrations */}
      {selectedEventId &&
        !registrationsLoading &&
        !registrationsError &&
        registrations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              此活動尚無報名資料
            </p>
          </div>
        )}

      {/* Registrations table */}
      {selectedEventId &&
        !registrationsLoading &&
        !registrationsError &&
        registrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                報名列表 ({filteredRegistrations.length} 筆)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRegistrations.length === 0 ? (
                <div className="flex justify-center py-8">
                  <p className="text-muted-foreground">
                    無符合篩選條件的報名資料
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>姓名</TableHead>
                        <TableHead>電話</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>報名時間</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegistrations.map((reg) => {
                        const statusInfo = statusConfig[reg.status] ?? {
                          label: reg.status,
                          className: "",
                        };
                        return (
                          <TableRow key={reg.id}>
                            <TableCell className="font-medium">
                              {reg.user.name}
                            </TableCell>
                            <TableCell>{reg.user.phone}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn(statusInfo.className)}
                              >
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatDateTime(reg.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {reg.status !== "CANCELLED" && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={cancellingId === reg.id}
                                  onClick={() =>
                                    handleCancel(reg.id, reg.user.name)
                                  }
                                >
                                  {cancellingId === reg.id
                                    ? "取消中..."
                                    : "取消報名"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
