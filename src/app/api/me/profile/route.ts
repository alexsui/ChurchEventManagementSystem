import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateOwnProfile } from "@/services/user.service";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權，請先登入" }, { status: 401 });
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

  try {
    const user = await updateOwnProfile(session.user.id, {
      name: name.trim(),
      phone: phone?.trim() || undefined,
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "更新失敗，請確認資料後重試" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "更新失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
