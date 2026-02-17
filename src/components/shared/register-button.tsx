"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EventStatus, RegistrationStatus } from "@/generated/prisma/client";

interface RegisterButtonProps {
  eventId: string;
  isLoggedIn: boolean;
  isRegistered: boolean;
  registrationStatus?: RegistrationStatus | null;
  eventStatus: EventStatus;
  isFull: boolean;
}

export function RegisterButton({
  eventId,
  isLoggedIn,
  isRegistered,
  registrationStatus,
  eventStatus,
  isFull,
}: RegisterButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Already registered
  if (isRegistered && registrationStatus) {
    const label =
      registrationStatus === "WAITLISTED" ? "候補中" : "已報名";
    return (
      <Badge variant="secondary" className="text-base px-6 py-2">
        {label}
      </Badge>
    );
  }

  // Event not open
  if (eventStatus === "PLANNING") {
    return (
      <Button disabled size="lg">
        報名尚未開放
      </Button>
    );
  }

  if (eventStatus === "COMPLETED") {
    return (
      <Button disabled size="lg">
        活動已結束
      </Button>
    );
  }

  if (eventStatus === "IN_PROGRESS") {
    return (
      <Button disabled size="lg">
        活動進行中
      </Button>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <Button
        size="lg"
        onClick={() => {
          router.push(`/login?callbackUrl=/events/${eventId}`);
        }}
      >
        登入後報名
      </Button>
    );
  }

  // Logged in, event is OPEN
  async function handleRegister() {
    setLoading(true);
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "報名失敗，請稍後再試");
        return;
      }

      if (data.status === "WAITLISTED") {
        toast.success("已加入候補名單");
      } else {
        toast.success("報名成功");
      }

      router.refresh();
    } catch {
      toast.error("報名失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="lg" onClick={handleRegister} disabled={loading}>
      {loading ? "報名中..." : isFull ? "候補報名" : "立即報名"}
    </Button>
  );
}
