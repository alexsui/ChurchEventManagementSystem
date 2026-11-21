"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { punchStatusMessages } from "@/lib/constants";
import {
  formatDateOnlyDisplay,
  formatDateOnlyWithWeekday,
  formatTaipeiClock,
} from "@/lib/taipei-date";

type TodayStatus = "NOT_LOGGED_IN" | "OUT_OF_RANGE" | "NOT_MEMBER" | "READY" | "PUNCHED";

interface TodayData {
  activity: { id: string; title: string; startDate: string; endDate: string };
  today: string;
  status: TodayStatus;
  punchedAt: string | null;
}

export default function PunchPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const { data: authSession, status: authStatus } = useSession();

  const [data, setData] = useState<TodayData | null>(null);
  const [loadError, setLoadError] = useState<"NOT_FOUND" | "ERROR" | null>(null);
  const [punching, setPunching] = useState(false);
  const [justPunched, setJustPunched] = useState(false);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch(`/api/punch-activities/${activityId}/today`);
      if (res.status === 404) {
        setLoadError("NOT_FOUND");
        return;
      }
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setLoadError("ERROR");
    }
  }, [activityId]);

  useEffect(() => {
    if (authStatus === "loading") return;
    fetchToday();
  }, [authStatus, fetchToday]);

  async function handlePunch() {
    setPunching(true);
    try {
      const res = await fetch(`/api/punch-activities/${activityId}/today`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setJustPunched(true);
      } else {
        toast.error(punchStatusMessages[body.code] ?? body.error ?? "打卡失敗");
      }
      await fetchToday();
    } catch {
      toast.error("網路連線錯誤，請稍後再試");
    } finally {
      setPunching(false);
    }
  }

  let content: React.ReactNode;

  if (loadError) {
    content = (
      <Message
        icon="error"
        title={loadError === "NOT_FOUND" ? punchStatusMessages.NOT_FOUND : "無法載入"}
      />
    );
  } else if (!data || authStatus === "loading") {
    content = (
      <div className="py-8">
        <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (data.status === "NOT_LOGGED_IN") {
    content = (
      <Button asChild className="w-full" size="lg">
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/punch/${activityId}`)}`}>
          {punchStatusMessages.NOT_LOGGED_IN}
        </Link>
      </Button>
    );
  } else if (data.status === "OUT_OF_RANGE") {
    content = (
      <Message
        icon="error"
        title={punchStatusMessages.OUT_OF_RANGE}
        description={`${formatDateOnlyDisplay(data.activity.startDate)} – ${formatDateOnlyDisplay(data.activity.endDate)}`}
      />
    );
  } else if (data.status === "NOT_MEMBER") {
    content = <Message icon="error" title={punchStatusMessages.NOT_MEMBER} />;
  } else if (data.status === "PUNCHED") {
    content = (
      <Message
        icon="success"
        animate={justPunched}
        title={justPunched ? "打卡成功！" : punchStatusMessages.PUNCHED}
        description={data.punchedAt ? formatTaipeiClock(data.punchedAt) : undefined}
      />
    );
  } else {
    content = (
      <div className="space-y-4">
        <p className="text-center text-lg font-medium">{authSession?.user?.name}</p>
        <Button onClick={handlePunch} disabled={punching} className="w-full" size="lg">
          {punching ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              打卡中...
            </>
          ) : (
            "打卡"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        {data && (
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{data.activity.title}</CardTitle>
            <CardDescription className="text-base">
              {formatDateOnlyWithWeekday(data.today)}
            </CardDescription>
          </CardHeader>
        )}
        <CardContent>{content}</CardContent>
      </Card>
    </div>
  );
}

function Message({
  icon,
  title,
  description,
  animate,
}: {
  icon: "success" | "error";
  title: string;
  description?: string;
  animate?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      {icon === "success" ? (
        <div
          className={cn(
            "rounded-full bg-green-100 p-3",
            animate && "animate-in zoom-in-50 duration-300"
          )}
        >
          <CheckCircle2 className="size-10 text-green-600" />
        </div>
      ) : (
        <AlertCircle className="size-12 text-destructive" />
      )}
      <h2
        className={cn(
          "text-lg font-semibold",
          icon === "success" ? "text-green-700" : "text-foreground"
        )}
      >
        {title}
      </h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
