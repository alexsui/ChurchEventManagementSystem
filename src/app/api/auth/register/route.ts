import { NextResponse } from "next/server";
import { registerUser, UserServiceError } from "@/services/user.service";

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await registerUser(body);
    return NextResponse.json({ message: "註冊成功", userId: result.userId }, { status: 201 });
  } catch (error) {
    if (error instanceof UserServiceError) {
      const statusMap: Record<string, number> = {
        MISSING_FIELDS: 400,
        INVALID_NAME: 400,
        DUPLICATE_USER: 409,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "註冊失敗，請稍後再試" }, { status: 500 });
  }
}
