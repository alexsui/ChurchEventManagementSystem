"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarCheck, Download, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QRCodeDisplay } from "@/components/shared/qrcode-display";
import { useAdminPermissions } from "@/contexts/admin-permissions";
import { punchErrorMessages, punchNavLabel } from "@/lib/constants";
import { formatPercent } from "@/lib/formatters";
import { exportPunchStatsToExcel } from "@/lib/excel-export";
import {
  taipeiToday,
  formatDateOnlyDisplay,
  formatDateOnlyWithWeekday,
  formatTaipeiClock,
} from "@/lib/taipei-date";

interface PunchRecordItem {
  id: string;
  date: string;
  punchedAt: string;
  /** Admin who made up the punch; null = self check-in */
  punchedBy: { name: string | null } | null;
}

interface MemberStats {
  memberId: string;
  userId: string;
  name: string | null;
  phone: string | null;
  joinedOn: string;
  leftOn: string | null;
  attendedDates: string[];
  attended: number;
  eligible: number;
  rate: number | null;
  records: PunchRecordItem[];
}

interface ActivityDetail {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  dates: { date: string; count: number }[];
  members: MemberStats[];
}

interface UserResult {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface ConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

/** Send a JSON request; on failure show a toast and return null. */
async function send(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(punchErrorMessages[data.code] ?? data.error ?? "操作失敗");
      return null;
    }
    return data;
  } catch {
    toast.error("網路連線錯誤");
    return null;
  }
}

