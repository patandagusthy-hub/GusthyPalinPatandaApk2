import React, { useState, useEffect } from "react";
import { QrCode, Maximize2, Copy, Check, Download, ExternalLink, Sparkles } from "lucide-react";
import { Student } from "../types";
import { generateQRCode, getStudentQrPayload } from "../utils/barcodeUtils";

interface StudentQrCardProps {
  student: Student;
  qrFormat?: "url" | "token";
  institutionName?: string;
  academicYear?: string;
  onOpenZoom?: (student: Student, qrDataUrl: string, payload: string) => void;
  className?: string;
}

export const StudentQrCard: React.FC<StudentQrCardProps> = ({
  student,
  qrFormat = "url",
  institutionName = "SMK / SMA Negeri Unggulan",
  academicYear = "2025/2026",
  onOpenZoom,
  className = "",
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const formatMode: "url" | "token" = qrFormat === "token" ? "token" : "url";
  const payload = getStudentQrPayload(
    student.startBarcodeToken,
    student.nisn,
    formatMode,
    student.id,
    student.className
  );

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    generateQRCode(payload, {
      width: 400,
      margin: 4, // 4 modules ISO quiet zone for 100% reliable Google Lens recognition
      errorCorrectionLevel: "M",
      darkColor: "#000000", // Pure black for infinite contrast against pure white
      lightColor: "#ffffff",
    }).then((url) => {
      if (isMounted) {
        setQrDataUrl(url);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [payload]);

  const handleCopyToken = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(student.startBarcodeToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR_${student.nisn}_${student.name.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  return (
    <div
      className={`student-exam-card bg-slate-950 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg hover:shadow-xl transition relative overflow-hidden group ${className}`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800/80">
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider">
                Kartu Peserta Ujian
              </span>
              <span className="text-[9px] text-slate-500 font-medium">
                {academicYear}
              </span>
            </div>
            <h4 className="font-extrabold text-sm sm:text-base text-slate-100 truncate mt-0.5">
              {student.name}
            </h4>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
              <span>NISN: <strong className="text-slate-300 font-mono">{student.nisn}</strong></span>
              <span>&bull;</span>
              <span>Kelas: <strong className="text-slate-300">{student.className}</strong></span>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
            {student.name.charAt(0)}
          </div>
        </div>

        {/* Real Standard QR Code Visual */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-center relative">
          {/* Purpose Tag */}
          <div className="mb-2.5 inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Peruntukan: Barcode Login &amp; Verifikasi Peserta</span>
          </div>

          <div className="relative inline-block mx-auto max-w-full">
            <div
              onClick={() => onOpenZoom && qrDataUrl && onOpenZoom(student, qrDataUrl, payload)}
              className="w-36 h-36 sm:w-40 sm:h-40 mx-auto bg-white rounded-xl p-2.5 flex items-center justify-center shadow-md cursor-pointer hover:ring-2 hover:ring-blue-500/60 transition-all overflow-hidden"
              title="Klik untuk memperbesar QR Code di layar"
            >
              {loading || !qrDataUrl ? (
                <div className="w-full h-full bg-slate-100 animate-pulse rounded flex items-center justify-center text-slate-400 text-xs font-semibold">
                  Membuat QR...
                </div>
              ) : (
                <img
                  src={qrDataUrl}
                  alt={`QR Code ${student.name}`}
                  className="w-full h-full object-contain select-none"
                  loading="lazy"
                />
              )}
            </div>

            {/* Quick Zoom Button Overlay */}
            {onOpenZoom && qrDataUrl && (
              <button
                type="button"
                onClick={() => onOpenZoom(student, qrDataUrl, payload)}
                className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-slate-900/95 hover:bg-blue-600 text-white shadow-md transition cursor-pointer border border-slate-700/60"
                title="Perbesar QR Code"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Token String Display & Copy */}
          <div className="mt-3 flex items-center justify-center space-x-1.5 flex-wrap gap-y-1">
            <span className="font-mono text-xs font-bold text-cyan-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-cyan-500/30 break-all select-all">
              {student.startBarcodeToken}
            </span>
            <button
              type="button"
              onClick={handleCopyToken}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
              title="Salin Token Barcode"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-center space-x-1 text-[10px] font-semibold text-emerald-400">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>
              {qrFormat === "url" ? "Google Lens: Buka otomatis tanpa ketik sandi" : "Scanner Fisik USB / Token Mandiri"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-500">
          Status:{" "}
          <strong
            className={`capitalize ${
              student.examStatus === "submitted"
                ? "text-emerald-400"
                : student.examStatus === "in_progress"
                ? "text-amber-400"
                : student.examStatus === "disqualified"
                ? "text-rose-400"
                : "text-slate-400"
            }`}
          >
            {student.examStatus === "not_started" ? "Belum Ujian" : student.examStatus}
          </strong>
        </span>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleDownloadQr}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
            title="Unduh file PNG QR Code"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {onOpenZoom && qrDataUrl && (
            <button
              type="button"
              onClick={() => onOpenZoom(student, qrDataUrl, payload)}
              className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Perbesar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
