"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  qrCode: string;
  size?: number;
}

export function QRCodeDisplay({ qrCode, size = 200 }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const ticketUrl = `${window.location.origin}/ticket/${encodeURIComponent(qrCode)}`
      QRCode.toCanvas(canvasRef.current, ticketUrl, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    }
  }, [qrCode, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="border rounded-lg shadow-sm" />
      <p className="text-xs text-muted-foreground font-mono">{qrCode}</p>
    </div>
  );
}
