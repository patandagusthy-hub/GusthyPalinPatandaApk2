import React, { useState } from "react";
import { X, Copy, Check, Download, ExternalLink, Printer, Sparkles, Smartphone } from "lucide-react";
import { Student } from "../types";

interface QrCodeZoomModalProps {
  student: Student;
  qrDataUrl: string;
  payload: string;
  qrFormat: "url" | "token";
  onClose: () => void;
}

export const QrCodeZoomModal: React.FC<QrCodeZoomModalProps> = ({
  student,
  qrDataUrl,
  payload,
  qrFormat,
  onClose,
}) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(student.startBarcodeToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(payload);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR_PESERTA_${student.nisn}_${student.name.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  const handlePrintSingle = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl relative text-left my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">
              Pratinjau QR Code HD
            </span>
            <h3 className="text-lg font-black text-white">{student.name}</h3>
            <p className="text-xs text-slate-400">
              NISN: <strong className="text-slate-200 font-mono">{student.nisn}</strong> &bull; Kelas:{" "}
              <strong className="text-slate-200">{student.className}</strong>
            </p>
          </div>
        </div>

        {/* QR Code Big Container */}
        <div className="my-6 text-center">
          <div className="inline-block p-4 bg-white rounded-3xl shadow-2xl border-4 border-white">
            <img
              src={qrDataUrl}
              alt={`QR Code ${student.name}`}
              className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto select-none"
            />
          </div>

          {/* Token Pill */}
          <div className="mt-4 flex items-center justify-center space-x-2">
            <span className="font-mono text-sm font-black text-cyan-300 bg-slate-950 px-4 py-1.5 rounded-xl border border-cyan-500/30 shadow-inner">
              {student.startBarcodeToken}
            </span>
            <button
              type="button"
              onClick={handleCopyToken}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Salin Token"
            >
              {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Google Lens Guide */}
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-start space-x-2.5 text-left">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Panduan Scan Google Lens:</p>
              <p className="text-[11px] text-emerald-300/90 mt-0.5 leading-relaxed">
                {qrFormat === "url" ? (
                  <>
                    Arahkan kamera <strong>Google Lens</strong> pada smartphone ke QR code di atas. Ketuk chip tautan{" "}
                    <strong>&ldquo;Buka Situs Web&rdquo;</strong> yang muncul di layar untuk langsung masuk ke akun ujian siswa tanpa perlu ketik manual.
                  </>
                ) : (
                  <>
                    Arahkan <strong>Google Lens</strong> atau <strong>Barcode Scanner USB</strong> ke QR code untuk membaca kode token:{" "}
                    <strong className="font-mono text-white">{student.startBarcodeToken}</strong>.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDownloadQr}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Unduh PNG</span>
          </button>

          {qrFormat === "url" ? (
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? "Tersalin!" : "Salin URL"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopyToken}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
            >
              {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedToken ? "Tersalin!" : "Salin Token"}</span>
            </button>
          )}

          {qrFormat === "url" && (
            <a
              href={payload}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <span>Test Tautan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
