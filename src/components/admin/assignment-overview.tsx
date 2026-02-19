"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn, isSessionPast } from "@/lib/utils";
import { formatSessionColumnHeader } from "@/lib/formatters";

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

interface AssignmentSummaryRecord {
  id: string;
  eventSessionId: string;
  title: string;
  completions: { userId: string }[];
}

interface AssignmentOverviewProps {
  eventId: string;
}

export function AssignmentOverview({ eventId }: AssignmentOverviewProps) {
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummaryRecord[]>([]);
  const [minAssignmentRate, setMinAssignmentRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventRes, regRes, asgRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/registrations?eventId=${eventId}`),
        fetch(`/api/events/${eventId}/assignment-summary`),
      ]);

      if (!eventRes.ok) throw new Error("無法取得活動資料");
      if (!regRes.ok) throw new Error("無法取得報名資料");
      if (!asgRes.ok) throw new Error("無法取得作業摘要");

      const eventData = await eventRes.json();
      const regData: Registration[] = await regRes.json();
      const asgData: AssignmentSummaryRecord[] = await asgRes.json();

      setSessions(eventData.eventSessions ?? []);
      setRegistrations(regData.filter((r) => r.status === "REGISTERED"));
      setAssignments(asgData);
      setMinAssignmentRate(
        eventData.minAssignmentRate != null
          ? eventData.minAssignmentRate
          : null
      );
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

  // Group assignments by sessionId
  const assignmentsBySession = new Map<string, AssignmentSummaryRecord[]>();
  for (const a of assignments) {
    const list = assignmentsBySession.get(a.eventSessionId) ?? [];
    list.push(a);
    assignmentsBySession.set(a.eventSessionId, list);
  }

  // Build completion lookup: Set of "userId:assignmentId"
  const completionSet = new Set<string>();
  for (const a of assignments) {
    for (const c of a.completions) {
      completionSet.add(`${c.userId}:${a.id}`);
    }
  }

  // Sessions with assignments are considered "resolved"
  const sessionsWithAssignments = new Set(
    assignments.map((a) => a.eventSessionId)
  );

  // A session is "resolved" if it's past OR has assignments already
  const isSessionResolved = (s: EventSession) =>
    isSessionPast(s) || sessionsWithAssignments.has(s.id);

  const allSessionsResolved = sessions.every(isSessionResolved);
  const showResult = minAssignmentRate != null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-30">姓名</TableHead>
                {sessions.map((s) => (
                  <TableHead key={s.id} className="text-center whitespace-nowrap">
                    {formatSessionColumnHeader(s)}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">繳交率</TableHead>
                {showResult && (
                  <TableHead className="text-center whitespace-nowrap">結果</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => {
                let totalAssignments = 0;
                let totalCompleted = 0;

                const cells = sessions.map((s) => {
                  const resolved = isSessionResolved(s);
                  if (!resolved) {
                    return { sessionId: s.id, display: "N/A", style: "text-muted-foreground" };
                  }

                  const sessionAssignments = assignmentsBySession.get(s.id);
                  if (!sessionAssignments || sessionAssignments.length === 0) {
                    return { sessionId: s.id, display: "—", style: "text-muted-foreground" };
                  }

                  const total = sessionAssignments.length;
                  const completed = sessionAssignments.filter((a) =>
                    completionSet.has(`${reg.user.id}:${a.id}`)
                  ).length;

                  totalAssignments += total;
                  totalCompleted += completed;

                  const allDone = completed === total;
                  return {
                    sessionId: s.id,
                    display: `${completed}/${total}`,
                    style: allDone
                      ? "text-green-600 dark:text-green-400 font-medium"
                      : "text-amber-600 dark:text-amber-400",
                  };
                });

                const canShowRate = allSessionsResolved;
                const rate =
                  canShowRate && totalAssignments > 0
                    ? totalCompleted / totalAssignments
                    : null;
                const rateDisplay =
                  rate != null ? `${Math.round(rate * 100)}%` : "N/A";

                const passed =
                  rate != null && minAssignmentRate != null
                    ? rate >= minAssignmentRate
                    : null;

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
                      {rate != null ? (
                        rateDisplay
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    {showResult && (
                      <TableCell className="text-center">
                        {passed == null ? (
                          <span className="text-muted-foreground">N/A</span>
                        ) : passed ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            )}
                          >
                            通過
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            )}
                          >
                            未通過
                          </Badge>
                        )}
                      </TableCell>
                    )}
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
