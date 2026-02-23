"use client";

import { useEffect, useState } from "react";
import { QRCodeDisplay } from "@/components/shared/qrcode-display";

export default function SharePage() {
  const [loginUrl, setLoginUrl] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only value from window.location
    setLoginUrl(`${window.location.origin}/login`);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">QR Code 分享</h1>
        <p className="text-muted-foreground">分享此 QR Code 讓會友掃描後登入或註冊帳號</p>
      </div>

      <div className="bg-card rounded-lg border p-8 flex flex-col items-center gap-4 max-w-md">
        <h2 className="text-lg font-semibold">登入頁面 QR Code</h2>
        {loginUrl ? (
          <QRCodeDisplay
            url={loginUrl}
            label="掃描後可登入或註冊帳號"
            downloadFileName="login-qrcode.png"
          />
        ) : (
          <div className="w-[200px] h-[200px] bg-muted animate-pulse rounded" />
        )}
      </div>
    </div>
  );
}
