import React, { useEffect } from "react";
import { WifiOff, Wifi, CheckCircle2, ShieldCheck, Database } from "lucide-react";
import { NetworkStatus } from "../hooks/useNetworkStatus";

interface OfflineStatusBannerProps {
  network: NetworkStatus;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({ network }) => {
  const { isOnline, wasOffline, clearWasOffline } = network;

  useEffect(() => {
    if (wasOffline && isOnline) {
      const timer = setTimeout(() => {
        clearWasOffline();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, clearWasOffline]);

  if (!isOnline) {
    return (
      <div className="bg-amber-950/90 border-b border-amber-600/70 text-amber-200 px-4 py-2.5 shadow-md flex items-center justify-between text-xs sm:text-sm animate-in slide-in-from-top duration-300 z-50">
        <div className="max-w-7xl mx-auto flex items-center space-x-3 w-full">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0 animate-pulse">
            <WifiOff className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-extrabold text-amber-300">Mode Ujian Offline Aktif (Koneksi Internet Terputus):</span>
              <span className="text-amber-100">
                Ujian tetap berjalan normal tanpa gangguan! Seluruh butir soal &amp; jawaban tersimpan aman di basis data lokal (IndexedDB).
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-900/60 border border-amber-500/30 text-[11px] font-bold text-amber-300">
            <Database className="w-3.5 h-3.5" />
            <span>Penyimpanan Lokal Aktif</span>
          </div>
        </div>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div className="bg-emerald-950/90 border-b border-emerald-600/70 text-emerald-200 px-4 py-2 shadow-md flex items-center justify-between text-xs sm:text-sm animate-in slide-in-from-top duration-300 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wifi className="w-4 h-4" />
            </div>
            <span className="font-bold text-emerald-300">
              Koneksi Internet Pulih! Seluruh data ujian tersinkronisasi kembali ke server.
            </span>
          </div>
          <button
            type="button"
            onClick={clearWasOffline}
            className="text-xs text-emerald-400 hover:text-emerald-200 underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return null;
};
