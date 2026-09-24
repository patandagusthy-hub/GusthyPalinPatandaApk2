import React, { useEffect, useState, useRef, useCallback } from "react";
import { AlertOctagon, ShieldAlert, AlertTriangle, EyeOff, Maximize2, Lock } from "lucide-react";
import { ViolationRecord } from "../types";

interface AntiCheatingGuardProps {
  examActive: boolean;
  violationsCount: number;
  maxAllowedViolations: number;
  onRecordViolation: (
    type: ViolationRecord["type"],
    title: string,
    description: string,
    snapshot?: string
  ) => void;
  children: React.ReactNode;
}

export const AntiCheatingGuard: React.FC<AntiCheatingGuardProps> = ({
  examActive,
  violationsCount,
  maxAllowedViolations,
  onRecordViolation,
  children,
}) => {
  const [warningModal, setWarningModal] = useState<{
    show: boolean;
    title: string;
    description: string;
  } | null>(null);

  const [blackoutShield, setBlackoutShield] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Audio beep alarm generator using Web Audio API
  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const triggerViolationAlert = useCallback(
    (type: ViolationRecord["type"], title: string, desc: string) => {
      if (!examActive) return;
      playAlertSound();
      onRecordViolation(type, title, desc);
      setWarningModal({
        show: true,
        title,
        description: desc,
      });
    },
    [examActive, onRecordViolation, playAlertSound]
  );

  // Re-request fullscreen
  const requestFullscreenAgain = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setWarningModal(null);
    setBlackoutShield(false);
  };

  useEffect(() => {
    if (!examActive) return;

    // 1. Cegah Copy
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerToast("Tindakan COPY dicegah demi integritas ujian!");
      triggerViolationAlert("COPY_PASTE", "Percobaan Copy Teks", "Siswa mencoba menyalin (copy) konten soal ujian.");
    };

    // 2. Cegah Paste
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerToast("Tindakan PASTE diblokir!");
      triggerViolationAlert("COPY_PASTE", "Percobaan Paste Teks", "Siswa mencoba menempelkan (paste) teks dari luar ke dalam jawaban.");
    };

    // 3. Cegah Context Menu (Klik Kanan)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerToast("Klik kanan dinonaktifkan selama ujian!");
    };

    // 4. Deteksi Perpindahan Tab / Hidden Tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setBlackoutShield(true);
        triggerViolationAlert(
          "TAB_SWITCH",
          "Perpindahan Tab / Aplikasi Terdeteksi",
          "Siswa berpindah tab browser atau meminimalkan aplikasi ujian."
        );
      } else {
        setBlackoutShield(false);
      }
    };

    // 5. Deteksi Browser Kehilangan Focus / Membuka Panel Notifikasi
    const handleWindowBlur = () => {
      setBlackoutShield(true);
      triggerViolationAlert(
        "WINDOW_BLUR",
        "Kehilangan Fokus Jendela / Panel Notifikasi Dibuka",
        "Kursor atau fokus meninggalkan browser ujian (diduga membuka notifikasi atau aplikasi mengambang)."
      );
    };

    const handleWindowFocus = () => {
      setBlackoutShield(false);
    };

    // 6. Deteksi Fullscreen Keluar
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerViolationAlert(
          "FULLSCREEN_EXIT",
          "Keluar dari Mode Layar Penuh (Fullscreen)",
          "Siswa keluar dari tampilan layar penuh yang diwajibkan."
        );
      }
    };

    // 7. Cegah Screenshot / Rekaman Layar (PrintScreen, Ctrl+Shift+S, Cmd+Shift+4)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === "PrintScreen") {
        e.preventDefault();
        setBlackoutShield(true);
        triggerToast("Tangkapan Layar (Screenshot) Dilarang!");
        triggerViolationAlert(
          "SCREENSHOT",
          "Upaya Screenshot Terdeteksi",
          "Tombol PrintScreen ditekan untuk mengambil gambar soal."
        );
        setTimeout(() => setBlackoutShield(false), 2000);
      }

      // Windows Snipping Tool (Win + Shift + S) or Mac (Cmd + Shift + 3/4)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === "s" || e.key === "3" || e.key === "4")
      ) {
        e.preventDefault();
        setBlackoutShield(true);
        triggerViolationAlert(
          "SCREENSHOT",
          "Kombinasi Tombol Snipping / Screenshot",
          "Kombinasi tombol pintas tangkapan layar terdeteksi."
        );
        setTimeout(() => setBlackoutShield(false), 2000);
      }

      // Alt + Tab
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        triggerViolationAlert("TAB_SWITCH", "Alt + Tab Terdeteksi", "Mencoba berpindah jendela menggunakan Alt+Tab.");
      }
    };

    // 8. Cegah Split Screen / Layar Terbelah & Aplikasi Mengambang
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    const handleResize = () => {
      const screenWidth = window.screen.availWidth || window.screen.width;
      const screenHeight = window.screen.availHeight || window.screen.height;

      // If width drops below 70% of available screen width, split screen is likely active
      const widthRatio = window.innerWidth / screenWidth;
      const heightRatio = window.innerHeight / screenHeight;

      if (widthRatio < 0.65 || heightRatio < 0.65) {
        triggerViolationAlert(
          "SPLIT_SCREEN",
          "Layar Terbelah (Split Screen) Terdeteksi",
          `Ukuran jendela terdeteksi hanya ${Math.round(widthRatio * 100)}% dari layar. Dilarang membelah layar ujian!`
        );
      }

      lastWidth = window.innerWidth;
      lastHeight = window.innerHeight;
    };

    // Attach all security event listeners
    window.addEventListener("copy", handleCopy);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [examActive, triggerViolationAlert]);

  return (
    <div className="relative select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
      {/* Toast alert for quick notifications */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-rose-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold animate-bounce">
          <AlertOctagon className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Blackout privacy shield when screenshot attempted or focus lost */}
      {blackoutShield && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-6">
          <EyeOff className="w-16 h-16 text-rose-500 mb-4 animate-pulse" />
          <h2 className="text-2xl font-extrabold text-white">Layar Dilindungi Sistem Keamanan</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            Konten ujian disamarkan otomatis saat browser kehilangan fokus atau tombol screenshot terdeteksi.
            Klik kembali layar untuk melanjutkan.
          </p>
          <button
            onClick={() => setBlackoutShield(false)}
            className="mt-6 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
          >
            Kembali ke Ujian
          </button>
        </div>
      )}

      {/* Violation Warning Modal */}
      {warningModal?.show && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500 w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4">
              <ShieldAlert className="w-10 h-10 animate-bounce" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 font-extrabold text-xs tracking-wider uppercase mb-2">
              Peringatan Keamanan Ujian
            </span>

            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              {warningModal.title}
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              {warningModal.description}
            </p>

            {/* Violation tally & Strike countdown */}
            <div className="mt-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Total Pelanggaran Anda:</span>
                <span className="font-extrabold text-rose-400 text-sm">
                  {violationsCount} dari {maxAllowedViolations} Batas Maksimal
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    violationsCount >= 2 ? "bg-red-600 w-full" : "bg-amber-500 w-1/2"
                  }`}
                />
              </div>

              <p className="text-[11px] text-rose-300 font-semibold mt-1">
                {violationsCount >= 2 ? (
                  <span className="text-red-400 font-bold">
                    ⚠️ Batas pelanggaran (2 kali) telah terpenuhi! Sistem sedang men-submit ujian secara otomatis...
                  </span>
                ) : (
                  <span>
                    ⚠️ <strong>PERHATIAN KERAS:</strong> 1 kali pelanggaran lagi, ujian Anda akan langsung
                    <strong> DI-SUBMIT SECARA OTOMATIS</strong> dan akun akan didiskualifikasi!
                  </span>
                )}
              </p>
            </div>

            {violationsCount < 2 && (
              <button
                type="button"
                onClick={requestFullscreenAgain}
                className="mt-6 w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Saya Mengerti & Kembali ke Layar Penuh</span>
              </button>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
