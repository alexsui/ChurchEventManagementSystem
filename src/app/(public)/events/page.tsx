import Link from "next/link";
import { getEvents } from "@/services/event.service";
import { EventCategory, EventStatus, EventType } from "@/generated/prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
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

export default async function EventsListingPage() {
  const allEvents = await getEvents();

  const events = allEvents.filter(
    (e) => e.status === EventStatus.OPEN || e.status === EventStatus.IN_PROGRESS
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">活動列表</h1>
          <p className="text-muted-foreground mt-1">瀏覽目前開放的活動</p>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">目前沒有開放的活動</p>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => {
            const firstSession = event.eventSessions[0];
            const lastSession =
              event.eventSessions[event.eventSessions.length - 1];

            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block"
              >
                <Card className="transition-colors hover:border-primary/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-lg">
                          {event.title}
                        </CardTitle>
                        {event.description && (
                          <CardDescription className="line-clamp-2">
                            {event.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Badge variant={getStatusVariant(event.status)}>
                          {getStatusLabel(event.status)}
                        </Badge>
                        {event.category && (
                          <Badge variant="outline">
                            {getCategoryLabel(event.category)}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {event.type === EventType.SERIES ? "系列" : "單場"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      {/* Date info */}
                      {firstSession && (
                        <span>
                          {event.type === EventType.SERIES && lastSession
                            ? `${formatDate(firstSession.sessionDate)} ~ ${formatDate(lastSession.sessionDate)}`
                            : formatDate(firstSession.sessionDate)}
                        </span>
                      )}

                      {/* Location */}
                      {event.location && <span>{event.location}</span>}

                      {/* Registration count */}
                      <span>
                        已報名 {event._count.registrations} 人
                        {event.maxParticipants !== null &&
                          ` / ${event.maxParticipants} 人`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
