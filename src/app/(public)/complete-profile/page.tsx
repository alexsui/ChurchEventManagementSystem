"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-warm-cream">
          <div className="font-display text-warm-dark/50 text-lg">
            載入中...
          </div>
        </div>
      }
    >
      <CompleteProfileContent />
    </Suspense>
  );
}

function CompleteProfileContent() {
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/events";

  const [name, setName] = useState(session?.user?.name || "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入您的真實姓名");
      return;
    }
    if (!/^[\u4e00-\u9fff]{2,}$/.test(trimmed)) {
      setError("姓名請輸入至少兩個中文字，不接受英文或其他字元");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "更新失敗，請稍後再試");
        setLoading(false);
        return;
      }

      // Refresh the session so middleware sees profileCompleted = true
      // Use window.location to force a full page reload with fresh session
      window.location.href = callbackUrl;
    } catch {
      setError("更新失敗，請稍後再試");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-cream px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-warm-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-warm-blue/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-warm-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-warm-dark">
            完善個人資料
          </h1>
          <p className="text-warm-dark/50 mt-2">
            為了方便辨識身分，請填寫您的真實姓名
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="profile-name"
                className="text-warm-dark/70 font-medium text-sm"
              >
                真實姓名 *
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="請輸入您的真實姓名"
                className="rounded-xl border-warm-sand bg-warm-cream/50 h-11 focus:border-warm-green focus:ring-warm-green/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="profile-phone"
                className="text-warm-dark/70 font-medium text-sm"
              >
                電話
              </Label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="0912345678"
                className="rounded-xl border-warm-sand bg-warm-cream/50 h-11 focus:border-warm-green focus:ring-warm-green/20"
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
              {loading ? "儲存中..." : "完成設定"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
