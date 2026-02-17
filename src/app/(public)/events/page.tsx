import Link from "next/link";
import { getEvents } from "@/services/event.service";
import {
  EventCategory,
  EventStatus,
  EventType,
} from "@/generated/prisma/client";

function formatShortDate(date: Date): string {
  return new Date(date).toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
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

function getCategoryIcon(category: EventCategory | null): string {
  if (!category) return "📋";
  const map: Record<EventCategory, string> = {
    COURSE: "📖",
    LECTURE: "🎤",
    CAMP: "⛺",
  };
  return map[category];
}

export default async function EventsListingPage() {
  const allEvents = await getEvents();

  const events = allEvents.filter(
    (e) =>
      e.status === EventStatus.OPEN || e.status === EventStatus.IN_PROGRESS
  );

  // Group events by category for side cards
  const courseEvents = events.filter(
    (e) => e.category === EventCategory.COURSE
  );
  const campEvents = events.filter((e) => e.category === EventCategory.CAMP);

  return (
    <div className="min-h-screen bg-warm-cream">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Hero Section - Welcome Banner + Category Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Welcome Banner */}
              <div className="lg:col-span-2 relative bg-warm-gold rounded-3xl p-8 min-h-[280px] flex flex-col justify-between overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-6 left-6 sparkle">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z" fill="white" fillOpacity="0.6" />
                  </svg>
                </div>
                <div className="absolute top-20 right-12 sparkle" style={{ animationDelay: "0.5s" }}>
                  <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                    <path d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z" fill="white" fillOpacity="0.4" />
                  </svg>
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                  <span className="font-display text-[120px] sm:text-[180px] font-bold text-white/15 leading-none tracking-tight">
                    JOIN
                  </span>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />

                <div className="relative z-10 space-y-3">
                  <span className="inline-flex items-center bg-warm-green text-white text-sm font-display font-bold px-4 py-1.5 rounded-full shadow-md">
                    {events.length} 個活動開放中
                  </span>
                </div>

                <div className="relative z-10 space-y-3">
                  <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight drop-shadow-sm">
                    教會活動
                  </h1>
                  <p className="text-white/80 text-lg max-w-md">
                    探索精彩活動，一起參與教會生活
                  </p>
                </div>
              </div>

              {/* Side Cards Stack */}
              <div className="flex flex-col gap-5">
                {/* Category Card: Courses */}
                <div className="warm-card bg-warm-blue rounded-3xl p-6 min-h-[130px] flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <h3 className="font-display text-3xl font-bold text-warm-dark">
                      課程
                    </h3>
                    <p className="text-warm-dark/60 text-sm mt-1">
                      {courseEvents.length > 0
                        ? `${courseEvents.length} 個課程開放中`
                        : "探索信仰成長課程"}
                    </p>
                  </div>
                  <span className="text-4xl self-end">{getCategoryIcon(EventCategory.COURSE)}</span>
                  <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/20 rounded-full" />
                </div>

                {/* Category Card: Camps */}
                <div className="warm-card bg-warm-terra rounded-3xl p-6 min-h-[130px] flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <h3 className="font-display text-3xl font-bold text-white">
                      營會
                    </h3>
                    <p className="text-white/70 text-sm mt-1">
                      {campEvents.length > 0
                        ? `${campEvents.length} 個營會開放中`
                        : "精彩營會敬請期待"}
                    </p>
                  </div>
                  <span className="text-4xl self-end">{getCategoryIcon(EventCategory.CAMP)}</span>
                  <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/10 rounded-full" />
                </div>
              </div>
            </div>

            {/* All Events List */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
              <h2 className="font-display text-3xl font-bold text-warm-dark mb-6">
                所有活動
              </h2>

              <div className="space-y-4">
                {events.map((event) => {
                  const firstSession = event.eventSessions[0];
                  const lastSession =
                    event.eventSessions[event.eventSessions.length - 1];

                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block"
                    >
                      <div className="flex items-center gap-4 sm:gap-6 p-4 rounded-2xl hover:bg-warm-cream/60 transition-colors group">
                        {/* Category Icon */}
                        <div className="w-12 h-12 bg-warm-sand rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xl">
                            {getCategoryIcon(event.category)}
                          </span>
                        </div>

                        {/* Event Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-warm-dark text-lg group-hover:text-warm-green transition-colors">
                              {event.title}
                            </h3>
                            {event.status === EventStatus.OPEN && (
                              <span className="badge-pulse inline-flex items-center bg-warm-green text-white text-xs font-display font-bold px-2.5 py-0.5 rounded-full">
                                {getStatusLabel(event.status)}
                              </span>
                            )}
                            {event.status === EventStatus.IN_PROGRESS && (
                              <span className="inline-flex items-center bg-warm-gold text-warm-dark text-xs font-display font-bold px-2.5 py-0.5 rounded-full">
                                {getStatusLabel(event.status)}
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-warm-dark/50 text-sm line-clamp-1 mt-0.5">
                              {event.description}
                            </p>
                          )}
                        </div>

                        {/* Date & Count */}
                        <div className="hidden sm:flex items-center gap-4 shrink-0">
                          {firstSession && (
                            <span className="text-warm-dark/50 text-sm">
                              {event.type === EventType.SERIES && lastSession
                                ? `${formatShortDate(firstSession.sessionDate)} ~ ${formatShortDate(lastSession.sessionDate)}`
                                : formatShortDate(firstSession.sessionDate)}
                            </span>
                          )}

                          <span className="text-warm-dark/50 text-sm">
                            {event._count.registrations} 人
                            {event.maxParticipants !== null &&
                              ` / ${event.maxParticipants}`}
                          </span>
                        </div>

                        {/* Arrow */}
                        <div className="w-8 h-8 bg-warm-green rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M6 3L11 8L6 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      {/* Decorative illustration */}
      <div className="relative">
        <div className="w-24 h-24 bg-warm-gold/20 rounded-3xl flex items-center justify-center float-anim">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            className="text-warm-gold"
          >
            <path
              d="M24 4L29 16L42 18L32 27L35 40L24 34L13 40L16 27L6 18L19 16L24 4Z"
              fill="currentColor"
              opacity="0.3"
            />
            <path
              d="M24 8L28 18L38 20L30 27L32 37L24 32L16 37L18 27L10 20L20 18L24 8Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <div className="absolute -top-2 -right-2 sparkle">
          <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
            <path
              d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z"
              fill="#E8B44B"
              fillOpacity="0.5"
            />
          </svg>
        </div>
      </div>
      <div className="text-center space-y-2">
        <h2 className="font-display text-2xl font-bold text-warm-dark">
          目前沒有開放的活動
        </h2>
        <p className="text-warm-dark/50">新活動即將推出，敬請期待！</p>
      </div>
    </div>
  );
}