export default function PunchActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const router = useRouter();
  const { canWrite } = useAdminPermissions("attendance");
  const apiBase = `/api/punch-activities/${activityId}`;

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [punchUrl, setPunchUrl] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  // Edit activity dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [joinedOn, setJoinedOn] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // Edit member dialog
  const [editingMember, setEditingMember] = useState<MemberStats | null>(null);
  const [memberJoined, setMemberJoined] = useState("");
  const [memberLeft, setMemberLeft] = useState("");

  // Member punch records dialog (補打卡)
  const [recordsMemberId, setRecordsMemberId] = useState<string | null>(null);
  const [makeUpDate, setMakeUpDate] = useState("");

  const fetchDetail = useCallback(async () => {
    const res = await fetch(apiBase);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (!res.ok) {
      toast.error("無法載入打卡活動");
      return;
    }
    setDetail(await res.json());
  }, [apiBase]);

  useEffect(() => {
    fetchDetail();
    setPunchUrl(`${window.location.origin}/punch/${activityId}`);
  }, [fetchDetail, activityId]);

  function openEditActivity() {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditStart(detail.startDate);
    setEditEnd(detail.endDate);
    setEditOpen(true);
  }

  async function handleSaveActivity(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send(apiBase, "PATCH", {
      title: editTitle,
      startDate: editStart,
      endDate: editEnd,
    });
    if (!ok) return;
    toast.success("已更新");
    setEditOpen(false);
    fetchDetail();
  }

  function confirmDeleteActivity() {
    setConfirm({
      title: `刪除「${detail?.title ?? ""}」？`,
      description: "名單和打卡紀錄會一併刪除，無法復原。",
      confirmLabel: "確定刪除",
      onConfirm: async () => {
        if (await send(apiBase, "DELETE")) {
          toast.success("已刪除");
          router.push("/admin/punch");
        }
      },
    });
  }

  function openAddMember() {
    setSearch("");
    setResults([]);
    setJoinedOn(taipeiToday());
    setAddOpen(true);
  }

  function handleSearchChange(query: string) {
    setSearch(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?search=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error();
        setResults((await res.json()).data);
      } catch {
        setResults([]);
      }
    }, 300);
  }

  async function handleAddMember(userId: string) {
    const ok = await send(`${apiBase}/members`, "POST", { userId, joinedOn });
    if (!ok) return;
    toast.success("已加入名單");
    fetchDetail();
  }

  function openEditMember(member: MemberStats) {
    setEditingMember(member);
    setMemberJoined(member.joinedOn);
    setMemberLeft(member.leftOn ?? "");
  }

  async function handleSaveMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    const ok = await send(`${apiBase}/members/${editingMember.memberId}`, "PATCH", {
      joinedOn: memberJoined,
      leftOn: memberLeft || null,
    });
    if (!ok) return;
    toast.success("已更新");
    setEditingMember(null);
    fetchDetail();
  }

  function confirmRemoveMember(member: MemberStats) {
    setConfirm({
      title: `將「${member.name ?? ""}」移出名單？`,
      description: "打卡紀錄會一併刪除。",
      confirmLabel: "確定移除",
      onConfirm: async () => {
        if (await send(`${apiBase}/members/${member.memberId}`, "DELETE")) {
          toast.success("已移出名單");
          fetchDetail();
        }
      },
    });
  }

  /** Selectable make-up dates: within the activity and the member's roster window, up to today. */
  function makeUpRange(member: MemberStats) {
    if (!detail) return { min: "", max: "" };
    const min = [detail.startDate, member.joinedOn].sort().at(-1)!;
    const max = [taipeiToday(), detail.endDate, member.leftOn ?? detail.endDate].sort()[0];
    return { min, max };
  }

  function openRecords(member: MemberStats) {
    setRecordsMemberId(member.memberId);
    setMakeUpDate(makeUpRange(member).max);
  }

  async function handleMakeUp(e: React.FormEvent) {
    e.preventDefault();
    if (!recordsMemberId) return;
    const ok = await send(`${apiBase}/members/${recordsMemberId}/records`, "POST", {
      date: makeUpDate,
    });
    if (!ok) return;
    toast.success("已補打卡");
    fetchDetail();
  }

  function confirmDeleteRecord(memberId: string, record: PunchRecordItem) {
    const onlyPunch = detail?.dates.find((d) => d.date === record.date)?.count === 1;
    setConfirm({
      title: `刪除 ${formatDateOnlyWithWeekday(record.date)} 的打卡？`,
      description: onlyPunch ? "這是當天唯一的打卡，這天會從團練日期移除。" : "",
      confirmLabel: "確定刪除",
      onConfirm: async () => {
        if (await send(`${apiBase}/members/${memberId}/records/${record.id}`, "DELETE")) {
          toast.success("已刪除");
          fetchDetail();
        }
      },
    });
  }

  function confirmDeleteDate(date: string, count: number) {
    setConfirm({
      title: `刪除 ${formatDateOnlyWithWeekday(date)}？`,
      description: `${count} 筆打卡紀錄會一併刪除。`,
      confirmLabel: "確定刪除",
      onConfirm: async () => {
        if (await send(`${apiBase}/dates/${date}`, "DELETE")) {
          toast.success("已刪除這天的紀錄");
          fetchDetail();
        }
      },
    });
  }

  function handleExport() {
    if (!detail) return;
    exportPunchStatsToExcel({
      title: detail.title,
      dates: detail.dates.map((d) => d.date),
      members: detail.members,
    });
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">找不到此打卡活動</p>
        <Button asChild variant="outline">
          <Link href="/admin/punch">返回{punchNavLabel}</Link>
        </Button>
      </div>
    );
  }

  if (!detail) {
    return <p className="text-muted-foreground">載入中...</p>;
  }

  const memberIds = new Set(detail.members.map((m) => m.userId));
  const searchResults = results.filter((u) => !memberIds.has(u.id));
  const recordsMember = detail.members.find((m) => m.memberId === recordsMemberId) ?? null;
  const makeUpBounds = recordsMember ? makeUpRange(recordsMember) : null;
  const makeUpIsNewDate = !!makeUpDate && !detail.dates.some((d) => d.date === makeUpDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/admin/punch"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {punchNavLabel}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{detail.title}</h1>
            <p className="text-muted-foreground text-sm">
              {formatDateOnlyDisplay(detail.startDate)} – {formatDateOnlyDisplay(detail.endDate)}
            </p>
          </div>
          {canWrite && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={openEditActivity}>
                <Pencil className="size-4" />
                編輯
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={confirmDeleteActivity}
              >
                <Trash2 className="size-4" />
                刪除
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* QR code */}
      <Card className="w-fit">
        <CardContent>
          {punchUrl && (
            <QRCodeDisplay url={punchUrl} downloadFileName={`${detail.title}_打卡QRCode.png`} />
          )}
        </CardContent>
      </Card>

      {/* Members & attendance */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">成員</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              匯出 Excel
            </Button>
            {canWrite && (
              <Button onClick={openAddMember}>
                <UserPlus className="size-4" />
                新增成員
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>電話</TableHead>
                <TableHead>加入日期</TableHead>
                <TableHead>退出日期</TableHead>
                <TableHead className="text-right">出席 / 應出席</TableHead>
                <TableHead className="text-right">出席率</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    尚無成員
                  </TableCell>
                </TableRow>
              ) : (
                detail.members.map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell className="font-medium">{m.name ?? "—"}</TableCell>
                    <TableCell>{m.phone ?? "—"}</TableCell>
                    <TableCell>{formatDateOnlyDisplay(m.joinedOn)}</TableCell>
                    <TableCell>{m.leftOn ? formatDateOnlyDisplay(m.leftOn) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {m.attended} / {m.eligible}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(m.rate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRecords(m)}
                          aria-label={`打卡紀錄 ${m.name ?? ""}`}
                        >
                          <CalendarCheck className="size-4" />
                        </Button>
                        {canWrite && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditMember(m)}
                              aria-label={`編輯 ${m.name ?? ""}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => confirmRemoveMember(m)}
                              aria-label={`移除 ${m.name ?? ""}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Rehearsal dates */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          團練日期 <span className="font-normal text-muted-foreground">{detail.dates.length}</span>
        </h2>
        <div className="rounded-lg border bg-card max-w-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead className="text-right">打卡人數</TableHead>
                {canWrite && <TableHead className="w-0" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.dates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    尚無打卡紀錄
                  </TableCell>
                </TableRow>
              ) : (
                [...detail.dates].reverse().map(({ date, count }) => (
                  <TableRow key={date}>
                    <TableCell>{formatDateOnlyWithWeekday(date)}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => confirmDeleteDate(date, count)}
                          aria-label={`刪除 ${date}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Edit activity */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleSaveActivity} className="space-y-4">
            <DialogHeader>
              <DialogTitle>編輯打卡活動</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="edit-title">名稱</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start">開始日期</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">結束日期</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                取消
              </Button>
              <Button type="submit">儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add member */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增成員</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-joined">加入日期</Label>
              <Input
                id="member-joined"
                type="date"
                value={joinedOn}
                onChange={(e) => setJoinedOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-search">搜尋使用者</Label>
              <Input
                id="member-search"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {search.trim() && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">找不到符合的使用者</p>
              )}
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="text-sm">
                    <p className="font-medium">{u.name ?? "—"}</p>
                    <p className="text-muted-foreground">{u.phone ?? u.email ?? ""}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddMember(u.id)}
                    aria-label={`加入 ${u.name ?? ""}`}
                  >
                    <Plus className="size-4" />
                    加入
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit member */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent>
          <form onSubmit={handleSaveMember} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingMember?.name ?? ""}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-joined">加入日期</Label>
                <Input
                  id="edit-joined"
                  type="date"
                  value={memberJoined}
                  onChange={(e) => setMemberJoined(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-left">退出日期</Label>
                <Input
                  id="edit-left"
                  type="date"
                  value={memberLeft}
                  onChange={(e) => setMemberLeft(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
                取消
              </Button>
              <Button type="submit">儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Member punch records + make-up punch */}
      <Dialog open={!!recordsMember} onOpenChange={(open) => !open && setRecordsMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{recordsMember?.name ?? ""}</DialogTitle>
          </DialogHeader>
          {canWrite && makeUpBounds && (
            <form onSubmit={handleMakeUp} className="space-y-2">
              <Label htmlFor="makeup-date">日期</Label>
              <div className="flex gap-2">
                <Input
                  id="makeup-date"
                  type="date"
                  value={makeUpDate}
                  min={makeUpBounds.min}
                  max={makeUpBounds.max}
                  onChange={(e) => setMakeUpDate(e.target.value)}
                  required
                />
                <Button type="submit">補打卡</Button>
              </div>
              {makeUpIsNewDate && (
                <p className="text-sm text-muted-foreground">這天會成為新的團練日期</p>
              )}
            </form>
          )}
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {!recordsMember || recordsMember.records.length === 0 ? (
              <p className="p-3 text-center text-sm text-muted-foreground">尚無打卡紀錄</p>
            ) : (
              <ul className="divide-y">
                {recordsMember.records.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                  >
                    <span>{formatDateOnlyWithWeekday(r.date)}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {r.punchedBy
                        ? `補打卡 · ${r.punchedBy.name ?? "—"}`
                        : formatTaipeiClock(r.punchedAt)}
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => confirmDeleteRecord(recordsMember.memberId, r)}
                          aria-label={`刪除 ${r.date} 的打卡`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shared confirmation */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await confirm?.onConfirm();
                setConfirm(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirm?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
