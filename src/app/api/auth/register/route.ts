import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { name, email, password, phone } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "姓名、Email 及密碼為必填欄位" }, { status: 400 });
    }

    if (!/^[\u4e00-\u9fff]{2,}$/.test(name.trim())) {
      return NextResponse.json(
        { error: "姓名請輸入至少兩個中文字，不接受英文或其他字元" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "註冊失敗，請確認資料後重試" }, { status: 409 });
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        return NextResponse.json({ error: "註冊失敗，請確認資料後重試" }, { status: 409 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        profileCompleted: true,
      },
    });

    return NextResponse.json({ message: "註冊成功", userId: user.id }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "註冊失敗，請稍後再試" }, { status: 500 });
  }
}
