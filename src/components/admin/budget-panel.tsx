"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useAdminPermissions } from "@/contexts/admin-permissions";

// -- Types ------------------------------------------------------------------

interface BudgetItem {
  id: string;
  eventId: string;
  category: string;
  customCategory: string | null;
  estimated: number;
  actual: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BudgetSummary {
  totalEstimated: number;
  totalActual: number;
  difference: number;
  executionRate: number;
}

interface BudgetFormData {
  category: string;
  customCategory: string;
  estimated: string;
  actual: string;
  note: string;
}

// -- Constants --------------------------------------------------------------

const CATEGORIES: Record<string, string> = {
  MEAL: "午晚餐",
  SNACK: "茶點",
  VENUE: "場佈",
  MATERIAL: "材料",
  EQUIPMENT: "設備",
  OTHER: "其他",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, label]) => ({
  value,
  label,
}));

const currencyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const EMPTY_FORM: BudgetFormData = {
  category: "",
  customCategory: "",
  estimated: "",
  actual: "",
  note: "",
};

// -- Helpers ----------------------------------------------------------------

function getCategoryLabel(category: string, customCategory: string | null) {
  if (category === "OTHER" && customCategory) {
    return `其他 (${customCategory})`;
  }
  return CATEGORIES[category] ?? category;
}

// -- Component --------------------------------------------------------------

interface BudgetPanelProps {
  eventId: string;
}

export function BudgetPanel({ eventId }: BudgetPanelProps) {
  const { canWrite } = useAdminPermissions("budget");

  // Budget data state
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // -- Data fetching --------------------------------------------------------

  const fetchBudget = useCallback(async () => {
    try {
      setBudgetLoading(true);
      const res = await fetch(`/api/budget?eventId=${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch budget");
      const data: { items: BudgetItem[]; summary: BudgetSummary } =
        await res.json();
      setItems(data.items);
      setSummary(data.summary);
    } catch {
      toast.error("無法載入預算資料");
    } finally {
      setBudgetLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  // -- Dialog handlers ------------------------------------------------------

  function openAddDialog() {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(item: BudgetItem) {
    setEditingItem(item);
    setFormData({
      category: item.category,
      customCategory: item.customCategory ?? "",
      estimated: String(item.estimated),
      actual: String(item.actual),
      note: item.note ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData(EMPTY_FORM);
  }

  async function handleSubmit() {
    if (!formData.category) {
      toast.error("請選擇類別");
      return;
    }

    const estimated = Number(formData.estimated);
    if (isNaN(estimated) || estimated < 0) {
      toast.error("預估金額必須為有效的正數");
      return;
    }

    const actual = formData.actual ? Number(formData.actual) : 0;
    if (isNaN(actual) || actual < 0) {
      toast.error("實際金額必須為有效的正數");
      return;
    }

    const payload = {
      category: formData.category,
      customCategory:
        formData.category === "OTHER" ? formData.customCategory || null : null,
      estimated,
      actual,
      note: formData.note || null,
    };

    try {
      setSubmitting(true);

      if (editingItem) {
        const res = await fetch(`/api/budget/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "更新失敗");
        }
        toast.success("預算項目已更新");
      } else {
        const res = await fetch("/api/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, eventId }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "新增失敗");
        }
        toast.success("預算項目已新增");
      }

      closeDialog();
      fetchBudget();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "操作失敗，請稍後再試"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // -- Delete handlers ------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/budget/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "刪除失敗");
      }
      toast.success("預算項目已刪除");
      setDeleteTarget(null);
      fetchBudget();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "刪除失敗，請稍後再試"
      );
    } finally {
      setDeleting(false);
    }
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Add button header */}
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            新增項目
          </Button>
        </div>
      )}

      {/* Budget Table */}
      <Card>
        <CardContent className="pt-6">
          {budgetLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">載入預算資料中...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Wallet className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">尚無預算項目</p>
              {canWrite && (
                <Button variant="outline" onClick={openAddDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  新增第一筆預算
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>類別</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="text-right">預估金額</TableHead>
                  <TableHead className="text-right">實際金額</TableHead>
                  {canWrite && (
                    <TableHead className="text-right">操作</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {getCategoryLabel(item.category, item.customCategory)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.note || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {currencyFormatter.format(item.estimated)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currencyFormatter.format(item.actual)}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              {summary && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      預估總計 / 實際總計
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currencyFormatter.format(summary.totalEstimated)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currencyFormatter.format(summary.totalActual)}
                    </TableCell>
                    {canWrite && <TableCell />}
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      差額 / 執行率
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currencyFormatter.format(summary.difference)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {(summary.executionRate * 100).toFixed(1)}%
                    </TableCell>
                    {canWrite && <TableCell />}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "編輯預算項目" : "新增預算項目"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "修改預算項目的資料"
                : "為目前選擇的活動新增一筆預算項目"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="dialog-category">類別</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: value,
                    customCategory:
                      value !== "OTHER" ? "" : prev.customCategory,
                  }))
                }
              >
                <SelectTrigger id="dialog-category">
                  <SelectValue placeholder="請選擇類別" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Category (only when OTHER) */}
            {formData.category === "OTHER" && (
              <div className="space-y-2">
                <Label htmlFor="dialog-custom-category">自訂類別名稱</Label>
                <Input
                  id="dialog-custom-category"
                  value={formData.customCategory}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customCategory: e.target.value,
                    }))
                  }
                  placeholder="例如：交通費"
                />
              </div>
            )}

            {/* Estimated */}
            <div className="space-y-2">
              <Label htmlFor="dialog-estimated">預估金額</Label>
              <Input
                id="dialog-estimated"
                type="number"
                min="0"
                value={formData.estimated}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimated: e.target.value,
                  }))
                }
                placeholder="0"
              />
            </div>

            {/* Actual */}
            <div className="space-y-2">
              <Label htmlFor="dialog-actual">實際金額</Label>
              <Input
                id="dialog-actual"
                type="number"
                min="0"
                value={formData.actual}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    actual: e.target.value,
                  }))
                }
                placeholder="0"
              />
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="dialog-note">備註</Label>
              <Input
                id="dialog-note"
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="選填"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "處理中..." : editingItem ? "儲存變更" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「
              {deleteTarget
                ? getCategoryLabel(
                    deleteTarget.category,
                    deleteTarget.customCategory
                  )
                : ""}
              」這筆預算項目嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "刪除中..." : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
