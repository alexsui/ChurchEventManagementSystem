import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEventById } from "@/services/event.service";
import {
  getRegistrationCount,
  getUserRegistrationForEvent,
} from "@/services/registration.service";
import { EventCategory, EventStatus, EventType } from "@/generated/prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RegisterButton } from "@/components/shared/register-button";
import { QRCodeDisplay } from "@/components/shared/qrcode-display";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatTime(start?: string | null, end?: string | null): string {
  if (!start && !end) return "-";
  if (start && end) return `${start} - ${end}`;
  return start || end || "-";
}

function getStatusLabel(status: EventStatus): string {
  const map: Record<EventStatus, string> = {
    PLANNING: "籌備中",
    OPEN: "開放報名",
    IN_PROGRESS: "進行中",
    COMPLETED: "已結束",
  };
  return map[status];
}

function getStatusVariant(
  status: EventStatus
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<
    EventStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    PLANNING: "outline",
    OPEN: "default",
    IN_PROGRESS: "secondary",
    COMPLETED: "destructive",
  };
  return map[status];
}

function getCategoryLabel(category: EventCategory): string {
  const map: Record<EventCategory, string> = {
    COURSE: "課程",
    LECTURE: "講座",
    CAMP: "營會",
  };
  return map[category];
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const [event, registrationCount, session] = await Promise.all([
    getEventById(eventId),
    getRegistrationCount(eventId),
    auth(),
  ]);

  if (!event) {
    notFound();
  }

  const isLoggedIn = !!session?.user;
  let userRegistration = null;
  if (isLoggedIn) {
    userRegistration = await getUserRegistrationForEvent(
      session!.user.id,
      eventId
    );
  }

  const isRegistered = !!userRegistration;
  const isFull =
    event.maxParticipants !== null &&
    registrationCount.registered >= event.maxParticipants;

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const eventUrl = `${protocol}://${host}/events/${eventId}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Back link */}
        <Link
          href="/events"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← 返回活動列表
        </Link>

        {/* Event Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{event.title}</CardTitle>
                {event.description && (
                  <CardDescription className="text-base whitespace-pre-wrap">
                    {event.description}
                  </CardDescription>
                )}
              </div>
              <Badge variant={getStatusVariant(event.status)}>
                {getStatusLabel(event.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location */}
            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">
                  地點：
                </span>
                <span>{event.location}</span>
              </div>
            )}

            {/* Category */}
            {event.category && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">
                  類別：
                </span>
                <span>{getCategoryLabel(event.category)}</span>
              </div>
            )}

            {/* Event Type */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-muted-foreground">
                類型：
              </span>
              <span>
                {event.type === EventType.SERIES ? "系列活動" : "單次活動"}
              </span>
            </div>

            {/* Single Event Date */}
            {event.type === EventType.SINGLE &&
              event.eventSessions.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground">
                      日期：
                    </span>
                    <span>
                      {formatDate(event.eventSessions[0].sessionDate)}
                    </span>
                  </div>
                  {(event.eventSessions[0].startTime ||
                    event.eventSessions[0].endTime) && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground">
                        時間：
                      </span>
                      <span>
                        {formatTime(
                          event.eventSessions[0].startTime,
                          event.eventSessions[0].endTime
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

            <Separator />

            {/* Registration Info */}
            <div className="space-y-2">
              <h3 className="font-semibold">報名資訊</h3>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  已報名：
                  <span className="font-bold">
                    {registrationCount.registered}
                  </span>{" "}
                  人
                </span>
                {event.maxParticipants !== null && (
                  <>
                    <span>
                      名額上限：
                      <span className="font-bold">
                        {event.maxParticipants}
                      </span>{" "}
                      人
                    </span>
                    <span>
                      剩餘名額：
                      <span className="font-bold">
                        {Math.max(
                          0,
                          event.maxParticipants -
                            registrationCount.registered
                        )}
                      </span>{" "}
                      人
                    </span>
                  </>
                )}
                {registrationCount.waitlisted > 0 && (
                  <span>
                    候補：
                    <span className="font-bold">
                      {registrationCount.waitlisted}
                    </span>{" "}
                    人
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Register Button */}
            <div className="flex justify-center pt-2">
              <RegisterButton
                eventId={eventId}
                isLoggedIn={isLoggedIn}
                isRegistered={isRegistered}
                registrationId={userRegistration?.id ?? null}
                registrationStatus={userRegistration?.status ?? null}
                eventStatus={event.status}
                isFull={isFull}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sessions Table (for SERIES events) */}
        {event.type === EventType.SERIES &&
          event.eventSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">活動場次</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>堂次</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>時間</TableHead>
                      <TableHead>主題</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.eventSessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>第 {s.sessionNo} 堂</TableCell>
                        <TableCell>{formatDate(s.sessionDate)}</TableCell>
                        <TableCell>
                          {formatTime(s.startTime, s.endTime)}
                        </TableCell>
                        <TableCell>{s.topic || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

        {/* QR Code */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">分享活動</CardTitle>
          </CardHeader>
          <CardContent>
            <QRCodeDisplay
              url={eventUrl}
              label="掃描 QR Code 或複製連結分享此活動"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
