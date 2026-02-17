import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getRegistrationsByUser } from "@/services/registration.service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    REGISTERED: "已報名",
    WAITLISTED: "候補中",
    CANCELLED: "已取消",
  };
  return map[status] ?? status;
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    REGISTERED: "default",
    WAITLISTED: "secondary",
    CANCELLED: "destructive",
  };
  return map[status] ?? "outline";
}

export default async function MyRegistrationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/my/registrations");
  }

  const registrations = await getRegistrationsByUser(session.user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">我的報名紀錄</h1>
          <p className="text-muted-foreground mt-1">查看您報名過的活動</p>
        </div>

        {registrations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">尚無報名紀錄</p>
            </CardContent>
          </Card>
        ) : (
          registrations.map((reg) => (
            <Link
              key={reg.id}
              href={`/events/${reg.eventId}`}
              className="block"
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-lg">
                      {reg.event.title}
                    </CardTitle>
                    <Badge variant={getStatusVariant(reg.status)}>
                      {getStatusLabel(reg.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    報名日期：{formatDate(reg.createdAt)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
