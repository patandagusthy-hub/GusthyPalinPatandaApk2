import React, { useState, useRef } from "react";
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  HelpCircle,
  Copy,
  Check,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Question } from "../types";
import {
  downloadWordTemplate,
  parseWordFile,
  parseQuestionsFromText,
  ParsedQuestionResult,
} from "../utils/wordQuestionParser";

interface WordQuestionUploadModalProps {
  onClose: () => void;
  onImportQuestions: (questions: Omit<Question, "id">[]) => void;
}

export const WordQuestionUploadModal: React.FC<WordQuestionUploadModalProps> = ({
  onClose,
  onImportQuestions,
}) => {
  const [activeTab, setActiveTab] = useState<"file" | "manual">("file");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsedQuestionResult | null>(null);
  const [manualText, setManualText] = useState("");
  const [copiedSample, setCopiedSample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sampleFormatText = `1. Manakah protokol jaringan yang bertugas menyediakan komunikasi terenkripsi dan aman saat mengakses web?
A. HTTP
B. HTTPS
C. FTP
D. Telnet
E. SMTP
KUNCI: B
POIN: 10

2. Serangan siber di mana penyerang membanjiri server dengan jutaan paket data palsu hingga lumpuh adalah...
A. Phishing
B. SQL Injection
C. Distributed Denial of Service (DDoS)
D. Ransomware
KUNCI: C
POIN: 10

3. [ESSAY] Jelaskan konsep Two-Factor Authentication (2FA) dan sebutkan minimal 2 contoh faktor autentikasinya!
KUNCI: 2FA adalah metode verifikasi ganda yang mewajibkan dua bukti sebelum login. Contoh: Password/PIN (know), OTP ponsel/hardware token (have), Sidik jari/wajah (are).
POIN: 20`;

  const handleFileProcess = async (file: File) => {
    setIsLoading(true);
    setSelectedFileName(file.name);
    try {
      const result = await parseWordFile(file);
      setParseResult(result);
    } catch (err: any) {
      setParseResult({
        questions: [],
        rawText: "",
        errors: [`Terjadi kendala saat memproses berkas: ${err?.message || "Format tidak dikenali"}`],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleManualParse = () => {
    if (!manualText.trim()) return;
    const result = parseQuestionsFromText(manualText);
    setParseResult(result);
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleFormatText);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleApplyImport = () => {
    if (!parseResult || parseResult.questions.length === 0) return;
    onImportQuestions(parseResult.questions);
    onClose();
  };

  const mcqCount = parseResult?.questions.filter((q) => q.type === "mcq").length || 0;
  const essayCount = parseResult?.questions.filter((q) => q.type === "essay").length || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center space-x-2">
                <span>Impor Soal dari File Word (.doc / .docx)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Unggah naskah soal Word atau unduh template resmi format Pilihan Ganda &amp; Essay
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Download Template Word Button */}
            <button
              type="button"
              onClick={downloadWordTemplate}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              title="Unduh contoh template dokumen Microsoft Word"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Unduh</span> Template Word (.doc)
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              activeTab === "file"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Unggah Berkas Dokumen (.docx / .doc)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              activeTab === "manual"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Panduan Format &amp; Salin Teks</span>
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === "file" ? (
            <div className="space-y-4">
              {/* Drag & Drop Upload Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-700 hover:border-slate-600 bg-slate-950/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.txt,.rtf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileCheck className="w-7 h-7" />
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    {selectedFileName ? selectedFileName : "Pilih atau Seret Berkas Word (.docx / .doc)"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Mendukung format Microsoft Word (.docx, .doc), RTF, serta Plain Text (.txt)
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition">
                    Pilih Berkas dari Komputer
                  </span>
                </div>
              </div>

              {/* Template Download Notice Banner */}
              <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-200">Belum memiliki naskah soal berformat Word?</p>
                    <p className="text-slate-400">Gunakan template resmi kami agar seluruh nomor, kunci, dan bobot poin otomatis terbaca.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadWordTemplate}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shrink-0 ml-3 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template</span>
                </button>
              </div>
            </div>
          ) : (
            /* Manual / Paste Tab */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Contoh Susunan Format Naskah Word
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopySample}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center space-x-1 transition cursor-pointer"
                  >
                    {copiedSample ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Contoh</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[11px] font-mono bg-slate-900/90 p-3 rounded-lg text-slate-300 overflow-x-auto leading-relaxed border border-slate-800">
                  {sampleFormatText}
                </pre>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tempel Teks Soal dari Word ke Sini:
                </label>
                <textarea
                  rows={8}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Tempel naskah soal Anda di sini sesuai format contoh di atas..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleManualParse}
                  disabled={!manualText.trim()}
                  className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer"
                >
                  Analisis Teks Soal
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-8 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Mengekstrak dan menganalisis butir soal Word...</p>
            </div>
          )}

          {/* Parsing Results & Live Preview */}
          {parseResult && !isLoading && (
            <div className="space-y-4 pt-2">
              {/* Parse Summary Bar */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Berhasil Mendeteksi {parseResult.questions.length} Butir Soal
                    </h4>
                    <p className="text-xs text-slate-400">
                      Terdiri dari <strong className="text-blue-400">{mcqCount} Pilihan Ganda</strong> dan{" "}
                      <strong className="text-amber-400">{essayCount} Essay</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParseResult(null);
                      setSelectedFileName(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Warnings / Errors */}
              {parseResult.errors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Catatan Pemeriksaan Format:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300/90 pl-2">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions Preview Cards */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {parseResult.questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-md bg-blue-600/20 text-blue-400 font-bold text-[11px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            q.type === "mcq"
                              ? "bg-blue-950/60 text-blue-300 border border-blue-500/30"
                              : "bg-amber-950/60 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {q.type === "mcq" ? "Pilihan Ganda" : "Essay"}
                        </span>
                        <span className="text-[11px] font-bold text-amber-400">
                          {q.points} Poin
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-200 font-medium">{q.question}</p>

                    {q.type === "mcq" && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-lg text-[11px] flex items-start space-x-1.5 border ${
                              oIdx === q.correctAnswer
                                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-semibold"
                                : "bg-slate-900 border-slate-800 text-slate-400"
                            }`}
                          >
                            <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                            <span>{opt}</span>
                            {oIdx === q.correctAnswer && (
                              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                Kunci
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === "essay" && q.keyAnswer && (
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                        <strong className="text-slate-300">Rubrik / Kunci:</strong> {q.keyAnswer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleApplyImport}
            disabled={!parseResult || parseResult.questions.length === 0}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center space-x-2 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Impor {parseResult?.questions.length || 0} Soal ke Bank Soal
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
