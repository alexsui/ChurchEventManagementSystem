import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateOwnProfile } from "@/services/user.service";
import { updateProfileSchema } from "@/lib/validations";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const user = await updateOwnProfile(session.user.id, {
      name: parsed.data.name.trim(),
      phone: parsed.data.phone?.trim() || undefined,
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "更新失敗，請確認資料後重試" }, { status: 409 });
    }
    return NextResponse.json({ error: "更新失敗，請稍後再試" }, { status: 500 });
  }
}
