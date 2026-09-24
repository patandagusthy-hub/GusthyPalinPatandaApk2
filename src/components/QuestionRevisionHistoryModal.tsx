import React, { useState } from "react";
import {
  History,
  X,
  Clock,
  User,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileEdit,
  Tag,
  HelpCircle,
} from "lucide-react";
import { Question, QuestionRevision } from "../types";

interface QuestionRevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  onRestoreRevision?: (questionId: string, revisionId: string) => void;
}

export const QuestionRevisionHistoryModal: React.FC<QuestionRevisionHistoryModalProps> = ({
  isOpen,
  onClose,
  question,
  onRestoreRevision,
}) => {
  const [expandedRevId, setExpandedRevId] = useState<string | null>(null);
  const [confirmRollbackRev, setConfirmRollbackRev] = useState<QuestionRevision | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen || !question) return null;

  const revisions = question.revisionHistory || [];

  const handleRollback = (rev: QuestionRevision) => {
    if (!onRestoreRevision) return;
    onRestoreRevision(question.id, rev.id);
    setConfirmRollbackRev(null);
    setToastMessage(`Berhasil memulihkan butir soal ke versi tanggal ${new Date(rev.timestamp).toLocaleString("id-ID")}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getBadgeStyle = (changeType: QuestionRevision["changeType"]) => {
    switch (changeType) {
      case "CREATE":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "UPDATE_KEY":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "UPDATE_RUBRIC":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "UPDATE_POINTS":
        return "bg-orange-500/20 text-orange-300 border-orange-500/40";
      case "UPDATE_TEXT":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "UPDATE_OPTIONS":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "UPDATE_MEDIA":
        return "bg-pink-500/20 text-pink-300 border-pink-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  const getReadableChangeType = (changeType: QuestionRevision["changeType"]) => {
    switch (changeType) {
      case "CREATE":
        return "Pembuatan Soal";
      case "UPDATE_KEY":
        return "Kunci Jawaban";
      case "UPDATE_RUBRIC":
        return "Rubrik Esai";
      case "UPDATE_POINTS":
        return "Bobot Poin";
      case "UPDATE_TEXT":
        return "Naskah Soal";
      case "UPDATE_OPTIONS":
        return "Opsi Jawaban";
      case "UPDATE_MEDIA":
        return "Lampiran Media";
      default:
        return "Pembaruan";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Riwayat Revisi (Version History)</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                  {revisions.length} Versi
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Log audit perubahan naskah soal, kunci jawaban, bobot, dan rubrik oleh pengajar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Snapshot Banner */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="truncate max-w-lg">
            <span className="text-slate-400 font-semibold">Soal Aktif: </span>
            <span className="text-slate-200 italic truncate">"{question.question}"</span>
          </div>
          <div className="flex items-center space-x-3 shrink-0 text-[11px] text-slate-400">
            <span>Tipe: <strong className="text-slate-200 uppercase">{question.type.replace("_", " ")}</strong></span>
            <span>Bobot: <strong className="text-amber-400">{question.points} Poin</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Toast Message */}
          {toastMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 flex items-center space-x-2.5 shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-xs">{toastMessage}</span>
            </div>
          )}

          {/* Confirm Rollback Banner */}
          {confirmRollbackRev && (
            <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-200 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Konfirmasi Pemulihan Versi (Rollback)</span>
              </div>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Apakah Anda yakin ingin memulihkan butir soal ini ke kondisi versi{" "}
                <strong>{new Date(confirmRollbackRev.timestamp).toLocaleString("id-ID")}</strong>{" "}
                oleh <strong>{confirmRollbackRev.modifiedBy}</strong>?
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleRollback(confirmRollbackRev)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Ya, Pulihkan Versi Ini
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRollbackRev(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {revisions.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/30">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Belum ada riwayat revisi tambahan</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Soal ini masih menggunakan naskah orisinal awal. Setiap kali admin atau guru mengedit teks soal, rubrik, atau kunci jawaban, riwayat lengkap akan otomatis tercatat di sini.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
              {revisions.map((rev, index) => {
                const isExpanded = expandedRevId === rev.id;
                const isLatest = index === 0;
                const formattedDate = new Date(rev.timestamp).toLocaleString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={rev.id} className="relative group">
                    {/* Dot on Timeline */}
                    <div
                      className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 transition ${
                        isLatest
                          ? "bg-amber-400 border-amber-200 shadow-sm shadow-amber-400/50"
                          : "bg-slate-800 border-slate-600 group-hover:border-slate-400"
                      }`}
                    />

                    {/* Card */}
                    <div
                      className={`p-4 rounded-xl border transition ${
                        isLatest
                          ? "bg-slate-800/80 border-slate-700 shadow-sm"
                          : "bg-slate-950/50 border-slate-800/70 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getBadgeStyle(
                              rev.changeType
                            )}`}
                          >
                            {getReadableChangeType(rev.changeType)}
                          </span>

                          {isLatest && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Versi Terkini
                            </span>
                          )}

                          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formattedDate}</span>
                          </span>
                        </div>

                        {/* Rollback button (for non-latest revisions with previous state) */}
                        {!isLatest && rev.previousState && onRestoreRevision && (
                          <button
                            type="button"
                            onClick={() => setConfirmRollbackRev(rev)}
                            className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer self-start sm:self-auto"
                            title="Kembalikan butir soal ke kondisi versi ini"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Pulihkan Versi Ini</span>
                          </button>
                        )}
                      </div>

                      {/* Author Info */}
                      <div className="flex items-center space-x-2 mt-2.5 text-slate-300">
                        <div className="p-1 rounded-full bg-slate-800 text-slate-400">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-slate-200">
                          {rev.modifiedBy}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          ({rev.role === "guru" ? "Pengajar" : "Administrator"})
                        </span>
                      </div>

                      {/* Summary */}
                      <p className="mt-2 text-slate-300 text-xs font-medium">
                        {rev.summary}
                      </p>

                      {/* Snapshot Toggle */}
                      {rev.previousState && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRevId(isExpanded ? null : rev.id)
                            }
                            className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center space-x-1 transition cursor-pointer"
                          >
                            <span>{isExpanded ? "Sembunyikan Snapshot Data Versi" : "Lihat Snapshot Data Sebelum Perubahan"}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 p-3 rounded-lg bg-black/40 border border-slate-800 text-[11px] space-y-2 font-mono text-slate-300">
                              {rev.previousState.question && (
                                <div>
                                  <span className="text-slate-500 block">Naskah Soal Sebelum Perubahan:</span>
                                  <p className="text-slate-200 font-sans mt-0.5">{rev.previousState.question}</p>
                                </div>
                              )}
                              {rev.previousState.correctAnswer !== undefined && (
                                <div>
                                  <span className="text-slate-500">Kunci Jawaban PG Sebelumnya: </span>
                                  <strong className="text-amber-300">
                                    {String.fromCharCode(65 + rev.previousState.correctAnswer)}
                                  </strong>
                                </div>
                              )}
                              {rev.previousState.correctBool !== undefined && (
                                <div>
                                  <span className="text-slate-500">Kunci Benar/Salah Sebelumnya: </span>
                                  <strong className="text-amber-300">
                                    {rev.previousState.correctBool ? "BENAR" : "SALAH"}
                                  </strong>
                                </div>
                              )}
                              {rev.previousState.keyAnswer !== undefined && (
                                <div>
                                  <span className="text-slate-500 block">Rubrik / Kunci Isian Sebelumnya:</span>
                                  <p className="text-slate-200 font-sans mt-0.5">{rev.previousState.keyAnswer}</p>
                                </div>
                              )}
                              {rev.previousState.points !== undefined && (
                                <div>
                                  <span className="text-slate-500">Bobot Poin Sebelumnya: </span>
                                  <strong className="text-amber-300">{rev.previousState.points} Poin</strong>
                                </div>
                              )}
                              {rev.previousState.options && (
                                <div>
                                  <span className="text-slate-500 block">Opsi Pilihan Sebelumnya:</span>
                                  <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-slate-300 font-sans">
                                    {rev.previousState.options.map((opt, i) => (
                                      <li key={i}>
                                        {String.fromCharCode(65 + i)}. {opt}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <span className="text-slate-500 text-[11px]">
            Terakhir diubah: {question.lastModifiedBy || "Admin"} (
            {question.lastModifiedAt
              ? new Date(question.lastModifiedAt).toLocaleString("id-ID")
              : "Sistem Awal"}
            )
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
