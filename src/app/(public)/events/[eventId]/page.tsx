import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEventById } from "@/services/event.service";
import {
  getRegistrationCount,
  getUserRegistrationForEvent,
} from "@/services/registration.service";
import {
  EventCategory,
  EventStatus,
  EventType,
} from "@/generated/prisma/client";
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

function getStatusColor(status: EventStatus): string {
  const map: Record<EventStatus, string> = {
    PLANNING: "bg-warm-sand text-warm-dark/70",
    OPEN: "bg-warm-green text-white badge-pulse",
    IN_PROGRESS: "bg-warm-gold text-warm-dark",
    COMPLETED: "bg-warm-dark/20 text-warm-dark/60",
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

  const spotsLeft =
    event.maxParticipants !== null
      ? Math.max(0, event.maxParticipants - registrationCount.registered)
      : null;

  return (
    <div className="min-h-screen bg-warm-cream">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Back link */}
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-warm-dark/50 hover:text-warm-dark transition-colors font-medium group"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="transition-transform group-hover:-translate-x-1"
          >
            <path
              d="M10 3L5 8L10 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          返回活動列表
        </Link>

        {/* Event Hero Card */}
        <div className="bg-warm-gold rounded-3xl p-8 sm:p-10 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-6 right-8 sparkle">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z"
                fill="white"
                fillOpacity="0.4"
              />
            </svg>
          </div>
          <div
            className="absolute bottom-12 right-20 sparkle"
            style={{ animationDelay: "0.7s" }}
          >
            <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z"
                fill="white"
                fillOpacity="0.3"
              />
            </svg>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center text-sm font-display font-bold px-4 py-1.5 rounded-full shadow-md ${getStatusColor(event.status)}`}
              >
                {getStatusLabel(event.status)}
              </span>
              {event.category && (
                <span className="inline-flex items-center bg-white/25 text-white text-sm font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                  {getCategoryLabel(event.category)}
                </span>
              )}
              <span className="inline-flex items-center bg-white/25 text-white text-sm font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                {event.type === EventType.SERIES ? "系列活動" : "單次活動"}
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">
              {event.title}
            </h1>

            {event.description && (
              <p className="text-white/80 text-lg max-w-2xl whitespace-pre-wrap">
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Details Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="font-display text-xl font-bold text-warm-dark">
              活動資訊
            </h3>

            <div className="space-y-4">
              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-warm-blue/30 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-warm-dark/60"
                    >
                      <path
                        d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22S19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-warm-dark/50 font-medium">
                      地點
                    </p>
                    <p className="text-warm-dark font-semibold">
                      {event.location}
                    </p>
                  </div>
                </div>
              )}

              {/* Date for single events */}
              {event.type === EventType.SINGLE &&
                event.eventSessions.length > 0 && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-warm-gold/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="text-warm-dark/60"
                        >
                          <path
                            d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-warm-dark/50 font-medium">
                          日期
                        </p>
                        <p className="text-warm-dark font-semibold">
                          {formatDate(event.eventSessions[0].sessionDate)}
                        </p>
                      </div>
                    </div>
                    {(event.eventSessions[0].startTime ||
                      event.eventSessions[0].endTime) && (
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-warm-terra/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-warm-dark/60"
                          >
                            <path
                              d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12S7.58 4 12 4 20 7.58 20 12 16.42 20 12 20ZM12.5 7H11V13L16.25 16.15L17 14.92L12.5 12.25V7Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-warm-dark/50 font-medium">
                            時間
                          </p>
                          <p className="text-warm-dark font-semibold">
                            {formatTime(
                              event.eventSessions[0].startTime,
                              event.eventSessions[0].endTime
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>

          {/* Registration Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="font-display text-xl font-bold text-warm-dark">
              報名資訊
            </h3>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-warm-cream rounded-2xl p-4 text-center">
                <p className="font-display text-3xl font-bold text-warm-green">
                  {registrationCount.registered}
                </p>
                <p className="text-warm-dark/50 text-sm mt-1">已報名</p>
              </div>
              {event.maxParticipants !== null ? (
                <div className="bg-warm-cream rounded-2xl p-4 text-center">
                  <p className="font-display text-3xl font-bold text-warm-terra">
                    {spotsLeft}
                  </p>
                  <p className="text-warm-dark/50 text-sm mt-1">剩餘名額</p>
                </div>
              ) : (
                <div className="bg-warm-cream rounded-2xl p-4 text-center">
                  <p className="font-display text-2xl font-bold text-warm-gold">
                    ∞
                  </p>
                  <p className="text-warm-dark/50 text-sm mt-1">不限名額</p>
                </div>
              )}
            </div>

            {registrationCount.waitlisted > 0 && (
              <div className="bg-warm-gold/10 rounded-2xl p-3 text-center">
                <p className="text-warm-dark/70 text-sm">
                  候補中：
                  <span className="font-bold">
                    {registrationCount.waitlisted}
                  </span>{" "}
                  人
                </p>
              </div>
            )}

            {/* Register Button */}
            <div className="pt-2">
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
          </div>
        </div>

        {/* Sessions Table (for SERIES events) */}
        {event.type === EventType.SERIES &&
          event.eventSessions.length > 0 && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="font-display text-xl font-bold text-warm-dark mb-6">
                活動場次
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-warm-sand">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-warm-dark/50">
                        堂次
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-warm-dark/50">
                        日期
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-warm-dark/50">
                        時間
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-warm-dark/50">
                        主題
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.eventSessions.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-warm-sand/50 last:border-b-0 hover:bg-warm-cream/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-warm-gold/15 rounded-full text-sm font-display font-bold text-warm-dark">
                            {s.sessionNo}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-warm-dark">
                          {formatDate(s.sessionDate)}
                        </td>
                        <td className="py-3 px-4 text-sm text-warm-dark/70">
                          {formatTime(s.startTime, s.endTime)}
                        </td>
                        <td className="py-3 px-4 text-sm text-warm-dark font-medium">
                          {s.topic || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* QR Code Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="font-display text-xl font-bold text-warm-dark mb-4">
            分享活動
          </h3>
          <QRCodeDisplay
            url={eventUrl}
            label="掃描 QR Code 或複製連結分享此活動"
          />
        </div>
      </div>
    </div>
  );
}
