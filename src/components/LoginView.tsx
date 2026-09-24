import React, { useState, useRef, useEffect } from "react";
import {
  Shield,
  UserCheck,
  GraduationCap,
  Lock,
  QrCode,
  ScanLine,
  AlertTriangle,
  Sparkles,
  Camera,
  Upload,
  ArrowRight,
  Info,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  FileImage,
  AlertCircle,
} from "lucide-react";
import { Role, Student } from "../types";
import { HelpdeskSupport } from "./HelpdeskSupport";
import { extractTokenFromScan } from "../utils/barcodeUtils";
import { LoginPortalQrModal } from "./LoginPortalQrModal";
import { StudentCardLookupModal } from "./StudentCardLookupModal";
import jsQR from "jsqr";

function playScanSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // audio not allowed before user gesture, silent ignore
  }
}

interface LoginViewProps {
  onLogin: (identifier: string, pass: string, role: Role) => { success: boolean; message?: string };
  onBarcodeLogin: (barcodeData: string) => { success: boolean; message?: string };
  students: Student[];
  onOpenLoginQrModal?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onBarcodeLogin,
  students,
  onOpenLoginQrModal,
}) => {
  const [activeTab, setActiveTab] = useState<Role>(() => {
    try {
      if (typeof window !== "undefined" && window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (tab === "siswa" || tab === "guru" || tab === "admin") {
          return tab;
        }
      }
    } catch {
      // Ignore location access error
    }
    return "siswa";
  });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLockedAlert, setIsLockedAlert] = useState(false);
  const [localShowLoginQrModal, setLocalShowLoginQrModal] = useState(false);
  const [showStudentLookupModal, setShowStudentLookupModal] = useState(false);

  const handleOpenLoginPortalQr = () => {
    if (onOpenLoginQrModal) {
      onOpenLoginQrModal();
    } else {
      setLocalShowLoginQrModal(true);
    }
  };

  // Barcode Scanner Modal State
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [manualBarcodeInput, setManualBarcodeInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLockedAlert(false);

    if (!identifier.trim()) {
      setErrorMessage("Silakan masukkan NISN / Username!");
      return;
    }

    const res = onLogin(identifier.trim(), password, activeTab);
    if (!res.success) {
      setErrorMessage(res.message || "Gagal login.");
      if (res.message && res.message.includes("AKUN TERKUNCI")) {
        setIsLockedAlert(true);
      }
    }
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const barcodeDetectorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [scannerSearchQuery, setScannerSearchQuery] = useState<string>("");

  // Scan video frames using native BarcodeDetector or jsQR
  const scanFrame = async () => {
    if (!isScanningRef.current) return;
    const video = videoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      // 1. Try modern native BarcodeDetector if supported in Chromium/Android/desktop
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          if (!barcodeDetectorRef.current) {
            barcodeDetectorRef.current = new (window as any).BarcodeDetector({
              formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"],
            });
          }
          const detected = await barcodeDetectorRef.current.detect(video);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            isScanningRef.current = false;
            playScanSuccessBeep();
            handleApplyBarcode(detected[0].rawValue);
            return;
          }
        } catch {
          // Fall through to jsQR
        }
      }

      // 2. jsQR software decoding fallback
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code && code.data && code.data.trim()) {
          isScanningRef.current = false;
          playScanSuccessBeep();
          handleApplyBarcode(code.data);
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Start Camera with resilient fallbacks for mobile, laptop, and desktop webcams
  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    stopCamera();
    setCameraError(null);
    setCameraActive(false);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      } catch (err: any) {
        console.warn("Camera could not be accessed:", err);
        setCameraError(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Izin akses kamera tidak diberikan. Harap izinkan kamera di browser atau unggah foto kartu barcode Anda."
            : "Kamera tidak ditemukan atau sedang digunakan oleh aplikasi lain. Anda dapat mengunggah foto kartu barcode atau mengetik token secara manual."
        );
        return;
      }
    }

    if (stream) {
      mediaStreamRef.current = stream;
      setCameraActive(true);
      isScanningRef.current = true;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          if (!animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(scanFrame);
          }
        };
      }
    }
  };

  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleOpenScanner = () => {
    setIsScanningBarcode(true);
    setErrorMessage(null);
    setCameraError(null);
    startCamera(cameraFacing);
  };

  const handleCloseScanner = () => {
    stopCamera();
    setIsScanningBarcode(false);
    setCameraError(null);
    setIsProcessingFile(false);
  };

  // Process uploaded image containing a QR code or barcode
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setCameraError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setIsProcessingFile(false);
          setCameraError("Gagal membaca kanvas gambar.");
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Try BarcodeDetector first
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"],
            });
            const barcodes = await detector.detect(canvas);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              setIsProcessingFile(false);
              playScanSuccessBeep();
              handleApplyBarcode(barcodes[0].rawValue);
              return;
            }
          } catch {
            // fall through
          }
        }

        // Try jsQR fallback
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: "attemptBoth",
        });

        setIsProcessingFile(false);
        if (code && code.data && code.data.trim()) {
          playScanSuccessBeep();
          handleApplyBarcode(code.data);
        } else {
          setCameraError("QR atau Barcode tidak terdeteksi dalam foto. Pastikan gambar cukup terang, tegak lurus, dan tidak buram.");
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        setCameraError("Gagal memuat berkas gambar.");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleApplyBarcode = (barcodeVal: string) => {
    handleCloseScanner();
    // Pass barcodeVal directly (it preserves all URL query params: id, token, nisn, cls)
    const res = onBarcodeLogin(barcodeVal);
    if (!res.success) {
      // If direct attempt failed, try with extracted clean token
      const cleanToken = extractTokenFromScan(barcodeVal);
      const fallbackRes = cleanToken && cleanToken !== barcodeVal ? onBarcodeLogin(cleanToken) : null;
      if (!fallbackRes || !fallbackRes.success) {
        setErrorMessage(res.message || "Barcode tidak valid!");
        if (res.message && res.message.includes("AKUN TERKUNCI")) {
          setIsLockedAlert(true);
        }
      }
    }
  };

  // Preset fast-login helper
  const handleQuickFill = (role: Role, user: string, pass: string) => {
    setActiveTab(role);
    setIdentifier(user);
    setPassword(pass);
    setErrorMessage(null);
    setIsLockedAlert(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-950 relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        {/* Header Title Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Portal Masuk Ujian Berstandar Nasional & Internasional</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            GusthyPalinPatandaExam
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Sistem Ujian Terkunci Anti-Kecurangan & Proctoring AI Kamera Real-Time
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Quick Banner for Login Portal Barcode (Google Lens Ready) */}
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                    Barcode Akses Laman Login Siswa
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold uppercase">
                    Google Lens Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Siswa dapat memindai barcode menggunakan <strong>Google Lens</strong> atau kamera smartphone untuk langsung membuka menu laman log in ini.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenLoginPortalQr}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/25 transition cursor-pointer shrink-0"
              title="Buka QR Code resolusi tinggi untuk dipindai Google Lens atau diproyeksikan ke layar kelas"
            >
              <QrCode className="w-4 h-4" />
              <span>Tampilkan Barcode Login</span>
            </button>
          </div>

          {/* Role Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("siswa");
                setErrorMessage(null);
                setIsLockedAlert(false);
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
                activeTab === "siswa"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Siswa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("guru");
                setErrorMessage(null);
                setIsLockedAlert(false);
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
                activeTab === "guru"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Guru</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("admin");
                setErrorMessage(null);
                setIsLockedAlert(false);
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
                activeTab === "admin"
                  ? "bg-slate-700 text-white shadow-md shadow-slate-700/25"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </button>
          </div>

          {/* Barcode / QR Scan Actions for Siswa */}
          {activeTab === "siswa" && (
            <div className="mb-6 p-3.5 rounded-xl bg-gradient-to-r from-blue-950/50 to-indigo-950/40 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                    Opsi Cepat Barcode &amp; QR Code Siswa
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Pindai kartu peserta pribadi Anda atau tampilkan QR akses portal ujian
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStudentLookupModal(true)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold text-xs flex items-center justify-center space-x-1.5 border border-emerald-500/40 transition cursor-pointer"
                  title="Cari & Buka Kartu Barcode Ujian Saya (Mudah Diakses)"
                >
                  <Search className="w-4 h-4 text-emerald-400" />
                  <span>Lihat Kartu Saya</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenLoginPortalQr}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
                  title="Tampilkan Barcode Laman Login untuk Google Lens"
                >
                  <QrCode className="w-4 h-4 text-blue-400" />
                  <span>QR Portal Web</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenScanner}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
                  title="Gunakan kamera perangkat ini untuk memindai kartu peserta"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Pindai Kartu</span>
                </button>
              </div>
            </div>
          )}

          {/* Error / Lock Notice */}
          {errorMessage && (
            <div
              className={`p-4 rounded-xl mb-6 flex items-start space-x-3 border ${
                isLockedAlert
                  ? "bg-rose-950/60 border-rose-500/50 text-rose-200"
                  : "bg-red-950/40 border-red-500/40 text-red-300"
              }`}
            >
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs uppercase tracking-wide">
                  {isLockedAlert ? "Peringatan Keamanan: Akun Terkunci" : "Terjadi Kendala"}
                </h5>
                <p className="text-xs mt-0.5 leading-relaxed">{errorMessage}</p>
                {isLockedAlert && (
                  <div className="mt-2.5 space-y-2">
                    <div className="text-[11px] text-rose-300/90 bg-rose-900/30 p-2.5 rounded-xl border border-rose-500/20 leading-relaxed">
                      💡 <strong>Aturan Keamanan:</strong> Siswa hanya dapat login 1 kali untuk
                      mencegah perpindahan perangkat. Silakan hubungi Admin / Pengawas untuk mereset
                      sesi akun Anda melalui nomor WhatsApp di bawah ini.
                    </div>
                    <HelpdeskSupport
                      variant="banner"
                      context="locked"
                      studentNisn={identifier}
                      className="!bg-rose-950/70 !border-rose-500/40 text-rose-100"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {activeTab === "siswa" ? "NISN / ID Siswa / Username" : "Username / Email"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    activeTab === "siswa"
                      ? "Contoh: 0051234001 atau siswa01"
                      : activeTab === "guru"
                      ? "guru"
                      : "admin"
                  }
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Kata Sandi / Password
                </label>
                <span className="text-[11px] text-slate-500">
                  {activeTab === "siswa" ? "Default: siswa123" : "Kredensial Resmi"}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-4 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-slate-300 hover:text-white" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                  )}
                </button>
              </div>
            </div>

            {/* Single Login Rule Reminder */}
            {activeTab === "siswa" && (
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start space-x-2 text-[11px] text-slate-400">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Penting:</strong> Siswa hanya bisa login 1 kali. Pastikan koneksi internet
                  stabil dan kamera aktif sebelum memulai.
                </span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition duration-150 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Masuk Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login Credentials Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
              <span>🚀 Uji Coba Cepat (1-Klik):</span>
              <span className="text-[10px] text-slate-500">Pilih akun instan</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("siswa", "siswa01", "siswa123")}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
              >
                <p className="text-xs font-bold text-blue-400">Siswa 01</p>
                <p className="text-[10px] text-slate-500">Ahmad Rizky</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("guru", "guru", "guru123")}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
              >
                <p className="text-xs font-bold text-indigo-400">Guru</p>
                <p className="text-[10px] text-slate-500">Pengawas</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("admin", "admin", "admin123")}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
              >
                <p className="text-xs font-bold text-cyan-400">Admin</p>
                <p className="text-[10px] text-slate-500">Gusthy Palin P.</p>
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Helpdesk Contact Card for Students */}
        <div className="mt-4">
          <HelpdeskSupport
            variant="card"
            context="login"
          />
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {isScanningBarcode && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ScanLine className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Pemindai Barcode / QR Siswa
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Arahkan kamera ke kartu peserta atau unggah foto barcode
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseScanner}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-sm transition cursor-pointer"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Camera Error Alert */}
              {cameraError && (
                <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-100">Pemberitahuan Kamera</p>
                    <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={() => startCamera(cameraFacing)}
                      className="mt-2 inline-flex items-center space-x-1 text-[11px] font-bold text-amber-300 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Coba Buka Kamera Lagi</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Camera viewfinder preview */}
              <div className="relative aspect-video rounded-xl bg-slate-950 border-2 border-dashed border-blue-500/50 overflow-hidden flex items-center justify-center shadow-inner">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">
                      {cameraError ? "Kamera tidak aktif" : "Menghubungkan ke kamera..."}
                    </p>
                  </div>
                )}

                {/* Visual scanner overlay target */}
                {cameraActive && (
                  <div className="absolute inset-8 border-2 border-blue-400/80 rounded-xl pointer-events-none flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_#22d3ee] animate-pulse" />
                    <div className="absolute top-2 left-2 text-[10px] text-cyan-300 font-mono tracking-wider font-semibold">
                      SCANNING...
                    </div>
                  </div>
                )}

                {/* Floating controls over video: Flip camera & File upload */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center space-x-1.5 z-10">
                  <button
                    type="button"
                    onClick={handleToggleCameraFacing}
                    className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs backdrop-blur-sm transition flex items-center space-x-1 cursor-pointer"
                    title="Ganti Kamera Depan / Belakang"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">
                      {cameraFacing === "environment" ? "Kamera Belakang" : "Kamera Depan"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Upload photo button & instruction */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center space-x-2">
                  <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-300">
                    Atau scan dari foto / tangkapan layar kartu barcode:
                  </span>
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isProcessingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessingFile ? "Membaca..." : "Unggah Foto"}</span>
                  </button>
                </div>
              </div>

              {/* Sample simulated cards for fast testing */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-300">
                    Pilih Kartu Peserta Ujian (Simulasi Scan Cepat):
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {students.length} Siswa Terdaftar
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={scannerSearchQuery}
                    onChange={(e) => setScannerSearchQuery(e.target.value)}
                    placeholder="Cari nama, NISN, atau kelas siswa..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {students
                    .filter((st) => {
                      if (!scannerSearchQuery) return true;
                      const q = scannerSearchQuery.toLowerCase();
                      return (
                        st.name.toLowerCase().includes(q) ||
                        st.nisn.toLowerCase().includes(q) ||
                        st.className.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 6)
                    .map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          playScanSuccessBeep();
                          handleApplyBarcode(st.startBarcodeToken);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-blue-900/30 border border-slate-800 text-left transition text-xs cursor-pointer group"
                      >
                        <div className="truncate">
                          <span className="font-bold text-slate-200 group-hover:text-blue-300">
                            {st.name}
                          </span>
                          <span className="text-slate-500 ml-2">
                            ({st.className} &bull; NISN: {st.nisn})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 font-mono text-[10px] shrink-0 font-bold">
                          Scan Kartu
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Manual input fallback */}
              <div className="pt-3 border-t border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Atau Ketik Barcode Token Secara Manual:
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={manualBarcodeInput}
                    onChange={(e) => setManualBarcodeInput(e.target.value)}
                    placeholder="Contoh: GPP-XIIPSP7-0060001002"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualBarcodeInput.trim()) {
                        playScanSuccessBeep();
                        handleApplyBarcode(manualBarcodeInput);
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Verifikasi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Portal Barcode Modal for Google Lens / Smartphone Scanner */}
      <LoginPortalQrModal
        isOpen={localShowLoginQrModal}
        onClose={() => setLocalShowLoginQrModal(false)}
      />

      {/* Student Card Lookup Modal for Fast, Responsive Barcode Access */}
      <StudentCardLookupModal
        isOpen={showStudentLookupModal}
        onClose={() => setShowStudentLookupModal(false)}
        students={students}
        onSelectStudentLogin={(token) => handleApplyBarcode(token)}
      />
    </div>
  );
};
