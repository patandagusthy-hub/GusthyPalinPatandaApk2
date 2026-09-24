import React from "react";
import { Sun, Moon, Sparkles } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface ThemeToggleProps {
  variant?: "compact" | "badge" | "full";
  className?: string;
  showAccessibilityBadge?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = "compact",
  className = "",
  showAccessibilityBadge = false,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === "badge") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Aktifkan Mode Terang Kontras Tinggi" : "Kembali ke Mode Gelap"}
        title={
          isDark
            ? "Beralih ke Mode Terang (High Contrast Accessibility)"
            : "Kembali ke Mode Gelap Cyber"
        }
        className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm ${
          isDark
            ? "bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-amber-300 hover:text-amber-200"
            : "bg-white hover:bg-amber-50 border-amber-300 text-amber-700 hover:text-amber-800"
        } ${className}`}
      >
        {isDark ? (
          <>
            <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
            <span className="font-bold">Mode Terang (Kontras Tinggi)</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-indigo-600" />
            <span className="font-bold">Mode Gelap</span>
          </>
        )}
      </button>
    );
  }

  if (variant === "full") {
    return (
      <div className={`flex items-center justify-between p-3.5 rounded-xl border ${
        isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
      } ${className}`}>
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isDark ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-amber-100 text-amber-700 border border-amber-300"
          }`}>
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-indigo-700" />}
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">
              {isDark ? "Mode Gelap (Cyber Dark)" : "Mode Terang (Kontras Tinggi)"}
            </p>
            <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {isDark
                ? "Tampilan gelap hemat energi & minim silau"
                : "Aksestabilitas ujian: teks tajam, kontras tinggi & nyaman dibaca"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white"
              : "bg-amber-500 hover:bg-amber-600 border-amber-600 text-white"
          }`}
        >
          {isDark ? "Ganti ke Terang" : "Ganti ke Gelap"}
        </button>
      </div>
    );
  }

  // Compact variant (standard navbar / bar button)
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Beralih ke Mode Terang (High Contrast)" : "Kembali ke Mode Gelap"}
        title={
          isDark
            ? "Beralih ke Mode Terang (Aksesibilitas Ujian Kontras Tinggi)"
            : "Kembali ke Mode Gelap"
        }
        className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
          isDark
            ? "bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border-slate-700 shadow-sm"
            : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm"
        } ${className}`}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform hover:scale-110" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:scale-110" />
        )}
      </button>

      {showAccessibilityBadge && (
        <span
          className={`hidden md:inline-flex ml-2 items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            isDark
              ? "bg-slate-800/80 border-slate-700 text-slate-300"
              : "bg-emerald-100 border-emerald-300 text-emerald-800"
          }`}
        >
          <Sparkles className="w-3 h-3 text-emerald-500" />
          <span>{isDark ? "Mode: Gelap" : "Aksesibilitas: Terang"}</span>
        </span>
      )}
    </div>
  );
};
