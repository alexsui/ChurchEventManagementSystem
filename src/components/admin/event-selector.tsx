"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EventItem {
  id: string;
  title: string;
  type: string;
  status: string;
  _count?: {
    eventSessions: number;
    registrations: number;
  };
}

interface EventSelectorProps {
  value: string;
  onChange: (eventId: string) => void;
  showRegistrationCount?: boolean;
}

export function EventSelector({
  value,
  onChange,
  showRegistrationCount = false,
}: EventSelectorProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/events?all=true");
      if (!res.ok) throw new Error("無法取得活動列表");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>選擇活動</CardTitle>
        <CardDescription>請選擇要管理的活動</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-muted-foreground text-sm">載入活動列表中...</p>}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full sm:w-[320px]">
              <SelectValue placeholder="請選擇活動" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                  {showRegistrationCount && event._count
                    ? ` (${event._count.registrations} 人報名)`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}
