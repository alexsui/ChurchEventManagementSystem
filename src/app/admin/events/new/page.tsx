"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventForm, type EventFormSubmitData } from "@/components/shared/event-form";
import { useAdminPermissions } from "@/contexts/admin-permissions";

export default function NewEventPage() {
  const router = useRouter();
  const { canWrite } = useAdminPermissions("events");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!canWrite) {
      router.replace("/admin/events");
    }
  }, [canWrite, router]);

  if (!canWrite) {
    return null;
  }

  async function handleSubmit(data: EventFormSubmitData) {
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "建立活動失敗");
      }

      const event = await res.json();
      toast.success("活動建立成功");
      router.push(`/admin/events/${event.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "建立活動失敗");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/events")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">新增活動</h1>
          <p className="text-muted-foreground text-sm">建立新的教會活動</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>活動資訊</CardTitle>
          <CardDescription>填寫活動的基本資訊和場次</CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </CardContent>
      </Card>
    </div>
  );
}
