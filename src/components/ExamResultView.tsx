import React from "react";
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  LogOut,
  RotateCcw,
} from "lucide-react";
import { Student, ExamConfig, Question } from "../types";
import { HelpdeskSupport } from "./HelpdeskSupport";

interface ExamResultViewProps {
  student: Student;
  questions: Question[];
  config: ExamConfig;
  onOpenDuckRace?: () => void;
  onLogout: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  student,
  questions,
  config,
  onOpenDuckRace,
  onLogout,
}) => {
  const isPassed = student.totalScore >= config.passingScore;
  const isDisqualified = student.examStatus === "disqualified";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div
          className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
            isDisqualified
              ? "bg-rose-600/10"
              : isPassed
              ? "bg-emerald-600/10"
              : "bg-amber-600/10"
          }`}
        />

        {/* Top Status Icon */}
        <div className="text-center mb-6">
          <div
            className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-3xl shadow-xl mb-4 ${
              isDisqualified
                ? "bg-rose-500/20 border-2 border-rose-500 text-rose-400"
                : isPassed
                ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                : "bg-amber-500/20 border-2 border-amber-500 text-amber-400"
            }`}
          >
            {isDisqualified ? (
              <ShieldAlert className="w-10 h-10 animate-pulse" />
            ) : isPassed ? (
              <Award className="w-10 h-10" />
            ) : (
              <AlertTriangle className="w-10 h-10" />
            )}
          </div>

          <span
            className={`inline-block px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-2 ${
              isDisqualified
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : isPassed
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            }`}
          >
            {isDisqualified
              ? "Didiskualifikasi (Pelanggaran)"
              : isPassed
              ? "Lulus Kriteria Ketuntasan Minimal"
              : "Perlu Remedial"}
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Hasil Ujian: {student.name}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            NISN: {student.nisn} | Kelas: {student.className}
          </p>
        </div>

        {/* Score Breakdown Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
            <p className="text-[11px] text-slate-400 font-medium">Pilihan Ganda</p>
            <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1">
              {student.mcqScore}
            </p>
            <span className="text-[10px] text-slate-500">Otomatis Terkoreksi</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
            <p className="text-[11px] text-slate-400 font-medium">Essay (AI Gemini)</p>
            <p className="text-xl sm:text-2xl font-black text-cyan-400 mt-1">
              {student.essayScore}
            </p>
            <span className="text-[10px] text-slate-500">Evaluasi Rubrik</span>
          </div>

          <div
            className={`rounded-2xl p-4 text-center border ${
              isDisqualified
                ? "bg-rose-950/40 border-rose-500/40"
                : isPassed
                ? "bg-emerald-950/40 border-emerald-500/40"
                : "bg-amber-950/40 border-amber-500/40"
            }`}
          >
            <p className="text-[11px] text-slate-300 font-medium">Total Skor</p>
            <p
              className={`text-2xl sm:text-3xl font-black mt-1 ${
                isDisqualified
                  ? "text-rose-400"
                  : isPassed
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {student.totalScore}
            </p>
            <span className="text-[10px] text-slate-400">Skala 100 (KKM: {config.passingScore})</span>
          </div>
        </div>

        {/* Violations Summary */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400 font-semibold">Catatan Pelanggaran Keamanan:</span>
            <span
              className={`font-black px-2 py-0.5 rounded ${
                student.violationsCount >= 2
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : student.violationsCount === 1
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {student.violationsCount} Pelanggaran
            </span>
          </div>

          {student.violationsLog && student.violationsLog.length > 0 ? (
            <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto pr-1">
              {student.violationsLog.map((v, i) => (
                <div
                  key={v.id || i}
                  className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-300 flex items-start space-x-2"
                >
                  <span className="font-mono text-slate-500 shrink-0">{v.timestamp}</span>
                  <div>
                    <span className="font-bold">{v.title}</span>: {v.description}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-400 flex items-center space-x-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Integritas sempurna! Tidak ada pelanggaran yang terdeteksi selama ujian.</span>
            </p>
          )}
        </div>

        {/* AI Essay Feedback Details */}
        {student.essayEvaluations && Object.keys(student.essayEvaluations).length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30">
            <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Umpan Balik AI Gemini untuk Soal Essay:</span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              {Object.entries(student.essayEvaluations).map(([qId, rawEv], idx) => {
                const ev = rawEv as { score?: number; feedback?: string };
                const questionObj = questions.find((q) => q.id === qId);
                return (
                  <div key={qId} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <p className="font-semibold text-slate-200">
                      Essay #{idx + 1}: {questionObj?.subject || "Soal Essay"} (Skor: {ev.score ?? 0})
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 italic">&quot;{ev.feedback || "Evaluasi selesai"}&quot;</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Helpdesk Contact Box */}
        <div className="pt-1">
          <HelpdeskSupport
            variant={isDisqualified ? "banner" : "card"}
            context={isDisqualified ? "disqualified" : "general"}
            phoneNumber={config.helpdeskPhone || "085240195357"}
            adminName={config.helpdeskName || "Admin CBT (Gusthy Palin Patanda)"}
            studentName={student.name}
            studentNisn={student.nisn}
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {onOpenDuckRace && (
            <button
              onClick={onOpenDuckRace}
              className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Lihat Duck Race Live</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 border border-slate-700 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Sesi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
