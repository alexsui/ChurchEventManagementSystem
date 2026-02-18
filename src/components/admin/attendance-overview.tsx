"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { isSessionPast } from "@/lib/utils";

interface EventSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  topic: string;
}

interface Registration {
  id: string;
  status: string;
  user: { id: string; name: string; phone: string };
}

interface AttendanceSummaryRecord {
  userId: string;
  eventSessionId: string;
}

interface AttendanceOverviewProps {
  eventId: string;
}

function formatSessionColumnHeader(session: EventSession): string {
  const date = new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.sessionDate));
  return `第${session.sessionNo}堂 (${date})`;
}

export function AttendanceOverview({ eventId }: AttendanceOverviewProps) {
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventRes, regRes, attRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/registrations?eventId=${eventId}`),
        fetch(`/api/events/${eventId}/attendance-summary`),
      ]);

      if (!eventRes.ok) throw new Error("無法取得活動資料");
      if (!regRes.ok) throw new Error("無法取得報名資料");
      if (!attRes.ok) throw new Error("無法取得出席摘要");

      const eventData = await eventRes.json();
      const regData: Registration[] = await regRes.json();
      const attData: AttendanceSummaryRecord[] = await attRes.json();

      setSessions(eventData.eventSessions ?? []);
      setRegistrations(regData.filter((r) => r.status === "REGISTERED"));
      setAttendanceRecords(attData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
      toast.error(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">尚無報名資料</p>
      </div>
    );
  }

  // Build a Set for fast lookup: "userId:sessionId"
  const attendanceSet = new Set(
    attendanceRecords.map((r) => `${r.userId}:${r.eventSessionId}`)
  );

  const allSessionsPast = sessions.every((s) => isSessionPast(s));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">姓名</TableHead>
                {sessions.map((s) => (
                  <TableHead key={s.id} className="text-center whitespace-nowrap">
                    {formatSessionColumnHeader(s)}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">出席率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => {
                let attendedCount = 0;
                let pastSessionCount = 0;

                const cells = sessions.map((s) => {
                  const past = isSessionPast(s);
                  if (!past) {
                    return { sessionId: s.id, display: "N/A", style: "text-muted-foreground" };
                  }
                  pastSessionCount++;
                  const attended = attendanceSet.has(`${reg.user.id}:${s.id}`);
                  if (attended) attendedCount++;
                  return {
                    sessionId: s.id,
                    display: attended ? "✓" : "✗",
                    style: attended
                      ? "text-green-600 dark:text-green-400 font-medium"
                      : "text-red-500 dark:text-red-400",
                  };
                });

                const rate =
                  allSessionsPast && pastSessionCount > 0
                    ? `${Math.round((attendedCount / pastSessionCount) * 100)}%`
                    : "N/A";

                return (
                  <TableRow key={reg.user.id}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      {reg.user.name}
                    </TableCell>
                    {cells.map((cell) => (
                      <TableCell key={cell.sessionId} className={`text-center ${cell.style}`}>
                        {cell.display}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">
                      {rate === "N/A" ? (
                        <span className="text-muted-foreground">{rate}</span>
                      ) : (
                        rate
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
