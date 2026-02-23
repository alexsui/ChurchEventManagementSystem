"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-warm-cream">
          <div className="font-display text-warm-dark/50 text-lg">載入中...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/events";

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-cream px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-warm-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-warm-blue/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 sparkle">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <path
            d="M14 0L16.8 11.2L28 14L16.8 16.8L14 28L11.2 16.8L0 14L11.2 11.2L14 0Z"
            fill="#E8B44B"
            fillOpacity="0.3"
          />
        </svg>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-warm-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white">
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-warm-dark">歡迎回來</h1>
          <p className="text-warm-dark/50 mt-2">登入或註冊帳號開始報名活動</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
          {/* LINE Login */}
          <Button
            variant="outline"
            className="w-full bg-[#06C755] text-white hover:bg-[#05b34d] hover:text-white rounded-2xl h-12 font-display font-bold text-base border-0 shadow-sm hover:shadow-md transition-all"
            onClick={() => signIn("line", { callbackUrl })}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            用 LINE 登入
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-sand" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-warm-dark/40 font-medium">或使用帳號密碼</span>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 bg-warm-cream rounded-2xl p-1 group-data-[orientation=horizontal]/tabs:h-auto">
              <TabsTrigger
                value="login"
                className="h-auto border-0 rounded-xl py-2.5 font-display font-semibold data-[state=active]:bg-white data-[state=active]:text-warm-dark"
              >
                登入
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="h-auto border-0 rounded-xl py-2.5 font-display font-semibold data-[state=active]:bg-white data-[state=active]:text-warm-dark"
              >
                註冊
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm callbackUrl={callbackUrl} />
            </TabsContent>
            <TabsContent value="register">
              <RegisterForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  name,
  placeholder,
  required,
}: {
  id: string;
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        placeholder={placeholder}
        className="rounded-xl border-warm-sand bg-warm-cream/50 h-11 pr-10 focus:border-warm-green focus:ring-warm-green/20"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-dark/40 hover:text-warm-dark/70 transition-colors"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
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
        <Label htmlFor="login-email" className="text-warm-dark/70 font-medium text-sm">
          Email
        </Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className="rounded-xl border-warm-sand bg-warm-cream/50 h-11 focus:border-warm-green focus:ring-warm-green/20"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password" className="text-warm-dark/70 font-medium text-sm">
          密碼
        </Label>
        <PasswordInput id="login-password" name="password" required placeholder="輸入密碼" />
      </div>
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl font-medium">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-warm-green hover:bg-warm-green/90 text-white rounded-xl h-11 font-display font-bold text-base shadow-sm hover:shadow-md transition-all"
        disabled={loading}
      >
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
    const name = (formData.get("name") as string).trim();
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!/^[\u4e00-\u9fff]{2,}$/.test(name)) {
      setError("姓名請輸入至少兩個中文字，不接受英文或其他字元");
      setLoading(false);
      return;
    }

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
      <div className="text-center py-6 space-y-3">
        <div className="w-12 h-12 bg-warm-green/10 rounded-full flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-warm-green">
            <path
              d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <p className="text-warm-green font-display font-bold text-lg">註冊成功！</p>
        <p className="text-warm-dark/50 text-sm">請切換到「登入」分頁進行登入</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="reg-name" className="text-warm-dark/70 font-medium text-sm">
          姓名 *
        </Label>
        <Input
          id="reg-name"
          name="name"
          required
          placeholder="您的中文姓名"
          className="rounded-xl border-warm-sand bg-warm-cream/50 h-11 focus:border-warm-green focus:ring-warm-green/20"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email" className="text-warm-dark/70 font-medium text-sm">
          Email *
        </Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className="rounded-xl border-warm-sand bg-warm-cream/50 h-11 focus:border-warm-green focus:ring-warm-green/20"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-phone" className="text-warm-dark/70 font-medium text-sm">
          電話
        </Label>
        <Input
          id="reg-phone"
          name="phone"
          type="tel"
          placeholder="0912345678"
          className="rounded-xl border-warm-sand bg-warm-cream/50 h-11 focus:border-warm-green focus:ring-warm-green/20"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password" className="text-warm-dark/70 font-medium text-sm">
          密碼 *
        </Label>
        <PasswordInput id="reg-password" name="password" required placeholder="至少 8 個字元" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-confirm" className="text-warm-dark/70 font-medium text-sm">
          確認密碼 *
        </Label>
        <PasswordInput
          id="reg-confirm"
          name="confirmPassword"
          required
          placeholder="再次輸入密碼"
        />
      </div>
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl font-medium">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-warm-green hover:bg-warm-green/90 text-white rounded-xl h-11 font-display font-bold text-base shadow-sm hover:shadow-md transition-all"
        disabled={loading}
      >
        {loading ? "註冊中..." : "註冊"}
      </Button>
    </form>
  );
}
