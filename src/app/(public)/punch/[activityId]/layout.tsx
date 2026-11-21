import type { Metadata } from "next";
import { getPunchActivityTitle } from "@/services/punch.service";

/** Shared punch links preview with the activity name (the page itself is a client component). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ activityId: string }>;
}): Promise<Metadata> {
  const { activityId } = await params;
  const title = await getPunchActivityTitle(activityId);
  return title ? { title, openGraph: { title } } : {};
}

export default function PunchActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
