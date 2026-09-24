import React, { useState } from "react";
import {
  X,
  Sliders,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  RefreshCw,
  Play,
  FileText,
  Percent,
  SlidersHorizontal,
} from "lucide-react";
import { AIRubricConfig, AIRubricStrictnessMode, AIRubricTypoTolerance, ExamConfig } from "../types";

interface AIRubricTuningModalProps {
  isOpen?: boolean;
  onClose: () => void;
  config?: ExamConfig | AIRubricConfig;
  onSaveConfig?: (updates: Partial<ExamConfig>) => void;
  onSave?: (newRubric: AIRubricConfig) => void;
}

export const AIRubricTuningModal: React.FC<AIRubricTuningModalProps> = ({
  isOpen = true,
  onClose,
  config,
  onSaveConfig,
  onSave,
}) => {
  if (isOpen === false) return null;

  const rawConfig: any = config;
  const currentRubric: AIRubricConfig =
    rawConfig && typeof rawConfig === "object" && "strictnessMode" in rawConfig
      ? (rawConfig as AIRubricConfig)
      : rawConfig?.aiRubricConfig || {
          strictnessMode: "balanced",
          typoTolerance: "medium",
          reasoningWeight: 50,
          penalizeLengthDeviation: true,
          customDirectives: "",
          temperature: 0.2,
        };

  const [strictnessMode, setStrictnessMode] = useState<AIRubricStrictnessMode>(
    currentRubric.strictnessMode || "balanced"
  );
  const [typoTolerance, setTypoTolerance] = useState<AIRubricTypoTolerance>(
    currentRubric.typoTolerance || "medium"
  );
  const [reasoningWeight, setReasoningWeight] = useState<number>(
    currentRubric.reasoningWeight ?? 50
  );
  const [penalizeLengthDeviation, setPenalizeLengthDeviation] = useState<boolean>(
    currentRubric.penalizeLengthDeviation ?? true
  );
  const [customDirectives, setCustomDirectives] = useState<string>(
    currentRubric.customDirectives || ""
  );

  // Live Test Bench State
  const [testQuestion, setTestQuestion] = useState(
    "Jelaskan fungsi dari mitokondria pada sel makhluk hidup!"
  );
  const [testKeyAnswer, setTestKeyAnswer] = useState(
    "Mitokondria adalah organel tempat respirasi seluler yang menghasilkan energi dalam bentuk molekul ATP (Adenosin Trifosfat) untuk aktivitas sel."
  );
  const [testStudentAnswer, setTestStudentAnswer] = useState(
    "Tempat bikin tenaga sel kayak pabrik listrik tubuh biar sel bisa hidup dan kerja."
  );
  const [testMaxPoints, setTestMaxPoints] = useState<number>(20);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    score?: number;
    maxPoints?: number;
    feedback?: string;
    keyConceptsFound?: string[];
    missingConcepts?: string[];
    rubricAssessment?: string;
    engineUsed?: string;
    error?: string;
  } | null>(null);

  const [saveToast, setSaveToast] = useState(false);

  const handleSave = () => {
    const updatedRubric: AIRubricConfig = {
      strictnessMode,
      typoTolerance,
      reasoningWeight,
      penalizeLengthDeviation,
      customDirectives,
      temperature: strictnessMode === "strict_keyword" ? 0.1 : strictnessMode === "flexible_semantic" ? 0.35 : 0.2,
    };

    if (onSave) {
      onSave(updatedRubric);
    }
    if (onSaveConfig) {
      onSaveConfig({ aiRubricConfig: updatedRubric });
    }
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      onClose();
    }, 800);
  };

  const handleRunLiveTest = async () => {
    if (!testStudentAnswer.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/gemini/test-essay-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: testQuestion,
          keyAnswer: testKeyAnswer,
          studentAnswer: testStudentAnswer,
          maxPoints: testMaxPoints,
          rubricConfig: {
            strictnessMode,
            typoTolerance,
            reasoningWeight,
            penalizeLengthDeviation,
            customDirectives,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
      } else {
        setTestResult({ error: data.error || "Gagal melakukan uji penilaian AI" });
      }
    } catch (err: any) {
      setTestResult({ error: err.message || "Koneksi ke server AI gagal." });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">
                  AI Rubric Tuning (Parameter Penilaian Essay)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Gemini Evaluator
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Atur tingkat ketelitian, toleransi kata kunci eksak vs esensi makna, dan pembobotan logika
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-7">
          {saveToast && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center space-x-2 animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Parameter AI Rubric Tuning berhasil disimpan dan diterapkan ke ujian!</span>
            </div>
          )}

          {/* Section 1: Strictness Mode (3 Choices) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                <span>1. Mode Kelonggaran Penilaian (Strictness vs Semantic Essence)</span>
              </label>
              <span className="text-[11px] text-slate-400">Pilih prinsip koreksi AI</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option A: Strict Keyword */}
              <div
                onClick={() => setStrictnessMode("strict_keyword")}
                className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                  strictnessMode === "strict_keyword"
                    ? "bg-rose-500/10 border-rose-500 shadow-md shadow-rose-500/10 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-extrabold flex items-center space-x-1.5 text-rose-300">
                      <span>🔒 Ketat Kata Kunci</span>
                    </span>
                    {strictnessMode === "strict_keyword" && (
                      <CheckCircle2 className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Menuntut keberadaan kata kunci eksak, terminologi teknis baku, rumus, dan frasa spesifik referensi.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-rose-300/80">
                  Cocok: MIPA, Kimia, Kedokteran, Hukum, Definisi Baku
                </div>
              </div>

              {/* Option B: Balanced Standard */}
              <div
                onClick={() => setStrictnessMode("balanced")}
                className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                  strictnessMode === "balanced"
                    ? "bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/10 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-extrabold flex items-center space-x-1.5 text-blue-300">
                      <span>⚖️ Standar Berimbang</span>
                    </span>
                    {strictnessMode === "balanced" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Mengkombinasikan kata kunci pokok dengan pemahaman konsep secara proporsional (Rekomendasi Default).
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-blue-300/80">
                  Cocok: IPS, Geografi, IPA Umum, Sebagian Besar Ujian
                </div>
              </div>

              {/* Option C: Flexible Semantic Essence */}
              <div
                onClick={() => setStrictnessMode("flexible_semantic")}
                className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                  strictnessMode === "flexible_semantic"
                    ? "bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/10 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-extrabold flex items-center space-x-1.5 text-emerald-300">
                      <span>💡 Fleksibel Esensi Makna</span>
                    </span>
                    {strictnessMode === "flexible_semantic" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Menilai esensi pemahaman, analogi, dan substansi alur logika meskipun siswa memakai bahasa bebas sehari-hari.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-emerald-300/80">
                  Cocok: Bahasa, Sastra, Opini, Sejarah, PPKn, Analisis
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Fine-Tuning Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
            {/* Typo Tolerance */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>2. Toleransi Salah Ketik &amp; Ejaan (Typo)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "low", label: "Rendah", desc: "Harus baku & minim typo" },
                  { key: "medium", label: "Sedang", desc: "Toleran salah 1-2 huruf" },
                  { key: "high", label: "Tinggi", desc: "Abaikan typo non-fatal" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTypoTolerance(item.key as AIRubricTypoTolerance)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      typoTolerance === item.key
                        ? "bg-purple-600/20 border-purple-500 text-white font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Penalize Short Answer Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Penalti Jawaban Terlalu Singkat</span>
              </label>
              <div
                onClick={() => setPenalizeLengthDeviation(!penalizeLengthDeviation)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  penalizeLengthDeviation
                    ? "bg-amber-500/10 border-amber-500/40 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <div>
                  <div className="text-xs font-bold">
                    {penalizeLengthDeviation ? "Penalti Aktif (Maks 30%)" : "Penalti Nonaktif"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Batasi nilai jika jawaban hanya 1-2 kata tanpa uraian penjelas
                  </div>
                </div>
                <div
                  className={`w-10 h-5 rounded-full p-0.5 transition ${
                    penalizeLengthDeviation ? "bg-amber-500" : "bg-slate-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition transform ${
                      penalizeLengthDeviation ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Reasoning Weight Slider */}
            <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-300 flex items-center space-x-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4. Proporsi Bobot: Daya Penalaran Logika vs Hafalan Fakta</span>
                </label>
                <span className="font-mono font-bold text-purple-400">
                  {reasoningWeight}% Penalaran : {100 - reasoningWeight}% Fakta Baku
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={reasoningWeight}
                onChange={(e) => setReasoningWeight(Number(e.target.value))}
                className="w-full accent-purple-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>0% (Fokus Murni Istilah Hafalan)</span>
                <span>50% (Berimbang 50:50)</span>
                <span>100% (Fokus Murni Alur Berpikir)</span>
              </div>
            </div>

            {/* Custom Directives Textarea */}
            <div className="md:col-span-2 space-y-1.5 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>5. Instruksi Tambahan Khusus untuk AI (Opsional)</span>
              </label>
              <textarea
                rows={2}
                value={customDirectives}
                onChange={(e) => setCustomDirectives(e.target.value)}
                placeholder="Contoh: Berikan apresiasi jika siswa menyertakan contoh dalam kehidupan sehari-hari; abaikan penulisan huruf kapital nama latin."
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Live Test Bench (AI Playground for Teachers) */}
          <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-800/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-extrabold text-white">
                  Laboratorium Uji Coba AI Rubric (Live Test Bench)
                </h4>
              </div>
              <span className="text-[11px] text-purple-300">
                Uji langsung parameter di atas pada jawaban siswa simulasi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Soal Ujian Uji Coba:
                </label>
                <input
                  type="text"
                  value={testQuestion}
                  onChange={(e) => setTestQuestion(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Kunci Jawaban Referensi:
                </label>
                <input
                  type="text"
                  value={testKeyAnswer}
                  onChange={(e) => setTestKeyAnswer(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300">
                    Sampel Jawaban Siswa (Coba ganti dengan bahasa bebas atau tanpa kata kunci):
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-400">Poin Maksimal:</span>
                    <input
                      type="number"
                      value={testMaxPoints}
                      onChange={(e) => setTestMaxPoints(Number(e.target.value) || 20)}
                      className="w-14 text-xs p-1 rounded bg-slate-900 border border-slate-800 text-center font-bold text-white"
                    />
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={testStudentAnswer}
                  onChange={(e) => setTestStudentAnswer(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
                  placeholder="Ketikkan contoh jawaban siswa untuk melihat penilaian AI..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleRunLiveTest}
                disabled={isTesting || !testStudentAnswer.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-purple-600/30 transition cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gemini Sedang Menguji...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Uji Penilaian AI Sekarang</span>
                  </>
                )}
              </button>

              <span className="text-[11px] text-slate-400">
                Mode aktif: <strong className="text-purple-300">{strictnessMode}</strong>
              </span>
            </div>

            {/* Test Result Display */}
            {testResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-3 animate-fadeIn">
                {testResult.error ? (
                  <div className="text-xs text-rose-400 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{testResult.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400">Skor Diperoleh:</span>
                        <span className="text-lg font-extrabold text-emerald-400 font-mono">
                          {testResult.score} / {testResult.maxPoints || testMaxPoints}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          {Math.round(((testResult.score || 0) / (testResult.maxPoints || testMaxPoints)) * 100)}%
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Engine: {testResult.engineUsed || "gemini-3.8-flash"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300">
                      <strong className="text-purple-300">Umpan Balik AI: </strong>
                      {testResult.feedback}
                    </div>

                    {testResult.keyConceptsFound && testResult.keyConceptsFound.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400">Konsep Terdeteksi:</span>
                        {testResult.keyConceptsFound.map((kc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                          >
                            ✓ {kc}
                          </span>
                        ))}
                      </div>
                    )}

                    {testResult.missingConcepts && testResult.missingConcepts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400">Konsep Kurang/Terlewat:</span>
                        {testResult.missingConcepts.map((mc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                          >
                            ✗ {mc}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/80 shrink-0">
          <button
            type="button"
            onClick={() => {
              setStrictnessMode("balanced");
              setTypoTolerance("medium");
              setReasoningWeight(50);
              setPenalizeLengthDeviation(true);
              setCustomDirectives("");
            }}
            className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            Reset Default Standar
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-purple-600/30 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Parameter AI Rubric</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
