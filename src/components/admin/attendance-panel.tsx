"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { QrCode, Users, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { useAdminPermissions } from "@/contexts/admin-permissions";

// ── Types ──────────────────────────────────────────────────────────

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

interface AttendanceRecord {
  id: string;
  userId: string;
  checkedInAt: string;
  isLate: boolean;
  lateMinutes: number;
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

interface CombinedAttendanceRow {
  userId: string;
  userName: string;
  phone: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  isLate: boolean;
  lateMinutes: number;
  attendanceId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatSessionLabel(session: EventSession): string {
  const date = new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.sessionDate));
  const topic = session.topic ? ` - ${session.topic}` : "";
  return `第 ${session.sessionNo} 堂 (${date})${topic}`;
}

// ── Component ──────────────────────────────────────────────────────

interface AttendancePanelProps {
  eventId: string;
}

export function AttendancePanel({ eventId }: AttendancePanelProps) {
  const { canWrite } = useAdminPermissions("attendance");

  // Session selector state
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // QR code state
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [checkInUrl, setCheckInUrl] = useState<string>("");

  // Attendance / registrations state
  const [combinedRows, setCombinedRows] = useState<CombinedAttendanceRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // Bulk check-in state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set()
  );
  const [bulkCheckInLoading, setBulkCheckInLoading] = useState(false);

  // ── Fetch sessions ──

  const fetchSessions = useCallback(async () => {
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
  }, [eventId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── Generate QR code when session changes ──

  useEffect(() => {
    if (!selectedSessionId) {
      setQrCodeDataUrl("");
      setCheckInUrl("");
      return;
    }

    const url = `${window.location.origin}/check-in/${selectedSessionId}`;
    setCheckInUrl(url);

    let cancelled = false;
    generateQRCodeDataURL(url).then((dataUrl) => {
      if (!cancelled) setQrCodeDataUrl(dataUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  // ── Fetch attendance + registrations and combine ──

  const fetchAttendanceData = useCallback(
    async (sessionId: string) => {
      try {
        setAttendanceLoading(true);
        setAttendanceError(null);
        setSelectedUserIds(new Set());

        const [attendanceRes, registrationsRes] = await Promise.all([
          fetch(`/api/attendance?eventSessionId=${sessionId}`),
          fetch(`/api/registrations?eventId=${eventId}`),
        ]);

        if (!attendanceRes.ok) throw new Error("無法取得出席紀錄");
        if (!registrationsRes.ok) throw new Error("無法取得報名資料");

        const attendanceData: AttendanceRecord[] =
          await attendanceRes.json();
        const registrationsData: Registration[] =
          await registrationsRes.json();

        const attendanceMap = new Map<string, AttendanceRecord>();
        for (const record of attendanceData) {
          attendanceMap.set(record.userId, record);
        }

        const confirmedRegistrations = registrationsData.filter(
          (r) => r.status === "REGISTERED"
        );

        const rows: CombinedAttendanceRow[] = confirmedRegistrations.map(
          (reg) => {
            const att = attendanceMap.get(reg.user.id);
            return {
              userId: reg.user.id,
              userName: reg.user.name,
              phone: reg.user.phone,
              checkedIn: !!att,
              checkedInAt: att?.checkedInAt ?? null,
              isLate: att?.isLate ?? false,
              lateMinutes: att?.lateMinutes ?? 0,
              attendanceId: att?.id ?? null,
            };
          }
        );

        setCombinedRows(rows);
      } catch (err) {
        setAttendanceError(
          err instanceof Error ? err.message : "發生未知錯誤"
        );
      } finally {
        setAttendanceLoading(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (selectedSessionId) {
      fetchAttendanceData(selectedSessionId);
    } else {
      setCombinedRows([]);
      setSelectedUserIds(new Set());
    }
  }, [selectedSessionId, fetchAttendanceData]);

  // ── Checkbox handlers ──

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
    const uncheckedUserIds = combinedRows
      .filter((r) => !r.checkedIn)
      .map((r) => r.userId);

    if (uncheckedUserIds.every((id) => selectedUserIds.has(id))) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(uncheckedUserIds));
    }
  }

  // ── Bulk check-in ──

  async function handleBulkCheckIn() {
    if (selectedUserIds.size === 0 || !selectedSessionId) return;

    try {
      setBulkCheckInLoading(true);
      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSessionId: selectedSessionId,
          userIds: Array.from(selectedUserIds),
        }),
      });

      if (!res.ok) throw new Error("批次報到失敗");

      toast.success(`已成功為 ${selectedUserIds.size} 人報到`);
      setSelectedUserIds(new Set());

      if (selectedSessionId) {
        fetchAttendanceData(selectedSessionId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBulkCheckInLoading(false);
    }
  }

  // ── Derived values ──

  const checkedInCount = combinedRows.filter((r) => r.checkedIn).length;
  const totalCount = combinedRows.length;
  const uncheckedRows = combinedRows.filter((r) => !r.checkedIn);
  const allUncheckedSelected =
    uncheckedRows.length > 0 &&
    uncheckedRows.every((r) => selectedUserIds.has(r.userId));

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Session selector */}
      <Card>
        <CardHeader>
          <CardTitle>選擇場次</CardTitle>
          <CardDescription>請選擇要管理的場次</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <p className="text-muted-foreground text-sm">載入場次中...</p>
          ) : (
            <Select
              value={selectedSessionId}
              onValueChange={setSelectedSessionId}
            >
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder="請選擇場次" />
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
        </CardContent>
      </Card>

      {/* Empty state: no session selected */}
      {!selectedSessionId && !sessionsLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">請選擇場次以查看出席紀錄</p>
        </div>
      )}

      {/* Tabs: QR Code & Manual check-in */}
      {selectedSessionId && (
        <Tabs defaultValue="qrcode">
          <TabsList>
            <TabsTrigger value="qrcode" className="gap-1.5">
              <QrCode className="size-4" />
              QR Code 報到
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-1.5">
              <Users className="size-4" />
              手動點名
            </TabsTrigger>
          </TabsList>

          {/* ── QR Code Tab ── */}
          <TabsContent value="qrcode">
            <Card>
              <CardHeader>
                <CardTitle>QR Code 報到</CardTitle>
                <CardDescription>
                  掃描下方 QR Code 即可完成報到
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 py-8 print:py-4">
                {qrCodeDataUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeDataUrl}
                      alt="報到 QR Code"
                      className="size-72 rounded-lg border p-2 sm:size-96"
                    />
                    <p className="text-muted-foreground max-w-md break-all text-center text-sm">
                      {checkInUrl}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    產生 QR Code 中...
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Manual Check-in Tab ── */}
          <TabsContent value="manual">
            {attendanceLoading && (
              <div className="flex justify-center py-12">
                <p className="text-muted-foreground">載入中...</p>
              </div>
            )}

            {attendanceError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {attendanceError}
              </div>
            )}

            {!attendanceLoading && !attendanceError && (
              <div className="space-y-4">
                {/* Summary bar */}
                <Card>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-2">
                      <Users className="text-muted-foreground size-5" />
                      <span className="text-sm font-medium">
                        已報到 {checkedInCount} / 已報名 {totalCount} 人
                      </span>
                    </div>
                    {canWrite && selectedUserIds.size > 0 && (
                      <Button
                        onClick={handleBulkCheckIn}
                        disabled={bulkCheckInLoading}
                        size="sm"
                      >
                        <Check className="size-4" />
                        {bulkCheckInLoading
                          ? "報到中..."
                          : `批次報到 (${selectedUserIds.size} 人)`}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Attendance table */}
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
                                checked={allUncheckedSelected}
                                onCheckedChange={toggleSelectAll}
                                aria-label="全選未報到人員"
                                disabled={uncheckedRows.length === 0}
                              />
                            </TableHead>
                          )}
                          <TableHead>姓名</TableHead>
                          <TableHead>報到狀態</TableHead>
                          <TableHead>報到時間</TableHead>
                          <TableHead>遲到</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {combinedRows.map((row) => (
                          <TableRow key={row.userId}>
                            {canWrite && (
                              <TableCell>
                                {!row.checkedIn && (
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
                              {row.checkedIn ? (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  )}
                                >
                                  已報到
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  )}
                                >
                                  未報到
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.checkedInAt
                                ? formatDateTime(row.checkedInAt)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.isLate && row.lateMinutes > 0 ? (
                                <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                                  <Clock className="size-3.5" />
                                  遲到 {row.lateMinutes} 分鐘
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  —
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
