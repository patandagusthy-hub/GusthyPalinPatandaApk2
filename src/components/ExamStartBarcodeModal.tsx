import React, { useState, useEffect } from "react";
import {
  QrCode,
  ScanLine,
  Camera,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Lock,
  ArrowRight,
  Maximize2,
  Sparkles,
  Copy,
  Check,
  Download,
  X,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { Student, ExamConfig, isExamClassActive } from "../types";
import { generateQRCode, getStudentQrPayload, extractTokenFromScan } from "../utils/barcodeUtils";
import { HelpdeskSupport } from "./HelpdeskSupport";

interface ExamStartBarcodeModalProps {
  student: Student;
  examConfig: ExamConfig;
  onStartExam: (barcode: string) => { success: boolean; message?: string };
}

export const ExamStartBarcodeModal: React.FC<ExamStartBarcodeModalProps> = ({
  student,
  examConfig,
  onStartExam,
}) => {
  const [personalQrUrl, setPersonalQrUrl] = useState<string>("");
  const [examGateQrUrl, setExamGateQrUrl] = useState<string>("");
  const [scannedInput, setScannedInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [webcamGranted, setWebcamGranted] = useState(false);
  const [checkingCam, setCheckingCam] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const isClassActive = isExamClassActive(examConfig, student.className);

  // Generate QR codes for personal student card and exam token with Google Lens compliant quiet zone
  useEffect(() => {
    const payload = getStudentQrPayload(
      student.startBarcodeToken,
      student.nisn,
      "url",
      student.id,
      student.className
    );
    generateQRCode(payload, {
      width: 400,
      margin: 4,
      errorCorrectionLevel: "M",
    }).then(setPersonalQrUrl);

    generateQRCode(examConfig.gateToken, {
      width: 320,
      margin: 4,
      errorCorrectionLevel: "M",
    }).then(setExamGateQrUrl);
  }, [student.startBarcodeToken, student.nisn, student.id, student.className, examConfig.gateToken]);

  // Request camera permissions on load
  const requestCamera = async () => {
    setCheckingCam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setWebcamGranted(true);
      // keep or stop stream
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.warn("Webcam permission check:", err);
      setWebcamGranted(false);
    } finally {
      setCheckingCam(false);
    }
  };

  useEffect(() => {
    requestCamera();
  }, []);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(student.startBarcodeToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!personalQrUrl) return;
    const link = document.createElement("a");
    link.href = personalQrUrl;
    link.download = `Kartu_QR_${student.className.replace(/\s+/g, "_")}_${student.nisn}_${student.name.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  const handleVerifyAndStart = (tokenToVerify: string) => {
    setErrorMsg(null);
    if (!isClassActive) {
      setErrorMsg(
        `Akses Ujian Ditolak: Kelas "${student.className}" sedang dinonaktifkan oleh Guru/Admin untuk sesi ujian ini. Hubungi proktor / pengawas ujian.`
      );
      return;
    }
    const cleanToken = extractTokenFromScan(tokenToVerify);
    if (!cleanToken.trim()) {
      setErrorMsg("Silakan pindai atau masukkan barcode token ujian!");
      return;
    }

    // Request fullscreen as required for anti-cheating
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.warn("Fullscreen request:", e);
      });
    }

    const res = onStartExam(cleanToken.trim());
    if (!res.success) {
      setErrorMsg(res.message || "Barcode tidak cocok!");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 p-3 sm:p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* Left Column: Sajikan Barcode Peserta (Kartu Peserta Ujian Siswa) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
              <QrCode className="w-4 h-4" />
              <span>Kartu Barcode Peserta</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold uppercase">
              Google Lens
            </span>
          </div>

          {/* Explicit Purpose Tag */}
          <div className="mb-3 p-2 rounded-xl bg-blue-950/60 border border-blue-500/30 text-xs text-blue-300 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] leading-tight">
              <strong>Peruntukan:</strong> Identitas &amp; Login Pribadi Peserta (Bebas Duplikat).
            </span>
          </div>

          <div className="bg-gradient-to-br from-slate-950 to-blue-950/40 border border-blue-500/30 rounded-2xl p-4 sm:p-5 text-center shadow-inner">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center mb-2.5 shadow-md shadow-blue-500/20">
              {student.name.charAt(0)}
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-white truncate">{student.name}</h3>
            <p className="text-xs text-slate-400">NISN: <span className="font-mono text-slate-300">{student.nisn}</span></p>
            <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
              Kelas: {student.className}
            </div>

            {/* Individual Barcode / QR Code Image */}
            <div className="mt-3.5 relative inline-block mx-auto max-w-full">
              <div
                onClick={() => setIsZoomOpen(true)}
                className="w-36 h-36 sm:w-44 sm:h-44 mx-auto bg-white rounded-2xl p-2.5 flex items-center justify-center shadow-md cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all overflow-hidden"
                title="Ketuk untuk memperbesar QR Code di layar"
              >
                {personalQrUrl ? (
                  <img
                    src={personalQrUrl}
                    alt="Barcode Siswa"
                    className="w-full h-full object-contain select-none"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 animate-pulse rounded" />
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-slate-900/90 hover:bg-blue-600 text-white shadow transition cursor-pointer"
                title="Perbesar Layar Penuh"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Token string & actions */}
            <div className="mt-3 flex items-center justify-center space-x-1.5 flex-wrap gap-y-1">
              <span className="font-mono text-xs font-bold text-cyan-400 bg-slate-900/90 py-1 px-2.5 rounded-lg border border-cyan-500/30 break-all select-all">
                {student.startBarcodeToken}
              </span>
              <button
                type="button"
                onClick={handleCopyToken}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
                title="Salin Token Barcode"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleDownloadQr}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
                title="Unduh QR Code PNG"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-center space-x-1 text-[11px] text-emerald-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Dapat dipindai langsung dengan Google Lens</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Tunjukkan barcode ini kepada pengawas ruang untuk verifikasi absensi peserta.
            </p>
          </div>

          {/* Device & Security Status checklist */}
          <div className="mt-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Webcam AI Proctor:</span>
              {webcamGranted ? (
                <span className="flex items-center text-emerald-400 font-semibold space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Siap Aktif</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={requestCamera}
                  className="text-amber-400 hover:underline font-semibold flex items-center space-x-1"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Izinkan Kamera</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Aturan Sesi Login:</span>
              <span className="text-blue-400 font-semibold flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5" />
                <span>1x Login Terkunci</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Scan Barcode Untuk Mulai Ujian */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <ScanLine className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                Verifikasi Barcode Mulai Ujian
              </h2>
              <p className="text-xs text-slate-400">
                Langkah Terakhir: Masukkan Token Pembuka Ujian untuk membuka lembar soal
              </p>
            </div>
          </div>

          {/* Purpose Explanation Box */}
          <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 mb-4 flex items-start space-x-2.5">
            <KeyRound className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-[11px]">Peruntukan: Token Sesi Lembar Soal (Gate Token)</p>
              <p className="text-[11px] text-indigo-300/90 mt-0.5 leading-relaxed">
                Token sesi dibagikan oleh guru/pengawas saat waktu ujian dimulai agar seluruh siswa dapat mulai serentak.
              </p>
            </div>
          </div>

          {/* Exam Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 mb-5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mata Ujian:</span>
              <span className="text-slate-200 font-bold">{examConfig.subject}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Durasi Pengerjaan:</span>
              <span className="text-amber-400 font-bold flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{examConfig.durationMinutes} Menit</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Batas Pelanggaran:</span>
              <span className="text-rose-400 font-bold">Maksimal 2 Kali (Auto-Submit)</span>
            </div>
          </div>

          {/* Inactive Class Warning */}
          {!isClassActive && (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs mb-4 flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-100">Jadwal Ujian Kelas Dinonaktifkan</p>
                <p className="text-[11px] text-rose-200/90 mt-1 leading-relaxed">
                  Kelas Anda (<strong>{student.className}</strong>) saat ini <strong>tidak dijadwalkan</strong> atau sedang dinonaktifkan oleh Guru / Admin untuk sesi ujian ini. Anda belum diizinkan memulai pengerjaan soal. Silakan hubungi pengawas ruang atau proktor.
                </p>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs mb-4 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Scan Action Area */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/20 text-center">
              <p className="text-xs text-slate-300 font-semibold mb-3">
                Tekan tombol di bawah untuk verifikasi instan dengan Barcode Token Ujian:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleVerifyAndStart(examConfig.gateToken)}
                  className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 transition cursor-pointer"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Scan Token Kelas: {examConfig.gateToken}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifyAndStart(student.startBarcodeToken)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 border border-slate-700 transition cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  <span>Gunakan Barcode Pribadi Saya</span>
                </button>
              </div>
            </div>

            {/* Manual input */}
            <div className="pt-3 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Atau Ketik Barcode / Token Ujian:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={scannedInput}
                  onChange={(e) => setScannedInput(e.target.value)}
                  placeholder={`Contoh: ${examConfig.gateToken} atau ${student.startBarcodeToken}`}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleVerifyAndStart(scannedInput)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 transition cursor-pointer shrink-0"
                >
                  <span>Mulai Ujian</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Anti-Cheating Warning Box */}
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-start space-x-3 text-xs text-amber-300">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Protokol Keamanan Layar Penuh (Fullscreen):</p>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Saat menekan &quot;Mulai Ujian&quot;, sistem akan beralih ke mode layar penuh. Dilarang
                  berpindah tab, meminimalkan browser, melakukan copy-paste, atau membuka aplikasi
                  lain. <strong>Pelanggaran 2 kali akan langsung men-submit ujian secara otomatis!</strong>
                </p>
              </div>
            </div>

            {/* Helpdesk Contact */}
            <div className="pt-2">
              <HelpdeskSupport
                variant="card"
                context="login"
                phoneNumber={examConfig.helpdeskPhone || "085240195357"}
                adminName={examConfig.helpdeskName || "Admin CBT (Gusthy Palin Patanda)"}
                studentName={student.name}
                studentNisn={student.nisn}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Fullscreen Zoom Modal */}
      {isZoomOpen && personalQrUrl && (
        <div
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-6 rounded-3xl max-w-sm sm:max-w-md w-full text-center shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setIsZoomOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
              aria-label="Tutup Zoom"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-slate-900 font-black text-lg mb-1">
              {student.name}
            </div>
            <div className="text-slate-600 text-xs font-medium mb-3">
              NISN: <strong>{student.nisn}</strong> &bull; Kelas: <strong>{student.className}</strong>
            </div>

            <div className="w-64 h-64 sm:w-80 sm:h-80 mx-auto bg-white p-2 flex items-center justify-center">
              <img
                src={personalQrUrl}
                alt="QR Code Zoom"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="mt-4 font-mono font-bold text-sm bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-300 text-slate-900 inline-block">
              {student.startBarcodeToken}
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              Ketuk di luar kotak atau tekan tombol tutup untuk kembali.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

