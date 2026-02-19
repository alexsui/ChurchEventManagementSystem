export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getRegistrationsByUser } from "@/services/registration.service";
import { registrationStatusLabels } from "@/lib/constants";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusStyle(status: string): string {
  const map: Record<string, string> = {
    REGISTERED: "bg-warm-green text-white",
    WAITLISTED: "bg-warm-gold text-warm-dark",
    CANCELLED: "bg-warm-dark/20 text-warm-dark/60",
  };
  return map[status] ?? "bg-warm-sand text-warm-dark/60";
}

function getStatusIcon(status: string): string {
  const map: Record<string, string> = {
    REGISTERED: "M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z",
    WAITLISTED:
      "M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12S7.58 4 12 4 20 7.58 20 12 16.42 20 12 20ZM12.5 7H11V13L16.25 16.15L17 14.92L12.5 12.25V7Z",
    CANCELLED:
      "M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z",
  };
  return map[status] ?? "";
}

export default async function MyRegistrationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/my/registrations");
  }

  const registrations = await getRegistrationsByUser(session.user.id);

  return (
    <div className="min-h-screen bg-warm-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-warm-dark">
            我的報名紀錄
          </h1>
          <p className="text-warm-dark/50">查看您報名過的活動</p>
        </div>

        {registrations.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 shadow-sm text-center">
            <div className="w-16 h-16 bg-warm-gold/15 rounded-2xl flex items-center justify-center mx-auto mb-4 float-anim">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                className="text-warm-gold"
              >
                <path
                  d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"
                  fill="currentColor"
                  opacity="0.6"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-bold text-warm-dark mb-2">
              尚無報名紀錄
            </h2>
            <p className="text-warm-dark/50 mb-6">
              前往活動列表瀏覽並報名活動
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 bg-warm-green text-white font-display font-bold px-6 py-3 rounded-full shadow-sm hover:shadow-md hover:bg-warm-green/90 transition-all"
            >
              瀏覽活動
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 3L11 8L6 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="space-y-3">
              {registrations.map((reg) => (
                <Link
                  key={reg.id}
                  href={`/events/${reg.eventId}`}
                  className="block"
                >
                  <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-warm-cream/60 transition-colors group">
                    {/* Status icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getStatusStyle(reg.status)}`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d={getStatusIcon(reg.status)} />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-warm-dark text-lg group-hover:text-warm-green transition-colors truncate">
                        {reg.event.title}
                      </h3>
                      <p className="text-warm-dark/50 text-sm">
                        報名日期：{formatDate(reg.createdAt)}
                      </p>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center text-xs font-display font-bold px-3 py-1 rounded-full shrink-0 ${getStatusStyle(reg.status)}`}
                    >
                      {registrationStatusLabels[reg.status] ?? reg.status}
                    </span>

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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
