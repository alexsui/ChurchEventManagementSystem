"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminPermissions } from "@/contexts/admin-permissions";
import { punchErrorMessages, punchNavLabel } from "@/lib/constants";
import { formatDateOnlyDisplay } from "@/lib/taipei-date";

interface PunchActivitySummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  memberCount: number;
}

export default function PunchActivitiesPage() {
  const router = useRouter();
  const { canWrite } = useAdminPermissions("attendance");
  const [activities, setActivities] = useState<PunchActivitySummary[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch("/api/punch-activities");
      if (!res.ok) throw new Error();
      setActivities(await res.json());
    } catch {
      toast.error("無法載入打卡活動");
      setActivities([]);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/punch-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(punchErrorMessages[data.code] ?? data.error ?? "建立失敗");
        return;
      }
      toast.success("已建立打卡活動");
      router.push(`/admin/punch/${data.id}`);
    } catch {
      toast.error("建立失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{punchNavLabel}</h1>
        {canWrite && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            新增打卡活動
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名稱</TableHead>
              <TableHead>打卡期間</TableHead>
              <TableHead className="text-right">成員數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities === null ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  載入中...
                </TableCell>
              </TableRow>
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  尚無打卡活動
                </TableCell>
              </TableRow>
            ) : (
              activities.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/punch/${a.id}`)}
                >
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>
                    {formatDateOnlyDisplay(a.startDate)} – {formatDateOnlyDisplay(a.endDate)}
                  </TableCell>
                  <TableCell className="text-right">{a.memberCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增打卡活動</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="punch-title">名稱</Label>
              <Input
                id="punch-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="punch-start">開始日期</Label>
                <Input
                  id="punch-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="punch-end">結束日期</Label>
                <Input
                  id="punch-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "建立中..." : "建立"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
