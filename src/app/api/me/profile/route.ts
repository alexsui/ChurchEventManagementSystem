import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateOwnProfile } from "@/services/user.service";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phone } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "請輸入您的真實姓名" },
      { status: 400 }
    );
  }

  if (!/^[\u4e00-\u9fff]{2,}$/.test(name.trim())) {
    return NextResponse.json(
      { error: "姓名請輸入至少兩個中文字，不接受英文或其他字元" },
      { status: 400 }
    );
  }

  const user = await updateOwnProfile(session.user.id, {
    name: name.trim(),
    phone: phone?.trim() || undefined,
  });

  return NextResponse.json(user);
}
