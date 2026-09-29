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
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { Question, getTingkatBadgeConfig, QuestionType, QuestionPackage, TingkatKelas } from "../types";
import {
  downloadWordTemplate,
  parseWordFile,
  parseQuestionsFromText,
  ParsedQuestionResult,
} from "../utils/wordQuestionParser";
import { downloadExcelQuestionTemplate } from "../utils/excelQuestionParser";
import { FolderPlus, FolderCheck, CheckCircle } from "lucide-react";

export interface WordQuestionImportMeta {
  packageId?: string;
  packageName: string;
  isNewPackage: boolean;
  tingkatKelas?: TingkatKelas;
  setActive?: boolean;
}

interface WordQuestionUploadModalProps {
  onClose: () => void;
  onImportQuestions: (
    questions: Omit<Question, "id">[],
    meta?: WordQuestionImportMeta
  ) => void;
  existingPackages?: QuestionPackage[];
  currentSelectedPackageId?: string;
}

export const WordQuestionUploadModal: React.FC<WordQuestionUploadModalProps> = ({
  onClose,
  onImportQuestions,
  existingPackages = [],
  currentSelectedPackageId,
}) => {
  const [activeTab, setActiveTab] = useState<"file" | "manual">("file");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsedQuestionResult | null>(null);
  const [manualText, setManualText] = useState("");
  const [copiedSample, setCopiedSample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Package destination state
  const [isNewPackage, setIsNewPackage] = useState(true);
  const [packageNameInput, setPackageNameInput] = useState("");
  const [selectedTargetPackageId, setSelectedTargetPackageId] = useState(
    currentSelectedPackageId || existingPackages[0]?.id || ""
  );
  const [targetTingkatKelas, setTargetTingkatKelas] = useState<TingkatKelas>("Semua Kelas");
  const [setAsActiveExam, setSetAsActiveExam] = useState(true);

  const sampleFormatText = `1. [KELAS: Semua Kelas] Manakah protokol jaringan yang bertugas menyediakan komunikasi terenkripsi dan aman saat mengakses web?
A. HTTP
B. HTTPS
C. FTP
D. Telnet
E. SMTP
KUNCI: B. HTTPS
POIN: 10

2. [KELAS: X] Serangan siber di mana penyerang membanjiri server dengan jutaan paket data palsu hingga lumpuh adalah...
A. Phishing    B. SQL Injection    C. DDoS    D. Ransomware
KUNCI: C
POIN: 10

3. [BENAR_SALAH] [KELAS: XI] Bilangan prima terkecil yang merupakan bilangan genap adalah 2.
KUNCI: BENAR
POIN: 10

4. [JODOHKAN] [KELAS: Semua Kelas] Pasangkan ibu kota negara berikut dengan nama negaranya:
PASANGAN: Jakarta = Indonesia
PASANGAN: Tokyo = Jepang
PASANGAN: Canberra = Australia
POIN: 15

5. [KOMPLEKS] [KELAS: XII] Manakah perangkat keras yang berfungsi sebagai perangkat keluaran (Output Device)?
A. Monitor
B. Keyboard
C. Printer
D. Barcode Scanner
E. Speaker
KUNCI: A, C, E
POIN: 15

6. [ISIAN] [KELAS: X] Proses fotosintesis pada tumbuhan memerlukan pigmen hijau daun yang disebut...
KUNCI: Klorofil
POIN: 10

7. [ESSAY] [KELAS: Semua Kelas] Jelaskan konsep Two-Factor Authentication (2FA) dan sebutkan minimal 2 contoh faktor autentikasinya!
KUNCI: 2FA adalah metode verifikasi ganda yang mewajibkan dua bukti sebelum login. Contoh: Password (know), OTP ponsel (have), Sidik jari (are).
POIN: 20`;

  const handleFileProcess = async (file: File) => {
    setIsLoading(true);
    setSelectedFileName(file.name);
    setPackageNameInput(file.name);
    if (/\bxii\b/i.test(file.name)) {
      setTargetTingkatKelas("XII");
    } else if (/\bxi\b/i.test(file.name)) {
      setTargetTingkatKelas("XI");
    } else if (/\bx\b/i.test(file.name)) {
      setTargetTingkatKelas("X");
    }
    try {
      const result = await parseWordFile(file);
      setParseResult(result);
    } catch (err: any) {
      setParseResult({
        questions: [],
        rawText: "",
        errors: [`Terjadi kendala saat memproses berkas: ${err?.message || "Format berkas tidak dikenali"}`],
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
    if (!packageNameInput) {
      setPackageNameInput("Naskah Tempel Baru");
    }
    const result = parseQuestionsFromText(manualText, targetTingkatKelas);
    setParseResult(result);
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleFormatText);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleDeleteParsedQuestion = (indexToDelete: number) => {
    if (!parseResult) return;
    const updated = parseResult.questions.filter((_, idx) => idx !== indexToDelete);
    setParseResult({
      ...parseResult,
      questions: updated,
    });
  };

  const handleApplyImport = () => {
    if (!parseResult || parseResult.questions.length === 0) return;
    const finalPackageName =
      (isNewPackage
        ? packageNameInput.trim() || selectedFileName || "Berkas Soal Baru"
        : existingPackages?.find((p) => p.id === selectedTargetPackageId)?.name) ||
      selectedFileName ||
      "Berkas Soal";

    const updatedQuestions = parseResult.questions.map((q) => ({
      ...q,
      tingkatKelas:
        q.tingkatKelas && q.tingkatKelas !== "Semua Kelas"
          ? q.tingkatKelas
          : targetTingkatKelas,
    }));

    onImportQuestions(updatedQuestions, {
      packageId: isNewPackage ? undefined : selectedTargetPackageId,
      packageName: finalPackageName,
      isNewPackage,
      tingkatKelas: targetTingkatKelas,
      setActive: setAsActiveExam,
    });
    onClose();
  };

  const questionTypeCounts = React.useMemo(() => {
    if (!parseResult) return { mcq: 0, tf: 0, matching: 0, multi: 0, short: 0, essay: 0 };
    return {
      mcq: parseResult.questions.filter((q) => q.type === "mcq").length,
      tf: parseResult.questions.filter((q) => q.type === "true_false").length,
      matching: parseResult.questions.filter((q) => q.type === "matching").length,
      multi: parseResult.questions.filter((q) => q.type === "multi_choice").length,
      short: parseResult.questions.filter((q) => q.type === "short_answer").length,
      essay: parseResult.questions.filter((q) => q.type === "essay").length,
    };
  }, [parseResult]);

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case "mcq":
        return { label: "Pilihan Ganda", color: "bg-blue-950/60 text-blue-300 border-blue-500/30" };
      case "true_false":
        return { label: "Benar / Salah", color: "bg-emerald-950/60 text-emerald-300 border-emerald-500/30" };
      case "matching":
        return { label: "Menjodohkan", color: "bg-cyan-950/60 text-cyan-300 border-cyan-500/30" };
      case "multi_choice":
        return { label: "PG Kompleks", color: "bg-indigo-950/60 text-indigo-300 border-indigo-500/30" };
      case "short_answer":
        return { label: "Isian Singkat", color: "bg-teal-950/60 text-teal-300 border-teal-500/30" };
      case "essay":
        return { label: "Essay / Uraian", color: "bg-amber-950/60 text-amber-300 border-amber-500/30" };
      default:
        return { label: "Soal", color: "bg-slate-800 text-slate-300 border-slate-700" };
    }
  };

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
                <span>Impor &amp; Unggah Naskah Bank Soal</span>
              </h3>
              <p className="text-xs text-slate-400">
                Mendukung naskah dokumen Word (.docx, .doc), Spreadsheet Excel (.xlsx, .xls, .csv), RTF, atau tempel teks langsung
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Download Template Word */}
            <button
              type="button"
              onClick={downloadWordTemplate}
              className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              title="Unduh contoh template dokumen Microsoft Word (.doc)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Template Word</span>
            </button>

            {/* Download Template Excel */}
            <button
              type="button"
              onClick={downloadExcelQuestionTemplate}
              className="px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              title="Unduh contoh template tabel Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Template Excel</span>
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
            <span>Unggah Berkas Dokumen / Excel</span>
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
                  accept=".docx,.doc,.txt,.rtf,.xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileCheck className="w-7 h-7" />
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    {selectedFileName ? selectedFileName : "Pilih atau Tarik Berkas Soal ke Sini"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Mendukung format Microsoft Word (.docx, .doc), Spreadsheet Excel (.xlsx, .xls, .csv), RTF, serta Plain Text (.txt)
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
                    <p className="font-semibold text-slate-200">Format Penulisan Bebas &amp; Fleksibel</p>
                    <p className="text-slate-400">
                      Sistem otomatis mendeteksi nomor soal, pilihan opsi (vertikal/horizontal), kunci jawaban, bobot poin, dan jenjang kelas (X, XI, XII).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadWordTemplate}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shrink-0 ml-3 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Word</span>
                </button>
              </div>
            </div>
          ) : (
            /* Manual / Paste Tab */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Contoh Format Naskah Teks / Word / Notepad
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
                <pre className="text-[11px] font-mono bg-slate-900/90 p-3 rounded-lg text-slate-300 overflow-x-auto leading-relaxed border border-slate-800 max-h-56">
                  {sampleFormatText}
                </pre>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tempel Teks Naskah Soal Anda ke Sini:
                </label>
                <textarea
                  rows={8}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Tempel naskah soal Anda di sini (nomor soal, pilihan A-E, kunci jawaban, dsb)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleManualParse}
                  disabled={!manualText.trim()}
                  className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center space-x-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analisis &amp; Deteksi Soal</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-8 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Mengekstrak dan menganalisis butir soal berkas...</p>
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
                      Berhasil Membaca {parseResult.questions.length} Butir Soal
                    </h4>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 mt-1">
                      {questionTypeCounts.mcq > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/20">
                          {questionTypeCounts.mcq} Pilihan Ganda
                        </span>
                      )}
                      {questionTypeCounts.tf > 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20">
                          {questionTypeCounts.tf} Benar/Salah
                        </span>
                      )}
                      {questionTypeCounts.matching > 0 && (
                        <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/20">
                          {questionTypeCounts.matching} Menjodohkan
                        </span>
                      )}
                      {questionTypeCounts.multi > 0 && (
                        <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/20">
                          {questionTypeCounts.multi} PG Kompleks
                        </span>
                      )}
                      {questionTypeCounts.short > 0 && (
                        <span className="px-2 py-0.5 rounded bg-teal-950/60 text-teal-300 border border-teal-500/20">
                          {questionTypeCounts.short} Isian Singkat
                        </span>
                      )}
                      {questionTypeCounts.essay > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/20">
                          {questionTypeCounts.essay} Essay
                        </span>
                      )}
                    </div>
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

              {/* Target Package Destination Configuration */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <FolderPlus className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Tujuan Penyimpanan Berkas Soal:
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Berkas Tersendiri &bull; Tidak Tercampur
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsNewPackage(true)}
                    className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                      isNewPackage
                        ? "bg-blue-600/15 border-blue-500/80 text-white shadow-sm"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                        isNewPackage ? "border-blue-400 bg-blue-600 text-white" : "border-slate-600"
                      }`}
                    >
                      {isNewPackage && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">Buat Berkas / Paket Baru (Tersendiri)</p>
                      <p className="text-[11px] text-slate-400">
                        Soal tersimpan dalam berkas terpisah sesuai nama file unggahan
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsNewPackage(false)}
                    className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                      !isNewPackage
                        ? "bg-blue-600/15 border-blue-500/80 text-white shadow-sm"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                        !isNewPackage ? "border-blue-400 bg-blue-600 text-white" : "border-slate-600"
                      }`}
                    >
                      {!isNewPackage && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">Gabungkan ke Berkas yang Ada</p>
                      <p className="text-[11px] text-slate-400">
                        Tambahkan butir soal ini ke naskah berkas yang sudah ada
                      </p>
                    </div>
                  </button>
                </div>

                {isNewPackage ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Nama Berkas / Paket Soal:
                      </label>
                      <input
                        type="text"
                        value={packageNameInput}
                        onChange={(e) => setPackageNameInput(e.target.value)}
                        placeholder="e.g. XII TKA.docx atau Bahasa Inggris XII"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Jenjang Target Kelas:
                      </label>
                      <select
                        value={targetTingkatKelas}
                        onChange={(e) => setTargetTingkatKelas(e.target.value as TingkatKelas)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Semua Kelas">Semua Kelas</option>
                        <option value="X">Kelas X</option>
                        <option value="XI">Kelas XI</option>
                        <option value="XII">Kelas XII</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Pilih Berkas Target:
                    </label>
                    <select
                      value={selectedTargetPackageId}
                      onChange={(e) => setSelectedTargetPackageId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {existingPackages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.tingkatKelas || "Semua Kelas"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80">
                  <input
                    type="checkbox"
                    id="set-as-active-exam-check"
                    checked={setAsActiveExam}
                    onChange={(e) => setSetAsActiveExam(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="set-as-active-exam-check"
                    className="text-xs text-slate-300 font-semibold cursor-pointer"
                  >
                    Langsung jadikan berkas ini sebagai naskah ujian aktif untuk siswa
                  </label>
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
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {parseResult.questions.map((q, idx) => {
                  const typeCfg = getTypeLabel(q.type);
                  const badge = getTingkatBadgeConfig(q.tingkatKelas);

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="w-6 h-6 rounded-md bg-blue-600/20 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${typeCfg.color}`}
                          >
                            {typeCfg.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11px] font-bold text-amber-400">
                            {q.points} Poin
                          </span>
                          {q.mediaType && q.mediaType !== "none" && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 text-[10px] font-semibold">
                              Lampiran: {q.mediaType.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteParsedQuestion(idx)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Hapus butir soal ini dari daftar impor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-slate-200 font-medium whitespace-pre-wrap">{q.question}</p>

                      {/* Options for MCQ */}
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
                              <span className="flex-1">{opt}</span>
                              {oIdx === q.correctAnswer && (
                                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                                  Kunci
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Options for Multi-Choice */}
                      {q.type === "multi_choice" && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = q.correctAnswers?.includes(oIdx);
                            return (
                              <div
                                key={oIdx}
                                className={`p-2 rounded-lg text-[11px] flex items-start space-x-1.5 border ${
                                  isCorrect
                                    ? "bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-semibold"
                                    : "bg-slate-900 border-slate-800 text-slate-400"
                                }`}
                              >
                                <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                <span className="flex-1">{opt}</span>
                                {isCorrect && (
                                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold shrink-0">
                                    Benar
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* True / False display */}
                      {q.type === "true_false" && (
                        <div className="flex items-center space-x-3 pt-1">
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                              q.correctBool
                                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                                : "bg-slate-900 border-slate-800 text-slate-500"
                            }`}
                          >
                            Benar {q.correctBool && "✓"}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                              !q.correctBool
                                ? "bg-rose-950/40 border-rose-500/50 text-rose-300"
                                : "bg-slate-900 border-slate-800 text-slate-500"
                            }`}
                          >
                            Salah {!q.correctBool && "✓"}
                          </span>
                        </div>
                      )}

                      {/* Matching display */}
                      {q.type === "matching" && q.matchingPairs && (
                        <div className="space-y-1 pt-1">
                          {q.matchingPairs.map((pair, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between text-slate-300"
                            >
                              <span className="font-semibold text-cyan-300">{pair.left}</span>
                              <span className="text-slate-500 px-2">↔</span>
                              <span className="font-semibold text-emerald-300">{pair.right}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Short Answer & Essay display */}
                      {(q.type === "short_answer" || q.type === "essay") && q.keyAnswer && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                          <strong className="text-slate-300">
                            {q.type === "essay" ? "Rubrik Kunci / Pedoman Penilaian:" : "Kunci Jawaban Singkat:"}
                          </strong>{" "}
                          <span className="text-emerald-300">{q.keyAnswer}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
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
              Impor {parseResult?.questions.length || 0} Soal ke Berkas {isNewPackage ? `"${packageNameInput.trim() || selectedFileName || "Baru"}"` : "Terpilih"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
