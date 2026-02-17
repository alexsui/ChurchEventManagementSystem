"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">載入中...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin/events";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">教會活動管理系統</CardTitle>
          <CardDescription>登入或註冊帳號</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full bg-[#06C755] text-white hover:bg-[#05b34d] hover:text-white"
              onClick={() => signIn("line", { callbackUrl })}
            >
              用 LINE 登入
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">
                  或使用帳號密碼
                </span>
              </div>
            </div>

            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">登入</TabsTrigger>
                <TabsTrigger value="register">註冊</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm callbackUrl={callbackUrl} />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email 或密碼錯誤");
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">密碼</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          required
          placeholder="輸入密碼"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "登入中..." : "登入"}
      </Button>
    </form>
  );
}

function RegisterForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("密碼不一致");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("密碼至少需要 8 個字元");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password,
          phone: formData.get("phone") || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("註冊失敗，請稍後再試");
    }

    setLoading(false);
  }

  if (success) {
    return (
      <div className="text-center py-4 space-y-2">
        <p className="text-green-600 font-medium">註冊成功！</p>
        <p className="text-sm text-muted-foreground">
          請切換到「登入」分頁進行登入
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="reg-name">姓名 *</Label>
        <Input id="reg-name" name="name" required placeholder="您的姓名" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email">Email *</Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-phone">電話</Label>
        <Input
          id="reg-phone"
          name="phone"
          type="tel"
          placeholder="0912345678"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">密碼 *</Label>
        <Input
          id="reg-password"
          name="password"
          type="password"
          required
          placeholder="至少 8 個字元"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-confirm">確認密碼 *</Label>
        <Input
          id="reg-confirm"
          name="confirmPassword"
          type="password"
          required
          placeholder="再次輸入密碼"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "註冊中..." : "註冊"}
      </Button>
    </form>
  );
}
