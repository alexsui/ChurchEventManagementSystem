"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateQRCodeDataURL } from "@/lib/qrcode";

interface QRCodeDisplayProps {
  url: string;
  label?: string;
  downloadFileName?: string;
}

export function QRCodeDisplay({ url, label, downloadFileName }: QRCodeDisplayProps) {
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

  function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = downloadFileName || "qrcode.png";
    link.href = dataUrl;
    link.click();
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
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          複製連結
        </Button>
        {downloadFileName && dataUrl && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            下載 QR Code
          </Button>
        )}
      </div>
    </div>
  );
}
