"use client";

import { useState } from "react";
import { EventSelector } from "@/components/admin/event-selector";
import { RegistrationsPanel } from "@/components/admin/registrations-panel";

export default function RegistrationsPage() {
  const [selectedEventId, setSelectedEventId] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">報名管理</h1>
        <p className="text-muted-foreground text-sm">管理活動報名資料</p>
      </div>

      <EventSelector value={selectedEventId} onChange={setSelectedEventId} showRegistrationCount />

      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">請選擇活動以查看報名資料</p>
        </div>
      )}

      {selectedEventId && <RegistrationsPanel eventId={selectedEventId} />}
    </div>
  );
}
