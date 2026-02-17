import Link from "next/link";
import { getEvents } from "@/services/event.service";
import {
  EventCategory,
  EventStatus,
  EventType,
} from "@/generated/prisma/client";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

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

function getCategoryLabel(category: EventCategory): string {
  const map: Record<EventCategory, string> = {
    COURSE: "課程",
    LECTURE: "講座",
    CAMP: "營會",
  };
  return map[category];
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

  const featuredEvent = events[0];
  const remainingEvents = events.slice(1);

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
            {/* Hero Section - Asymmetric Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Featured Event - Large Card */}
              {featuredEvent && (
                <Link
                  href={`/events/${featuredEvent.id}`}
                  className="lg:col-span-2 block"
                >
                  <div className="warm-card relative bg-warm-gold rounded-3xl p-8 min-h-[380px] flex flex-col justify-between overflow-hidden group">
                    {/* Decorative elements */}
                    <div className="absolute top-6 left-6 sparkle">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 28 28"
                        fill="none"
                      >
                        <path
                          d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z"
                          fill="white"
                          fillOpacity="0.6"
                        />
                      </svg>
                    </div>
                    <div className="absolute top-20 right-12 sparkle" style={{ animationDelay: "0.5s" }}>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 28 28"
                        fill="none"
                      >
                        <path
                          d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z"
                          fill="white"
                          fillOpacity="0.4"
                        />
                      </svg>
                    </div>

                    {/* Large decorative background text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                      <span className="font-display text-[120px] sm:text-[180px] font-bold text-white/15 leading-none tracking-tight">
                        JOIN
                      </span>
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        {featuredEvent.status === EventStatus.OPEN && (
                          <span className="badge-pulse inline-flex items-center bg-warm-green text-white text-sm font-display font-bold px-4 py-1.5 rounded-full shadow-md">
                            {getStatusLabel(featuredEvent.status)}
                          </span>
                        )}
                        {featuredEvent.category && (
                          <span className="inline-flex items-center bg-white/25 text-white text-sm font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                            {getCategoryLabel(featuredEvent.category)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="relative z-10 space-y-4">
                      <h2 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight drop-shadow-sm">
                        {featuredEvent.title}
                      </h2>
                      {featuredEvent.description && (
                        <p className="text-white/80 text-lg max-w-md line-clamp-2">
                          {featuredEvent.description}
                        </p>
                      )}

                      <div className="flex items-center gap-6 pt-2">
                        {/* Registration count badge */}
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-warm-green rounded-full flex items-center justify-center shadow-md">
                            <span className="text-white font-display font-bold text-sm">
                              {featuredEvent._count.registrations}
                            </span>
                          </div>
                          <span className="text-white/70 text-sm">
                            人已報名
                            {featuredEvent.maxParticipants !== null &&
                              ` / ${featuredEvent.maxParticipants}`}
                          </span>
                        </div>

                        {/* Date */}
                        {featuredEvent.eventSessions[0] && (
                          <span className="text-white/70 text-sm">
                            {formatDate(
                              featuredEvent.eventSessions[0].sessionDate
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Explore button */}
                    <div className="absolute bottom-8 right-8 z-10">
                      <div className="bg-warm-dark text-white font-display font-bold px-6 py-3 rounded-full shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all flex items-center gap-2">
                        查看詳情
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          className="transition-transform group-hover:translate-x-1"
                        >
                          <path
                            d="M6 3L11 8L6 13"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Side Cards Stack */}
              <div className="flex flex-col gap-5">
                {/* Category Card: Courses */}
                <Link
                  href="#courses"
                  className="block"
                >
                  <div className="warm-card bg-warm-blue rounded-3xl p-6 min-h-[178px] flex flex-col justify-between relative overflow-hidden">
                    <div>
                      <h3 className="font-display text-3xl font-bold text-warm-dark">
                        課程
                      </h3>
                      <p className="text-warm-dark/60 text-sm mt-1">
                        探索信仰成長課程
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="bg-warm-dark text-white font-display font-semibold text-sm px-4 py-2 rounded-full inline-flex items-center gap-1.5">
                        探索
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M6 3L11 8L6 13"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <span className="text-4xl">{getCategoryIcon(EventCategory.COURSE)}</span>
                    </div>
                    {/* Decorative circle */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/20 rounded-full" />
                  </div>
                </Link>

                {/* Category Card: Camps */}
                <Link
                  href="#camps"
                  className="block"
                >
                  <div className="warm-card bg-warm-terra rounded-3xl p-6 min-h-[178px] flex flex-col justify-between relative overflow-hidden">
                    <div>
                      <h3 className="font-display text-3xl font-bold text-white">
                        營會
                      </h3>
                      <p className="text-white/70 text-sm mt-1">
                        參加精彩營會活動
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      {campEvents.length > 0 ? (
                        <div className="bg-warm-green text-white font-display font-bold text-sm px-4 py-1.5 rounded-full shadow-md">
                          {campEvents.length} 個營會
                        </div>
                      ) : (
                        <div className="text-white/50 text-sm font-medium">
                          敬請期待
                        </div>
                      )}
                      <span className="text-4xl">{getCategoryIcon(EventCategory.CAMP)}</span>
                    </div>
                    {/* Decorative circle */}
                    <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/10 rounded-full" />
                  </div>
                </Link>
              </div>
            </div>

            {/* Events List Section */}
            {remainingEvents.length > 0 && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
                <h2 className="font-display text-3xl font-bold text-warm-dark mb-6">
                  所有活動
                </h2>

                <div className="space-y-4">
                  {remainingEvents.map((event) => {
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
                            <h3 className="font-display font-bold text-warm-dark text-lg group-hover:text-warm-green transition-colors">
                              {event.title}
                            </h3>
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
                                  : formatShortDate(
                                      firstSession.sessionDate
                                    )}
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
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M6 3L11 8L6 13"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All events in one list when there's only 1 event and it's featured */}
            {remainingEvents.length === 0 && events.length === 1 && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm text-center">
                <p className="text-warm-dark/50 font-medium">
                  目前只有一個活動開放中，快來參加吧！
                </p>
              </div>
            )}
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
