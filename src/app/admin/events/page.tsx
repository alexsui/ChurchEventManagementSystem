"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  eventStatusLabels,
  eventCategoryLabels,
  eventTypeLabels,
  eventStatusClassNames,
} from "@/lib/constants";
import { formatAdminDate } from "@/lib/formatters";
import { useAdminPermissions } from "@/contexts/admin-permissions";

interface EventItem {
  id: string;
  title: string;
  category: "COURSE" | "LECTURE" | "CAMP" | null;
  type: "SINGLE" | "SERIES";
  status: "PLANNING" | "OPEN" | "IN_PROGRESS" | "COMPLETED";
  createdAt: string;
  _count: {
    eventSessions: number;
    registrations: number;
  };
}

export default function EventsPage() {
  const router = useRouter();
  const { canWrite } = useAdminPermissions("events");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error("無法取得活動列表");
      }
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">活動管理</h1>
          <p className="text-muted-foreground text-sm">管理所有教會活動</p>
        </div>
        {canWrite && (
          <Button onClick={() => router.push("/admin/events/new")}>
            <Plus className="size-4" />
            新增活動
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">載入中...</p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">尚無活動</p>
          {canWrite && (
            <Button onClick={() => router.push("/admin/events/new")}>
              <Plus className="size-4" />
              新增第一個活動
            </Button>
          )}
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>活動名稱</TableHead>
                <TableHead>類別</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">報名人數</TableHead>
                <TableHead>建立日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                return (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/events/${event.id}`)}
                  >
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell>
                      {event.category ? (
                        <Badge variant="outline">
                          {eventCategoryLabels[event.category] ?? event.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{eventTypeLabels[event.type] ?? event.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(eventStatusClassNames[event.status])}
                      >
                        {eventStatusLabels[event.status] ?? event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{event._count.registrations}</TableCell>
                    <TableCell>{formatAdminDate(event.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
