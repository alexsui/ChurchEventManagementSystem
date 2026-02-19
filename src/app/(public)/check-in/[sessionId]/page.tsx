"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatLongDate, formatTime } from "@/lib/formatters";

interface SessionInfo {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
}

interface EventInfo {
  id: string;
  title: string;
  location: string | null;
}

interface AttendanceInfo {
  id: string;
  checkInTime: string;
}

interface CheckInData {
  session: SessionInfo;
  event: EventInfo;
  attendance: AttendanceInfo | null;
}

type PageState =
  | "loading"
  | "not-found"
  | "not-logged-in"
  | "already-checked-in"
  | "ready"
  | "checking-in"
  | "success"
  | "error";

function formatCheckInTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function CheckInPage() {
  const params = useParams<{ sessionId: string }>();
  const { data: authSession, status: authStatus } = useSession();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [checkInData, setCheckInData] = useState<CheckInData | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const sessionId = params.sessionId;

  const fetchSessionData = useCallback(async () => {
    try {
      const res = await fetch(`/api/check-in/${sessionId}`);

      if (res.status === 404) {
        setPageState("not-found");
        return;
      }

      if (!res.ok) {
        setPageState("error");
        setErrorMessage("無法載入場次資訊，請稍後再試");
        return;
      }

      const data: CheckInData = await res.json();
      setCheckInData(data);

      if (authStatus === "unauthenticated") {
        setPageState("not-logged-in");
      } else if (data.attendance) {
        setCheckInTime(data.attendance.checkInTime);
        setPageState("already-checked-in");
      } else {
        setPageState("ready");
      }
    } catch {
      setPageState("error");
      setErrorMessage("網路連線錯誤，請檢查網路後再試");
    }
  }, [sessionId, authStatus]);

  useEffect(() => {
    if (authStatus === "loading") return;
    fetchSessionData();
  }, [authStatus, fetchSessionData]);

  async function handleCheckIn() {
    setPageState("checking-in");

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSessionId: sessionId }),
      });

      if (res.ok) {
        const data = await res.json();
        setCheckInTime(data.checkedInAt);
        setPageState("success");
        toast.success("報到成功！");
        return;
      }

      const errorData = await res.json();

      if (errorData.code === "ALREADY_CHECKED_IN") {
        // Re-fetch to get the actual check-in time
        await fetchSessionData();
        toast.info("您已經報到過了");
        return;
      }

      if (errorData.code === "NOT_REGISTERED") {
        setPageState("error");
        setErrorMessage("您尚未報名此活動，請先完成報名");
        toast.error("報到失敗：尚未報名");
        return;
      }

      if (errorData.code === "SESSION_NOT_FOUND") {
        setPageState("not-found");
        toast.error("找不到此場次");
        return;
      }

      setPageState("error");
      setErrorMessage(errorData.error || "報到失敗，請稍後再試");
      toast.error("報到失敗");
    } catch {
      setPageState("error");
      setErrorMessage("網路連線錯誤，請檢查網路後再試");
      toast.error("網路連線錯誤");
    }
  }

  // Loading state
  if (pageState === "loading" || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 pb-8">
            <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">載入中...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session not found
  if (pageState === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 pb-8 space-y-4">
            <AlertCircle className="mx-auto size-12 text-destructive" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">找不到此場次</h2>
              <p className="text-sm text-muted-foreground">
                此 QR Code 可能已失效或場次不存在
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/">返回首頁</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // From here on, checkInData should be available
  const sessionInfo = checkInData?.session;
  const eventInfo = checkInData?.event;

  // Not logged in
  if (pageState === "not-logged-in") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{eventInfo?.title}</CardTitle>
            {sessionInfo?.topic && (
              <CardDescription className="text-base">
                {sessionInfo.topic}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session details */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              {sessionInfo && (
                <>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground shrink-0" />
                    <span>{formatLongDate(sessionInfo.sessionDate)}</span>
                  </div>
                  {(sessionInfo.startTime || sessionInfo.endTime) && (
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground shrink-0 invisible" />
                      <span>
                        {formatTime(sessionInfo.startTime, sessionInfo.endTime, "")}
                      </span>
                    </div>
                  )}
                </>
              )}
              {eventInfo?.location && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">地點：</span>
                  <span>{eventInfo.location}</span>
                </div>
              )}
            </div>

            {/* Login prompt */}
            <div className="text-center space-y-3 pt-2">
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <AlertCircle className="size-5" />
                <span className="font-medium">請先登入以完成報到</span>
              </div>
              <Button asChild className="w-full" size="lg">
                <Link
                  href={`/login?callbackUrl=/check-in/${sessionId}`}
                >
                  前往登入
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already checked in
  if (pageState === "already-checked-in") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{eventInfo?.title}</CardTitle>
            {sessionInfo?.topic && (
              <CardDescription className="text-base">
                {sessionInfo.topic}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success indicator */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="size-10 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-green-700">
                  您已報到
                </h3>
                {checkInTime && (
                  <p className="text-sm text-muted-foreground">
                    報到時間：{formatCheckInTime(checkInTime)}
                  </p>
                )}
              </div>
            </div>

            {/* Session details */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">姓名</span>
                <span className="font-medium">
                  {authSession?.user?.name || "—"}
                </span>
              </div>
              {sessionInfo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">場次</span>
                  <span>
                    第 {sessionInfo.sessionNo} 堂
                  </span>
                </div>
              )}
              {sessionInfo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">日期</span>
                  <span>{formatLongDate(sessionInfo.sessionDate)}</span>
                </div>
              )}
              {sessionInfo &&
                (sessionInfo.startTime || sessionInfo.endTime) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">時間</span>
                    <span>
                      {formatTime(sessionInfo.startTime, sessionInfo.endTime, "")}
                    </span>
                  </div>
                )}
              {eventInfo?.location && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">地點</span>
                  <span>{eventInfo.location}</span>
                </div>
              )}
            </div>

            <Badge
              variant="secondary"
              className="w-full justify-center py-1.5"
            >
              報到完成
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check-in success
  if (pageState === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{eventInfo?.title}</CardTitle>
            {sessionInfo?.topic && (
              <CardDescription className="text-base">
                {sessionInfo.topic}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success animation */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div
                className={cn(
                  "rounded-full bg-green-100 p-3",
                  "animate-in zoom-in-50 duration-300"
                )}
              >
                <CheckCircle2 className="size-10 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-green-700">
                  報到成功！
                </h3>
                {checkInTime && (
                  <p className="text-sm text-muted-foreground">
                    報到時間：{formatCheckInTime(checkInTime)}
                  </p>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">姓名</span>
                <span className="font-medium">
                  {authSession?.user?.name || "—"}
                </span>
              </div>
              {sessionInfo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">場次</span>
                  <span>
                    第 {sessionInfo.sessionNo} 堂
                  </span>
                </div>
              )}
              {sessionInfo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">日期</span>
                  <span>{formatLongDate(sessionInfo.sessionDate)}</span>
                </div>
              )}
              {sessionInfo &&
                (sessionInfo.startTime || sessionInfo.endTime) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">時間</span>
                    <span>
                      {formatTime(sessionInfo.startTime, sessionInfo.endTime, "")}
                    </span>
                  </div>
                )}
              {eventInfo?.location && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">地點</span>
                  <span>{eventInfo.location}</span>
                </div>
              )}
            </div>

            <Badge
              variant="default"
              className="w-full justify-center py-1.5"
            >
              報到完成
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 pb-8 space-y-4">
            <AlertCircle className="mx-auto size-12 text-destructive" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">報到失敗</h2>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <div className="flex flex-col gap-2">
              {checkInData?.event && (
                <Button asChild variant="outline">
                  <Link href={`/events/${checkInData.event.id}`}>
                    查看活動詳情
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost">
                <Link href="/">返回首頁</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready to check in
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{eventInfo?.title}</CardTitle>
          {sessionInfo?.topic && (
            <CardDescription className="text-base">
              {sessionInfo.topic}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session details */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">姓名</span>
              <span className="font-medium">
                {authSession?.user?.name || "—"}
              </span>
            </div>
            {sessionInfo && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">場次</span>
                <span>
                  第 {sessionInfo.sessionNo} 堂
                </span>
              </div>
            )}
            {sessionInfo && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">日期</span>
                <span>{formatLongDate(sessionInfo.sessionDate)}</span>
              </div>
            )}
            {sessionInfo &&
              (sessionInfo.startTime || sessionInfo.endTime) && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">時間</span>
                  <span>
                    {formatTime(sessionInfo.startTime, sessionInfo.endTime, "")}
                  </span>
                </div>
              )}
            {eventInfo?.location && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">地點</span>
                <span>{eventInfo.location}</span>
              </div>
            )}
          </div>

          {/* Check-in button */}
          <Button
            onClick={handleCheckIn}
            disabled={pageState === "checking-in"}
            className="w-full"
            size="lg"
          >
            {pageState === "checking-in" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                報到中...
              </>
            ) : (
              "確認報到"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
