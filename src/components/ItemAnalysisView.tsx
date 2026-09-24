import React, { useState, useMemo } from "react";
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Sliders,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Edit3,
} from "lucide-react";
import { Question, Student, ExamConfig, AIRubricConfig, QuestionItemAnalysis } from "../types";
import { calculateItemAnalysis, exportItemAnalysisToExcel } from "../utils/itemAnalysis";
import { MathRenderer } from "./MathRenderer";

interface ItemAnalysisViewProps {
  questions?: Question[];
  students?: Student[];
  config?: ExamConfig;
  rubricConfig?: AIRubricConfig;
  onOpenRubricTuning?: () => void;
  onSelectQuestionForEdit?: (q: Question) => void;
}

export const ItemAnalysisView: React.FC<ItemAnalysisViewProps> = ({
  questions = [],
  students = [],
  config,
  rubricConfig,
  onOpenRubricTuning,
  onSelectQuestionForEdit,
}) => {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Effective AI Rubric Config
  const effectiveRubric = config?.aiRubricConfig || rubricConfig;

  // Hitung analisis item
  const analysisResult = useMemo(() => {
    try {
      return calculateItemAnalysis(questions || [], students || []);
    } catch (err) {
      console.error("calculateItemAnalysis error:", err);
      return {
        analyses: [],
        totalSubmitted: 0,
        upperCount: 0,
        lowerCount: 0,
        idealQuestionsCount: 0,
        revisionNeededCount: 0,
      };
    }
  }, [questions, students]);

  const { analyses, totalSubmitted, upperCount, lowerCount, idealQuestionsCount, revisionNeededCount } =
    analysisResult;

  // Filter list
  const filteredAnalyses = useMemo(() => {
    return (analyses || []).filter((item) => {
      if (!item) return false;

      // Type filter
      if (filterType !== "ALL" && item.type !== filterType) return false;

      // Status filter
      const rec = item.recommendation || "";
      if (filterStatus === "NEEDS_REVISION") {
        if (!rec.includes("Revisi") && !rec.includes("Dibuang")) return false;
      } else if (filterStatus === "IDEAL") {
        if (!rec.includes("Diterima")) return false;
      } else if (filterStatus === "SUKAR") {
        if (item.difficultyLabel !== "Sukar") return false;
      } else if (filterStatus === "MUDAH") {
        if (item.difficultyLabel !== "Mudah") return false;
      }

      // Search term
      if ((searchTerm || "").trim()) {
        const term = searchTerm.toLowerCase();
        const matchText = (item.questionText || "").toLowerCase().includes(term);
        const matchNum = String(item.questionNumber ?? "").includes(term);
        if (!matchText && !matchNum) return false;
      }

      return true;
    });
  }, [analyses, filterType, filterStatus, searchTerm]);

  // Statistik agregat
  const difficultySummary = useMemo(() => {
    let mudah = 0;
    let sedang = 0;
    let sukar = 0;
    (analyses || []).forEach((a) => {
      if (a.difficultyLabel === "Mudah") mudah++;
      else if (a.difficultyLabel === "Sedang") sedang++;
      else if (a.difficultyLabel === "Sukar") sukar++;
    });
    return { mudah, sedang, sukar };
  }, [analyses]);

  const discriminationSummary = useMemo(() => {
    let sangatBaik = 0;
    let baik = 0;
    let cukup = 0;
    let jelek = 0;
    let negatif = 0;
    (analyses || []).forEach((a) => {
      if (a.discriminationLabel === "Sangat Baik") sangatBaik++;
      else if (a.discriminationLabel === "Baik") baik++;
      else if (a.discriminationLabel === "Cukup") cukup++;
      else if (a.discriminationLabel === "Jelek") jelek++;
      else if (a.discriminationLabel === "Negatif (Defektif)") negatif++;
    });
    return { sangatBaik, baik, cukup, jelek, negatif };
  }, [analyses]);

  const handleExportExcel = () => {
    try {
      exportItemAnalysisToExcel(
        analyses,
        config?.title || "Ujian",
        config?.subject || "Mata Pelajaran"
      );
    } catch (err) {
      console.error("Export Excel error:", err);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.error("Print error:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center space-x-2">
                  <span>Analisis Butir Soal Empiris &amp; Validasi AI</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Standar Psikometri Kemendikbud: Tingkat Kesukaran (P), Daya Pembeda (D), Efisiensi Distraktor &amp; Rekomendasi
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* AI Rubric Tuning Button */}
            {onOpenRubricTuning && (
              <button
                type="button"
                onClick={onOpenRubricTuning}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-purple-600/25 transition cursor-pointer"
                title="Atur parameter kelonggaran penilaian AI untuk soal essay"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>AI Rubric Tuning</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">
                  {effectiveRubric?.strictnessMode === "strict_keyword"
                    ? "Ketat"
                    : effectiveRubric?.strictnessMode === "flexible_semantic"
                    ? "Fleksibel"
                    : "Berimbang"}
                </span>
              </button>
            )}

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={analyses.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 disabled:opacity-50 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              title="Ekspor laporan psikometri analisis butir soal ke Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            {/* Print Report Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={analyses.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              title="Cetak format arsip akademik / akreditasi"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Notice if 0 submitted students */}
        {totalSubmitted === 0 ? (
          <div className="p-5 sm:p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <h3 className="font-extrabold text-sm text-white">
                Menunggu Jawaban Siswa Masuk (0 Siswa Selesai Ujian)
              </h3>
            </div>
            <p className="text-xs text-amber-300/90 leading-relaxed">
              Analisis psikometri (Indeks Kesukaran $P$ dan Daya Pembeda $D$) dihitung secara empiris dari respon peserta yang telah mengumpulkan lembar jawaban (status: <em className="font-semibold text-white">submitted</em>).
              Daftar butir soal di bawah telah siap dan nilai statistik akan dikalkulasi otomatis saat data jawaban masuk.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-amber-300">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                {(questions || []).length} Butir Soal Terdaftar
              </span>
              <span>&bull; Metode Kelly 27% (Kelompok Atas vs Kelompok Bawah) aktif</span>
            </div>
          </div>
        ) : (
          /* Executive Summary Bento Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Responden */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Sampel Responden
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-white font-mono">{totalSubmitted}</span>
                <span className="text-xs text-slate-400">Siswa Selesai</span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                <span>Kel. Atas (Upper): <strong className="text-emerald-400">{upperCount}</strong></span>
                <span>Kel. Bawah: <strong className="text-rose-400">{lowerCount}</strong></span>
              </div>
            </div>

            {/* Card 2: Indeks Kesukaran */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Tingkat Kesukaran (P)
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {difficultySummary.sedang}
                </span>
                <span className="text-xs text-slate-400">Soal Sedang (Ideal)</span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                <span className="text-emerald-400 font-semibold">Mudah: {difficultySummary.mudah}</span>
                <span className="text-rose-400 font-semibold">Sukar: {difficultySummary.sukar}</span>
              </div>
            </div>

            {/* Card 3: Daya Pembeda */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Daya Pembeda (D)
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-blue-400 font-mono">
                  {discriminationSummary.sangatBaik + discriminationSummary.baik}
                </span>
                <span className="text-xs text-slate-400">Kualitas Baik</span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                <span>Cukup: <strong className="text-amber-400">{discriminationSummary.cukup}</strong></span>
                <span>Jelek/Negatif: <strong className="text-rose-400">{discriminationSummary.jelek + discriminationSummary.negatif}</strong></span>
              </div>
            </div>

            {/* Card 4: Kesiapan Bank Soal */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Status Kelayakan Soal
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {idealQuestionsCount}
                </span>
                <span className="text-xs text-slate-400">/ {analyses.length} Diterima</span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                <span>Persentase: <strong className="text-emerald-400">{analyses.length > 0 ? Math.round((idealQuestionsCount / analyses.length) * 100) : 0}%</strong></span>
                <span className="text-rose-400 font-semibold">Revisi: {revisionNeededCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor soal atau teks pertanyaan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Filter Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none"
            >
              <option value="ALL">Semua Tipe Soal</option>
              <option value="mcq">Pilihan Ganda (MCQ)</option>
              <option value="essay">Essay / Uraian</option>
              <option value="short_answer">Isian Singkat</option>
              <option value="true_false">Benar / Salah</option>
              <option value="matching">Menjodohkan</option>
              <option value="multi_choice">PG Kompleks</option>
            </select>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none"
            >
              <option value="ALL">Semua Status Rekomendasi</option>
              <option value="IDEAL">Sangat Baik (Diterima)</option>
              <option value="NEEDS_REVISION">Perlu Revisi / Dibuang</option>
              <option value="SUKAR">Kategori Sukar (P &lt; 0.30)</option>
              <option value="MUDAH">Kategori Mudah (P &ge; 0.70)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Item Analysis List */}
      <div className="space-y-4">
        {filteredAnalyses.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
            <Info className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              Tidak ada butir soal yang sesuai dengan kriteria filter.
            </p>
            <p className="text-xs text-slate-500">
              Coba atur ulang kata kunci pencarian atau ganti pilihan filter di atas.
            </p>
          </div>
        ) : (
          filteredAnalyses.map((item) => {
            const isExpanded = expandedQuestionId === item.questionId;
            const originalQuestion = (questions || []).find((q) => q && q.id === item.questionId);
            const recText = item.recommendation || "Menunggu Data Jawaban";
            const isAccepted = recText.includes("Diterima");
            const isMinor = recText.includes("Revisi Kecil");
            const isPending = recText.includes("Menunggu");

            return (
              <div
                key={item.questionId}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition shadow-sm hover:border-slate-700"
              >
                {/* Item Card Header */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white font-mono font-bold text-sm border border-slate-700">
                      {item.questionNumber}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                          {item.type}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Bobot: <strong className="text-slate-200">{item.points} Poin</strong>
                        </span>
                        {item.subject && (
                          <span className="text-[11px] text-slate-400">
                            &bull; Mapel: <strong className="text-slate-300">{item.subject}</strong>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-200 line-clamp-2 pr-2">
                        <MathRenderer text={item.questionText || ""} />
                      </div>
                    </div>
                  </div>

                  {/* Psychometric Badges */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {/* Tingkat Kesukaran (P) */}
                    <div className="flex flex-col items-end">
                      <div className="text-[10px] text-slate-400 font-medium">
                        Kesukaran (P):
                      </div>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        {item.difficultyLabel === "Belum Ada Data" ? (
                          <span className="font-mono text-xs font-bold text-slate-400">-</span>
                        ) : (
                          <span className="font-mono text-xs font-bold text-white">
                            {(item.difficultyIndex ?? 0).toFixed(2)}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.difficultyBadgeColor === "emerald"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : item.difficultyBadgeColor === "amber"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : item.difficultyBadgeColor === "rose"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {item.difficultyLabel}
                        </span>
                      </div>
                    </div>

                    {/* Daya Pembeda (D) */}
                    <div className="flex flex-col items-end">
                      <div className="text-[10px] text-slate-400 font-medium">
                        Daya Pembeda (D):
                      </div>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        {item.discriminationLabel === "Belum Ada Data" ? (
                          <span className="font-mono text-xs font-bold text-slate-400">-</span>
                        ) : (
                          <span
                            className={`font-mono text-xs font-bold ${
                              (item.discriminationIndex ?? 0) < 0
                                ? "text-purple-400"
                                : (item.discriminationIndex ?? 0) >= 0.3
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {(item.discriminationIndex ?? 0) > 0
                              ? `+${(item.discriminationIndex ?? 0).toFixed(2)}`
                              : (item.discriminationIndex ?? 0).toFixed(2)}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.discriminationBadgeColor === "emerald"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : item.discriminationBadgeColor === "blue"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : item.discriminationBadgeColor === "amber"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : item.discriminationBadgeColor === "rose"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : item.discriminationBadgeColor === "purple"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {item.discriminationLabel}
                        </span>
                      </div>
                    </div>

                    {/* Expand Detail Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setExpandedQuestionId(isExpanded ? null : item.questionId)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      title={isExpanded ? "Tutup detail statistik" : "Buka analisis pengecoh & rekomendasi"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/60 p-5 space-y-4">
                    {/* Recommendation Banner */}
                    <div
                      className={`p-3.5 rounded-xl border flex items-start space-x-3 text-xs ${
                        isAccepted
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                          : isMinor
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                          : isPending
                          ? "bg-slate-800/80 border-slate-700 text-slate-300"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-200"
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isAccepted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isPending ? (
                          <Info className="w-4 h-4 text-slate-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="font-extrabold flex items-center space-x-2">
                          <span>Rekomendasi: {recText}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90">
                          {item.recommendationReason}
                        </p>
                      </div>
                    </div>

                    {/* Breakdown Stats: Upper vs Lower Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          Tingkat Kelulusan Kelompok Atas
                        </span>
                        <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                          {Math.round((item.upperGroupPassRate ?? 0) * 100)}%
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Proporsi perolehan skor kelompok peringkat tertinggi (27% teratas)
                        </span>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          Tingkat Kelulusan Kelompok Bawah
                        </span>
                        <div className="text-lg font-bold text-rose-400 font-mono mt-1">
                          {Math.round((item.lowerGroupPassRate ?? 0) * 100)}%
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Proporsi perolehan skor kelompok peringkat terendah (27% terbawah)
                        </span>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          Rata-rata Skor Diperoleh
                        </span>
                        <div className="text-lg font-bold text-purple-400 font-mono mt-1">
                          {item.averageScore ?? 0} / {item.points}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Benar: {item.correctCount ?? 0} &bull; Sebagian: {item.partialCount ?? 0} &bull; Salah: {item.incorrectCount ?? 0}
                        </span>
                      </div>
                    </div>

                    {/* Distractor Analysis for MCQ Questions */}
                    {item.distractors && item.distractors.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-400" />
                            <span>Analisis Pola Pengecoh (Distractor Analysis)</span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Distraktor efektif jika dipilih &ge; 5% siswa dan lebih banyak dipilih kelompok bawah
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {item.distractors.map((dist) => (
                            <div
                              key={dist.optionIndex}
                              className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                                dist.isCorrect
                                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                                  : dist.isFunctional
                                  ? "bg-slate-900 border-slate-800 text-slate-300"
                                  : "bg-rose-500/5 border-rose-500/20 text-slate-400"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-extrabold flex items-center space-x-1.5">
                                    <span className="w-5 h-5 rounded flex items-center justify-center bg-slate-800 text-white font-mono text-[10px]">
                                      {dist.optionLabel}
                                    </span>
                                    {dist.isCorrect && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                        Kunci Jawaban
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-mono text-[11px] font-bold">
                                    {dist.percentage}% ({dist.count} siswa)
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-300 line-clamp-2">
                                  {dist.optionText}
                                </div>
                              </div>

                              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Atas: {dist.upperCount} &bull; Bawah: {dist.lowerCount}</span>
                                {!dist.isCorrect && (
                                  <span
                                    className={`font-semibold ${
                                      dist.isFunctional ? "text-blue-400" : "text-rose-400"
                                    }`}
                                  >
                                    {dist.isFunctional ? "Efektif" : "Tidak Efektif (Tak Berfungsi)"}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-400">
                        Total {item.totalAttempts} siswa telah mengerjakan butir ini.
                      </span>

                      {onSelectQuestionForEdit && originalQuestion && (
                        <button
                          type="button"
                          onClick={() => onSelectQuestionForEdit(originalQuestion)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Butir Soal Ini</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
