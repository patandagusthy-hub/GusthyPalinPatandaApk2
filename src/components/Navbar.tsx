import React from "react";
import { ShieldCheck, LogOut, Cpu, Award, Wifi, WifiOff, QrCode } from "lucide-react";
import { Student, TeacherOrAdmin } from "../types";
import { ThemeToggle } from "./ThemeToggle";
import { HelpdeskSupport } from "./HelpdeskSupport";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

interface NavbarProps {
  currentUser: Student | TeacherOrAdmin | null;
  onLogout: () => void;
  onOpenDuckRace?: () => void;
  onOpenLoginQrModal?: () => void;
  activeView?: string;
  setActiveView?: (view: "exam" | "dashboard" | "duckrace") => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onOpenDuckRace,
  onOpenLoginQrModal,
  activeView,
  setActiveView,
}) => {
  const { isOnline } = useNetworkStatus();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold tracking-tight text-lg sm:text-xl bg-gradient-to-r from-white via-slate-200 to-blue-200 bg-clip-text text-transparent">
                GusthyPalinPatandaExam
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO-SECURE v3.8
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Sistem Ujian Terpadu &amp; Pengawasan AI Real-time
            </p>
          </div>
        </div>

        {/* Center: Gemini Engine Badge */}
        <div className="hidden lg:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
          <Cpu className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-slate-300">Engine AI:</span>
          <span className="font-semibold text-cyan-300">Gemini 3.8 Flash</span>
          <span className="text-[10px] text-slate-400">(Cadangan: Flash-Latest)</span>
        </div>

        {/* Right navigation / User Info */}
        <div className="flex items-center space-x-2.5">
          {/* Network Connection Indicator */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
              isOnline
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse"
            }`}
            title={
              isOnline
                ? "Koneksi Internet: Stabil & Terhubung ke Server"
                : "Koneksi Terputus: Mode Offline Aktif (Ujian Tetap Berjalan di Browser)"
            }
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <WifiOff className="w-3.5 h-3.5" />
                <span>Mode Offline</span>
              </>
            )}
          </div>

          {/* Accessibility Theme Mode Toggle */}
          <ThemeToggle showAccessibilityBadge={true} />

          {/* Barcode / QR Code Akses Laman Login Button (Google Lens Ready) */}
          {onOpenLoginQrModal && (
            <button
              type="button"
              onClick={onOpenLoginQrModal}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Tampilkan Barcode / QR Code Akses Laman Login untuk Siswa (Google Lens & Kamera HP)"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">QR Akses Login</span>
            </button>
          )}

          {/* Admin WhatsApp Helpdesk Pill */}
          <HelpdeskSupport variant="compact" />

          {currentUser && (
            <>
              {/* Quick Duck race button for all */}
              {onOpenDuckRace && (
                <button
                  onClick={onOpenDuckRace}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition"
                  title="Buka Live Duck Race Scoreboard"
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Duck Race Live</span>
                </button>
              )}

              {/* User profile capsule */}
              <div className="flex items-center space-x-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {currentUser.role === "siswa"
                      ? `Siswa (${(currentUser as Student).className})`
                      : currentUser.role === "admin"
                      ? "Administrator"
                      : "Guru Pengawas"}
                  </p>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={onLogout}
                className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700 transition"
                title="Keluar / Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
