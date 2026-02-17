"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateQRCodeDataURL } from "@/lib/qrcode";

interface QRCodeDisplayProps {
  url: string;
  label?: string;
}

export function QRCodeDisplay({ url, label }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    generateQRCodeDataURL(url).then(setDataUrl);
  }, [url]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("已複製連結");
    } catch {
      toast.error("複製失敗");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-sm text-muted-foreground">{label}</p>
      )}
      {dataUrl ? (
        <img src={dataUrl} alt="QR Code" className="w-[200px] h-[200px]" />
      ) : (
        <div className="w-[200px] h-[200px] bg-muted animate-pulse rounded" />
      )}
      <Button variant="outline" size="sm" onClick={handleCopy}>
        複製連結
      </Button>
    </div>
  );
}
