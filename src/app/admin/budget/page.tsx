"use client";

import { useState } from "react";
import { EventSelector } from "@/components/admin/event-selector";
import { BudgetPanel } from "@/components/admin/budget-panel";
import { useAdminPermissions } from "@/contexts/admin-permissions";

export default function BudgetPage() {
  const { canRead } = useAdminPermissions("budget");
  const [selectedEventId, setSelectedEventId] = useState("");

  if (!canRead) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-lg">無權限存取此頁面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">預算管理</h1>
        <p className="text-muted-foreground text-sm">
          管理活動預算項目與追蹤執行狀況
        </p>
      </div>

      <EventSelector value={selectedEventId} onChange={setSelectedEventId} />

      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">請選擇活動以管理預算</p>
        </div>
      )}

      {selectedEventId && <BudgetPanel eventId={selectedEventId} />}
    </div>
  );
}
