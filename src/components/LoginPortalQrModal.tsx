import React, { useState, useEffect } from "react";
import {
  X,
  QrCode,
  Sparkles,
  Smartphone,
  Copy,
  Check,
  Download,
  ExternalLink,
  Printer,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Info,
  Layers,
  GraduationCap,
  Globe,
  Settings2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  generateQRCode,
  getLoginPortalUrl,
  getPublicAppOrigin,
  setCustomPortalOrigin,
} from "../utils/barcodeUtils";

interface LoginPortalQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionName?: string;
  academicYear?: string;
}

export const LoginPortalQrModal: React.FC<LoginPortalQrModalProps> = ({
  isOpen,
  onClose,
  institutionName = "SMK / SMA Ujian Berstandar Nasional & Internasional",
  academicYear = "2025/2026",
}) => {
  const [targetRole, setTargetRole] = useState<"siswa" | "portal">("siswa");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreenProjector, setIsFullscreenProjector] = useState(false);
  const [projectorTheme, setProjectorTheme] = useState<"dark" | "light">("dark");
  const [errorLevel, setErrorLevel] = useState<"M" | "H">("H");
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [customOriginInput, setCustomOriginInput] = useState<string>(() => getPublicAppOrigin());

  const portalUrl = getLoginPortalUrl(targetRole, customOriginInput);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    const size = isFullscreenProjector ? 650 : 450;

    generateQRCode(portalUrl, {
      width: size,
      margin: 4, // ISO 4-module quiet zone ensures 100% Google Lens recognition
      errorCorrectionLevel: errorLevel,
      darkColor: "#000000",
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
  }, [isOpen, portalUrl, isFullscreenProjector, errorLevel]);

  if (!isOpen) return null;

  const handleApplyCustomOrigin = (newOrigin: string) => {
    setCustomOriginInput(newOrigin);
    setCustomPortalOrigin(newOrigin);
  };

  const handleResetOrigin = () => {
    setCustomPortalOrigin("");
    const defaultOrigin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "https://gusthypalinpatandaexam.ai.studio";
    setCustomOriginInput(defaultOrigin);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR_Akses_Laman_Login_Siswa_${targetRole}.png`;
    link.click();
  };

  const handlePrintPoster = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      {/* Container - changes if in Fullscreen Projector mode */}
      <div
        className={`w-full transition-all duration-300 relative text-left my-auto ${
          isFullscreenProjector
            ? `fixed inset-0 z-50 flex flex-col justify-between p-6 sm:p-10 ${
                projectorTheme === "dark" ? "bg-slate-950 text-white" : "bg-white text-slate-900"
              }`
            : "max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl"
        }`}
      >
        {/* Printable Poster Container (Special CSS Class for Print) */}
        <div className="hidden print:block print:w-full text-center p-8 bg-white text-slate-900">
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-xl font-extrabold uppercase tracking-wide">
              {institutionName}
            </h1>
            <h2 className="text-sm font-semibold text-slate-700">
              Tahun Ajaran {academicYear} &bull; Portal Ujian Berbasis Komputer &amp; Smartphone (CBT)
            </h2>
          </div>

          <div className="my-6">
            <div className="inline-block p-4 border-4 border-slate-900 rounded-2xl bg-white">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code Akses Laman Login Siswa"
                  className="w-72 h-72 mx-auto object-contain"
                />
              )}
            </div>
            <p className="font-mono text-sm font-bold mt-4 text-slate-800 break-all">
              {portalUrl}
            </p>
          </div>

          <div className="max-w-md mx-auto text-left border border-slate-300 rounded-xl p-4 mt-6 bg-slate-50">
            <h3 className="font-bold text-sm text-slate-900 mb-2">
              Petunjuk Masuk untuk Siswa:
            </h3>
            <ol className="list-decimal list-inside text-xs space-y-1.5 text-slate-700">
              <li>Buka kamera smartphone, aplikasi <strong>Google Lens</strong>, atau pemindai QR.</li>
              <li>Arahkan kamera ke QR Code di atas.</li>
              <li>Ketuk notifikasi / tombol <strong>&ldquo;Buka Situs Web&rdquo;</strong> yang muncul di layar.</li>
              <li>Masukkan NISN &amp; password atau pindai kartu barcode peserta ujian Anda.</li>
            </ol>
          </div>

          <p className="text-[10px] text-slate-500 mt-8">
            Dicetak melalui Sistem GusthyPalinPatandaExam &bull; Harap letakkan di pintu ruang ujian atau meja pengawas.
          </p>
        </div>

        {/* Screen View Header */}
        <div className="print:hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-black text-white">
                    Barcode / QR Code Akses Laman Login
                  </h3>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase">
                    Google Lens Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Scan langsung menggunakan Google Lens, Kamera iPhone/Android, atau Barcode Reader untuk membuka laman login siswa
                </p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setIsFullscreenProjector(!isFullscreenProjector)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title={isFullscreenProjector ? "Keluar Layar Penuh" : "Mode Proyektor Layar Penuh"}
              >
                {isFullscreenProjector ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Target & Settings Bar */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300">Tujuan:</span>
              <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTargetRole("siswa")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                    targetRole === "siswa"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Tab Login Siswa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetRole("portal")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                    targetRole === "portal"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Beranda Portal</span>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setErrorLevel(errorLevel === "H" ? "M" : "H")}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition ${
                  errorLevel === "H"
                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
                title="Koreksi kesalahan Level H (30% pemulihan) sangat tahan terhadap pantulan cahaya dan silau layar smartphone"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Anti-Silau {errorLevel === "H" ? "Tinggi (Level H)" : "Standar (Level M)"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                className={`p-1.5 rounded-xl border text-xs font-bold flex items-center cursor-pointer transition ${
                  showAdvancedConfig
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
                title="Atur Alamat IP Lab / Domain Server"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              {isFullscreenProjector && (
                <button
                  type="button"
                  onClick={() =>
                    setProjectorTheme(projectorTheme === "dark" ? "light" : "dark")
                  }
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer bg-slate-800 border-slate-700 text-slate-200 hover:text-white"
                >
                  {projectorTheme === "dark" ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Latar Terang</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-blue-400" />
                      <span>Latar Gelap</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Advanced Domain / Local IP Configuration Bar */}
          {showAdvancedConfig && (
            <div className="mt-3 p-3.5 rounded-2xl bg-slate-950 border border-blue-500/40 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-blue-300 flex items-center space-x-1">
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Kustomisasi Domain / Alamat IP Jaringan Lokal (Lab Komputer):</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetOrigin}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Bawaan</span>
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customOriginInput}
                  onChange={(e) => handleApplyCustomOrigin(e.target.value)}
                  placeholder="Contoh: http://192.168.1.100:3000 atau https://namasekolah.com"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                *Jika ujian dilaksanakan di Lab Komputer tanpa internet, masukkan IP lokal server (contoh: <code>http://192.168.1.10:3000</code>) agar HP siswa di Wi-Fi lokal dapat langsung memindai &amp; mengakses.
              </p>
            </div>
          )}

          {/* Center QR Display Area */}
          <div className="my-5 text-center flex flex-col items-center justify-center">
            <div
              className={`p-4 sm:p-5 rounded-3xl shadow-2xl border-4 transition-transform duration-200 ${
                isFullscreenProjector
                  ? "p-6 sm:p-8 bg-white border-white scale-105"
                  : "bg-white border-white hover:scale-[1.01]"
              }`}
            >
              {loading || !qrDataUrl ? (
                <div className="w-60 h-60 sm:w-72 sm:h-72 bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 text-xs font-bold">
                  Menghasilkan QR Code HD...
                </div>
              ) : (
                <img
                  src={qrDataUrl}
                  alt="QR Code Akses Laman Login Siswa"
                  className={`${
                    isFullscreenProjector
                      ? "w-72 h-72 sm:w-96 sm:h-96 md:w-[420px] md:h-[420px]"
                      : "w-56 h-56 sm:w-64 sm:h-64"
                  } object-contain mx-auto select-none`}
                  style={{ imageRendering: "pixelated" }}
                />
              )}
            </div>

            {/* Direct URL Display & Copy */}
            <div className="mt-4 max-w-lg w-full flex items-center justify-center space-x-2">
              <div className="flex-1 min-w-0 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs truncate text-left">
                {portalUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition flex items-center space-x-1.5 text-xs font-bold cursor-pointer shrink-0"
                title="Salin Tautan Web Laman Login"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin URL</span>
                  </>
                )}
              </button>
            </div>

            {/* Google Lens Step-by-Step Guide */}
            <div className="mt-4 max-w-xl w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-blue-950/40 border border-emerald-500/30 text-left">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs mb-2">
                <Sparkles className="w-4 h-4" />
                <span>Petunjuk Scan Siswa (Google Lens &amp; Kamera HP):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-extrabold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </span>
                  <span>Buka <strong>Google Lens</strong> atau kamera bawaan HP.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-extrabold flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </span>
                  <span>Arahkan kamera ke QR code di atas hingga chip tautan muncul.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-extrabold flex items-center justify-center shrink-0 text-[10px]">
                    3
                  </span>
                  <span>Ketuk <strong>&ldquo;Buka Situs Web&rdquo;</strong> untuk langsung masuk ke halaman login ujian.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PNG</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPoster}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
              title="Cetak lembar pengumuman A4 untuk ditempel di ruang ujian"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Poster A4</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreenProjector(!isFullscreenProjector)}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
            >
              {isFullscreenProjector ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span>Kecilkan</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span>Proyektor Kelas</span>
                </>
              )}
            </button>

            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <span>Uji Buka Laman</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
