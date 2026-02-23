"use client";

import { useState } from "react";
import { EventSelector } from "@/components/admin/event-selector";
import { AssignmentsPanel } from "@/components/admin/assignments-panel";

export default function AssignmentsPage() {
  const [selectedEventId, setSelectedEventId] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">作業管理</h1>
        <p className="text-muted-foreground text-sm">管理活動作業完成狀態</p>
      </div>

      <EventSelector value={selectedEventId} onChange={setSelectedEventId} />

      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">請選擇活動以開始管理作業</p>
        </div>
      )}

      {selectedEventId && <AssignmentsPanel eventId={selectedEventId} />}
    </div>
  );
}
