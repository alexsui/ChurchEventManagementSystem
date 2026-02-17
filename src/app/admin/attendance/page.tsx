"use client";

import { useState } from "react";
import { EventSelector } from "@/components/admin/event-selector";
import { AttendancePanel } from "@/components/admin/attendance-panel";

export default function AttendancePage() {
  const [selectedEventId, setSelectedEventId] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">出席管理</h1>
        <p className="text-muted-foreground text-sm">
          管理活動出席報到紀錄
        </p>
      </div>

      <EventSelector value={selectedEventId} onChange={setSelectedEventId} />

      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">請選擇活動以開始管理出席</p>
        </div>
      )}

      {selectedEventId && <AttendancePanel eventId={selectedEventId} />}
    </div>
  );
}
