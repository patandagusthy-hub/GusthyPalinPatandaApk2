import React, { useState } from "react";
import {
  FileText,
  Printer,
  FileSpreadsheet,
  FileCode,
  Download,
  CheckCircle2,
  Settings,
  HelpCircle,
  X,
  Layers,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { Question, ExamConfig } from "../types";
import {
  exportQuestionsToWord,
  exportQuestionsToExcel,
  exportQuestionsToJson,
  printQuestionsAsPdf,
  QuestionExportOptions,
} from "../utils/questionExporter";

interface ExportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  config: ExamConfig;
}

type ExportFormat = "word" | "pdf" | "excel" | "json";

export const ExportQuestionsModal: React.FC<ExportQuestionsModalProps> = ({
  isOpen,
  onClose,
  questions,
  config,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("word");
  const [options, setOptions] = useState<QuestionExportOptions>({
    includeAnswerKey: true,
    includeRubrics: true,
    includePoints: true,
    includeHeader: true,
    includeExplanation: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // Type counts
  const typeCounts = {
    mcq: questions.filter((q) => q.type === "mcq").length,
    true_false: questions.filter((q) => q.type === "true_false").length,
    matching: questions.filter((q) => q.type === "matching").length,
    multi_choice: questions.filter((q) => q.type === "multi_choice").length,
    short_answer: questions.filter((q) => q.type === "short_answer").length,
    essay: questions.filter((q) => q.type === "essay").length,
  };

  const handleExecuteExport = () => {
    setIsExporting(true);
    try {
      if (selectedFormat === "word") {
        exportQuestionsToWord(questions, config, options);
        setExportSuccessMessage("Berkas naskah soal Word (.doc) berhasil diunduh!");
      } else if (selectedFormat === "pdf") {
        printQuestionsAsPdf(questions, config, options);
        setExportSuccessMessage("Halaman pratinjau cetak PDF siap digunakan.");
      } else if (selectedFormat === "excel") {
        exportQuestionsToExcel(questions, config);
        setExportSuccessMessage("Spreadsheet Bank Soal Excel (.xlsx) berhasil diunduh!");
      } else if (selectedFormat === "json") {
        exportQuestionsToJson(questions, config);
        setExportSuccessMessage("Arsip cadangan Bank Soal JSON berhasil diunduh!");
      }
      setTimeout(() => {
        setExportSuccessMessage(null);
      }, 4000);
    } catch (err) {
      console.error("Export error:", err);
      alert("Terjadi kesalahan saat memproses ekspor.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Ekspor &amp; Cetak Bank Soal</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                  {questions.length} Soal
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cadangkan naskah soal ke dokumen Word/PDF cetak atau arsip Excel/JSON pengajar
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Success Toast */}
          {exportSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 flex items-center space-x-2.5 shadow-lg animate-in slide-in-from-top duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-xs">{exportSuccessMessage}</span>
            </div>
          )}

          {/* Format Selector Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-2.5 uppercase tracking-wider">
              1. Pilih Format Berkas Ekspor
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Word */}
              <button
                type="button"
                onClick={() => setSelectedFormat("word")}
                className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition cursor-pointer ${
                  selectedFormat === "word"
                    ? "bg-blue-600/20 border-blue-500 shadow-sm shadow-blue-500/30 ring-1 ring-blue-500"
                    : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                    <span>Microsoft Word (.doc)</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">
                      Populer
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Naskah rapi dengan Kop Ujian resmi, mudah diedit di Word/Google Docs untuk cetak fisik.
                  </p>
                </div>
              </button>

              {/* PDF Print */}
              <button
                type="button"
                onClick={() => setSelectedFormat("pdf")}
                className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition cursor-pointer ${
                  selectedFormat === "pdf"
                    ? "bg-rose-600/20 border-rose-500 shadow-sm shadow-rose-500/30 ring-1 ring-rose-500"
                    : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                    <span>PDF Siap Cetak (A4)</span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-mono">
                      Instan
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Layout presisi A4 dengan kop sekolah, kolom identitas siswa, dan dialog cetak browser langsung.
                  </p>
                </div>
              </button>

              {/* Excel */}
              <button
                type="button"
                onClick={() => setSelectedFormat("excel")}
                className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition cursor-pointer ${
                  selectedFormat === "excel"
                    ? "bg-emerald-600/20 border-emerald-500 shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-500"
                    : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                    <span>Spreadsheet Excel (.xlsx)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Tabel butir soal, opsi A-E, kunci jawaban, dan histori revisi untuk analisis pengajar.
                  </p>
                </div>
              </button>

              {/* JSON Backup */}
              <button
                type="button"
                onClick={() => setSelectedFormat("json")}
                className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition cursor-pointer ${
                  selectedFormat === "json"
                    ? "bg-purple-600/20 border-purple-500 shadow-sm shadow-purple-500/30 ring-1 ring-purple-500"
                    : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                    <span>Arsip Backup JSON</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Cadangan data mentah lengkap dengan media &amp; log revisi untuk arsip server/impor ulang.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Customization Options (Word & PDF) */}
          {(selectedFormat === "word" || selectedFormat === "pdf") && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-slate-200 font-bold">
                <Settings className="w-4 h-4 text-slate-400" />
                <span>2. Opsi Naskah &amp; Kunci Jawaban</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={options.includeHeader}
                    onChange={(e) => setOptions({ ...options, includeHeader: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-slate-300">Sertakan Kop Institusi &amp; Identitas Ujian</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={options.includePoints}
                    onChange={(e) => setOptions({ ...options, includePoints: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-slate-300">Tampilkan Bobot Poin di Setiap Butir Soal</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={options.includeAnswerKey}
                    onChange={(e) => setOptions({ ...options, includeAnswerKey: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-slate-300 font-semibold text-blue-300">
                    Lampirkan Lembar Kunci Jawaban &amp; Rubrik
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={options.includeExplanation}
                    onChange={(e) =>
                      setOptions({ ...options, includeExplanation: e.target.checked })
                    }
                    disabled={!options.includeAnswerKey}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer disabled:opacity-40"
                  />
                  <span className={options.includeAnswerKey ? "text-slate-300" : "text-slate-500"}>
                    Sertakan Pembahasan Soal pada Lembar Kunci
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Exam Info & Statistics Summary */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>Ringkasan Bank Soal ({config.subject || "Umum"})</span>
              </span>
              <span className="font-bold text-amber-400">Total: {totalPoints} Poin</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
              <div>Pilihan Ganda: <strong className="text-slate-200">{typeCounts.mcq}</strong></div>
              <div>Benar / Salah: <strong className="text-slate-200">{typeCounts.true_false}</strong></div>
              <div>Menjodohkan: <strong className="text-slate-200">{typeCounts.matching}</strong></div>
              <div>PG Kompleks: <strong className="text-slate-200">{typeCounts.multi_choice}</strong></div>
              <div>Isian Singkat: <strong className="text-slate-200">{typeCounts.short_answer}</strong></div>
              <div>Uraian / Esai: <strong className="text-slate-200">{typeCounts.essay}</strong></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting || questions.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
          >
            {selectedFormat === "pdf" ? (
              <>
                <Printer className="w-4 h-4" />
                <span>Buka Dialog Cetak / PDF</span>
              </>
            ) : selectedFormat === "word" ? (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh Berkas Word (.doc)</span>
              </>
            ) : selectedFormat === "excel" ? (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Unduh Berkas Excel (.xlsx)</span>
              </>
            ) : (
              <>
                <FileCode className="w-4 h-4" />
                <span>Unduh Backup JSON</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
