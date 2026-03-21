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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { registrationStatusLabels, registrationStatusClassNames } from "@/lib/constants";
import { formatDateTime } from "@/lib/formatters";
import { useAdminPermissions } from "@/contexts/admin-permissions";

interface FormResponseWithField {
  fieldId: string;
  value: string;
  field: {
    id: string;
    type: string;
    label: string;
    sortOrder: number;
  };
}

interface FormField {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
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
  formResponses?: FormResponseWithField[];
}

const statusFilterOptions = [
  { value: "ALL", label: "全部" },
  ...Object.entries(registrationStatusLabels).map(([value, label]) => ({ value, label })),
];

interface RegistrationsPanelProps {
  eventId: string;
}

export function RegistrationsPanel({ eventId }: RegistrationsPanelProps) {
  const { canWrite } = useAdminPermissions("registrations");

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setRegistrationsLoading(true);
      setRegistrationsError(null);

      const [regRes, fieldsRes] = await Promise.all([
        fetch(`/api/registrations?eventId=${eventId}`),
        fetch(`/api/events/${eventId}/form-fields?admin=true`),
      ]);

      if (!regRes.ok) throw new Error("無法取得報名資料");
      const regData = await regRes.json();
      setRegistrations(regData);

      if (fieldsRes.ok) {
        const fieldsData = await fieldsRes.json();
        setFormFields(fieldsData);
      }
    } catch (err) {
      setRegistrationsError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setRegistrationsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setCancellingId(null);
    }
  }

  const filteredRegistrations =
    statusFilter === "ALL" ? registrations : registrations.filter((r) => r.status === statusFilter);

  const sortedFormFields = [...formFields].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasFormFields = sortedFormFields.length > 0;

  // Build response lookup: registrationId -> { fieldId -> value }
  function getResponseValue(reg: Registration, fieldId: string): string {
    const response = reg.formResponses?.find((r) => r.fieldId === fieldId);
    return response?.value ?? "";
  }

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
            <CardTitle>報名列表 ({filteredRegistrations.length} 筆)</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRegistrations.length === 0 ? (
              <div className="flex justify-center py-8">
                <p className="text-muted-foreground">無符合篩選條件的報名資料</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">姓名</TableHead>
                      <TableHead>電話</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>報名時間</TableHead>
                      {hasFormFields &&
                        sortedFormFields.map((field) => (
                          <TableHead key={field.id} className="whitespace-nowrap">
                            {field.label}
                          </TableHead>
                        ))}
                      {canWrite && <TableHead className="text-right">操作</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistrations.map((reg) => {
                      return (
                        <TableRow key={reg.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {reg.user.name}
                          </TableCell>
                          <TableCell>{reg.user.phone}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(registrationStatusClassNames[reg.status])}
                            >
                              {registrationStatusLabels[reg.status] ?? reg.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(reg.createdAt)}
                          </TableCell>
                          {hasFormFields &&
                            sortedFormFields.map((field) => (
                              <TableCell key={field.id} className="whitespace-nowrap">
                                {getResponseValue(reg, field.id)}
                              </TableCell>
                            ))}
                          {canWrite && (
                            <TableCell className="text-right">
                              {reg.status !== "CANCELLED" && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={cancellingId === reg.id}
                                  onClick={() => handleCancel(reg.id, reg.user.name)}
                                >
                                  {cancellingId === reg.id ? "取消中..." : "取消報名"}
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
