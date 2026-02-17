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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/contexts/admin-permissions";

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
  REGISTERED: { label: "已報名", className: "bg-green-100 text-green-700" },
  WAITLISTED: { label: "候補", className: "bg-yellow-100 text-yellow-700" },
  CANCELLED: { label: "已取消", className: "bg-red-100 text-red-700" },
};

const statusFilterOptions = [
  { value: "ALL", label: "全部" },
  { value: "REGISTERED", label: "已報名" },
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

interface RegistrationsPanelProps {
  eventId: string;
}

export function RegistrationsPanel({ eventId }: RegistrationsPanelProps) {
  const { canWrite } = useAdminPermissions("registrations");

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState<string | null>(
    null
  );

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async () => {
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
  }, [eventId]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  async function handleCancel(registrationId: string, userName: string) {
    const confirmed = window.confirm(`確定要取消 ${userName} 的報名嗎？`);
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
      fetchRegistrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setCancellingId(null);
    }
  }

  const filteredRegistrations =
    statusFilter === "ALL"
      ? registrations
      : registrations.filter((r) => r.status === statusFilter);

  if (registrationsLoading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (registrationsError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {registrationsError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-4">
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
      </div>

      {/* Empty state */}
      {registrations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">此活動尚無報名資料</p>
        </div>
      )}

      {/* Registrations table */}
      {registrations.length > 0 && (
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
                      {canWrite && (
                        <TableHead className="text-right">操作</TableHead>
                      )}
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
                          {canWrite && (
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
                          )}
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
