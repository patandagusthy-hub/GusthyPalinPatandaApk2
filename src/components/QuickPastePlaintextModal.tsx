import React, { useState, useMemo } from "react";
import {
  ClipboardCopy,
  FileText,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
  Layers,
  ChevronDown,
  Info,
} from "lucide-react";
import { TingkatKelas, QuestionPackage, Question } from "../types";
import {
  parseQuestionsFromPlaintext,
  savePlaintextQuestionsToFirestore,
  ParsedPlaintextQuestion,
} from "../utils/plainTextQuestionParser";

interface QuickPastePlaintextModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: QuestionPackage[];
  currentPackageId?: string;
  authorName?: string;
  onSuccess: (newQuestions: Question[], count: number, packageName: string) => void;
  onCreateNewPackage?: (pkg: {
    name: string;
    fileName?: string;
    subject?: string;
    tingkatKelas?: TingkatKelas;
    description?: string;
  }) => Promise<QuestionPackage>;
}

export const QuickPastePlaintextModal: React.FC<QuickPastePlaintextModalProps> = ({
  isOpen,
  onClose,
  packages = [],
  currentPackageId,
  authorName = "AGUSTINUS PATANDA (admin)",
  onSuccess,
  onCreateNewPackage,
}) => {
  const [rawText, setRawText] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<TingkatKelas>("Semua Kelas");
  const [selectedPkgId, setSelectedPkgId] = useState<string>(
    currentPackageId || packages[0]?.id || "pkg-default"
  );
  const [isCreatingNewPackage, setIsCreatingNewPackage] = useState(false);
  const [newPackageName, setNewPackageName] = useState("");
  const [newPackageSubject, setNewPackageSubject] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatusMessage, setProcessStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExampleGuide, setShowExampleGuide] = useState(false);

  const examplePlaceholder = `1. Protokol keamanan web apa yang mengenkripsi transmisi data menggunakan SSL/TLS?
A. HTTP
B. FTP
C. HTTPS
D. SMTP
KUNCI: C
POIN: 10

2. [KOMPLEKS] [KELAS: XII] Manakah yang termasuk sumber energi terbarukan ramah lingkungan?
A. Tenaga Surya
B. Batu Bara
C. Angin
D. Minyak Bumi
KUNCI: A, C
POIN: 15

3. [TRUE_FALSE] [KELAS: X] Bilangan prima terkecil yang merupakan bilangan genap adalah 2.
KUNCI: Benar
POIN: 10

4. [URAIAN] [KELAS: XI] Jelaskan cara kerja firewall dalam memfilter lalu lintas jaringan komputer!
KUNCI: Firewall menganalisis paket data masuk dan keluar berdasarkan aturan keamanan yang telah ditentukan.
POIN: 20`;

  // Live client-side parsing preview
  const livePreview = useMemo(() => {
    if (!rawText.trim()) return [];
    try {
      return parseQuestionsFromPlaintext(rawText, selectedGrade, selectedPkgId);
    } catch {
      return [];
    }
  }, [rawText, selectedGrade, selectedPkgId]);

  const previewCounts = useMemo(() => {
    return {
      total: livePreview.length,
      mcq: livePreview.filter((q) => q.type === "PILIHAN_GANDA").length,
      multi: livePreview.filter((q) => q.type === "PG_KOMPLEKS").length,
      tf: livePreview.filter((q) => q.type === "BENAR_SALAH").length,
      causeEffect: livePreview.filter((q) => q.type === "CAUSE_EFFECT").length,
      essay: livePreview.filter((q) => q.type === "URAIAN").length,
    };
  }, [livePreview]);

  if (!isOpen) return null;

  const handlePasteExample = () => {
    setRawText(examplePlaceholder);
    setErrorMessage(null);
  };

  const handleExtractAndSave = async () => {
    setErrorMessage(null);
    if (!rawText.trim()) {
      setErrorMessage("Silakan tempel (Paste) teks naskah soal terlebih dahulu.");
      return;
    }

    const parsed = parseQuestionsFromPlaintext(rawText, selectedGrade, selectedPkgId);
    if (parsed.length === 0) {
      setErrorMessage(
        "Tidak ada butir soal yang berhasil dideteksi. Pastikan naskah memuat nomor soal (misal: 1., 2., Q1:) dan pilihan (A., B., C.)."
      );
      return;
    }

    setIsProcessing(true);
    setProcessStatusMessage(`Mengekstrak ${parsed.length} butir soal dari plaintext...`);

    try {
      let targetPkgId = selectedPkgId;
      let targetPkgName = packages.find((p) => p.id === selectedPkgId)?.name || "Bank Soal";

      // If user chose to create a new package
      if (isCreatingNewPackage && onCreateNewPackage) {
        setProcessStatusMessage("Menyiapkan berkas naskah soal baru...");
        const pkgName = newPackageName.trim() || `Naskah Tempel Plaintext (${new Date().toLocaleDateString("id-ID")})`;
        const created = await onCreateNewPackage({
          name: pkgName,
          fileName: `${pkgName}.txt`,
          subject: newPackageSubject.trim() || "Umum",
          tingkatKelas: selectedGrade,
          description: `Diimpor melalui Quick Paste Plaintext pada ${new Date().toLocaleString("id-ID")}`,
        });
        targetPkgId = created.id;
        targetPkgName = created.name;
      }

      setProcessStatusMessage(`Menyimpan ${parsed.length} soal serentak ke Firebase Firestore (writeBatch)...`);

      // Batch commit to Firebase Firestore
      const firestoreResult = await savePlaintextQuestionsToFirestore(parsed, {
        author: authorName,
        packageId: targetPkgId,
        packageName: targetPkgName,
      });

      if (!firestoreResult.success) {
        throw new Error(firestoreResult.error || "Gagal melakukan batch commit ke Firestore.");
      }

      setProcessStatusMessage("Memperbarui bank soal lokal...");

      // Convert to full Question items for immediate UI state update
      const nowIso = new Date().toISOString();
      const clientQuestions: Question[] = parsed.map((pq, idx) => {
        let appType: Question["type"] = "mcq";
        if (pq.type === "BENAR_SALAH") appType = "true_false";
        else if (pq.type === "PG_KOMPLEKS") appType = "multi_choice";
        else if (pq.type === "URAIAN") appType = "essay";
        else if (pq.type === "CAUSE_EFFECT") appType = "mcq";

        return {
          id: firestoreResult.ids[idx] || `q-plain-${Date.now()}-${idx}`,
          packageId: targetPkgId,
          packageName: targetPkgName,
          type: appType,
          question: pq.question,
          tingkatKelas: pq.gradeLevel,
          options: pq.optionsRaw,
          correctAnswer: pq.correctAnswer,
          correctAnswers: pq.correctAnswers,
          correctBool: pq.correctBool,
          keyAnswer: pq.answerKey,
          points: pq.point,
          lastModifiedBy: authorName,
          lastModifiedAt: nowIso,
          revisionHistory: [
            {
              id: "rev-plain-" + Date.now() + "-" + idx,
              timestamp: nowIso,
              modifiedBy: authorName,
              role: "admin",
              changeType: "CREATE",
              summary: "Dibuat melalui Quick Paste Plaintext",
            },
          ],
        };
      });

      onSuccess(clientQuestions, parsed.length, targetPkgName);
      onClose();
    } catch (err: any) {
      console.error("[QuickPaste] Error extracting & saving questions:", err);
      setErrorMessage(err?.message || "Terjadi kesalahan saat memproses dan menyimpan soal.");
    } finally {
      setIsProcessing(false);
      setProcessStatusMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[95vh] flex flex-col animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-600/30">
              <ClipboardCopy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Ekstrak &amp; Simpan Soal dari Plaintext
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Quick Paste
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Salin teks dari Word/PDF/Excel (Ctrl+A lalu Ctrl+C), kemudian tempel (Ctrl+V) di kolom berikut.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Controls Bar: Grade Selection & Target Package */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
            {/* 1. Grade Filter */}
            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center space-x-1.5">
                <span>Opsi Pilihan Jenjang / Filter Kelas:</span>
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value as TingkatKelas)}
                disabled={isProcessing}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer text-xs"
              >
                <option value="Semua Kelas">Semua Kelas (Universal / Default)</option>
                <option value="X">Kelas X</option>
                <option value="XI">Kelas XI</option>
                <option value="XII">Kelas XII</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Dapat dioverride otomatis jika ada tag <code className="text-cyan-400 font-mono">[KELAS: XII]</code> pada butir soal.
              </p>
            </div>

            {/* 2. Target Berkas / Package */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-bold flex items-center space-x-1">
                  <Folder className="w-3.5 h-3.5 text-blue-400" />
                  <span>Simpan ke Berkas / Naskah:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewPackage(!isCreatingNewPackage)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                >
                  {isCreatingNewPackage ? "Pilih Berkas Ada" : "+ Buat Berkas Baru"}
                </button>
              </div>

              {isCreatingNewPackage ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={newPackageName}
                    onChange={(e) => setNewPackageName(e.target.value)}
                    placeholder="Nama Berkas (misal: XII TKA Bahasa Inggris.docx)"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/50 text-white placeholder-slate-500 text-xs focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newPackageSubject}
                    onChange={(e) => setNewPackageSubject(e.target.value)}
                    placeholder="Mata Pelajaran (misal: Bahasa Inggris)"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none"
                  />
                </div>
              ) : (
                <select
                  value={selectedPkgId}
                  onChange={(e) => setSelectedPkgId(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer text-xs"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      📁 {pkg.name} ({pkg.tingkatKelas || "Semua Kelas"})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Quick Helper Toggle & Example Button */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowExampleGuide(!showExampleGuide)}
              className="text-slate-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer transition"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Petunjuk Format Tag &amp; Kunci Jawaban</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExampleGuide ? "rotate-180" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handlePasteExample}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer border border-slate-700"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Muat Contoh Plaintext</span>
            </button>
          </div>

          {/* Guide Box (Collapsible) */}
          {showExampleGuide && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-2 animate-in fade-in duration-150">
              <p className="font-bold text-slate-200">
                Format penulisan didukung otomatis:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-cyan-400 font-bold">Pilihan Ganda:</span>
                  <p className="text-slate-300">1. Soal pertanyaan...</p>
                  <p className="text-slate-400">A. Opsi A  B. Opsi B  C. Opsi C  D. Opsi D</p>
                  <p className="text-emerald-400">KUNCI: C</p>
                  <p className="text-amber-400">POIN: 10</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-cyan-400 font-bold">PG Kompleks (Multi Kunci):</span>
                  <p className="text-slate-300">2. [KOMPLEKS] Soal multi centang...</p>
                  <p className="text-slate-400">A. Jawaban 1  B. Jawaban 2  C. Jawaban 3</p>
                  <p className="text-emerald-400">KUNCI: A, C</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-cyan-400 font-bold">Benar / Salah:</span>
                  <p className="text-slate-300">3. [TRUE_FALSE] Pernyataan soal...</p>
                  <p className="text-emerald-400">KUNCI: Benar (atau Salah)</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-cyan-400 font-bold">Uraian / Essay / Isian:</span>
                  <p className="text-slate-300">4. [URAIAN] Jelaskan mekanisme...</p>
                  <p className="text-emerald-400">KUNCI: Penjelasan kunci jawaban...</p>
                  <p className="text-amber-400">POIN: 20</p>
                </div>
              </div>
            </div>
          )}

          {/* Large Monospace Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-slate-300 font-bold">
                Area Tempel Teks (Plaintext Area):
              </label>
              {rawText.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRawText("")}
                  className="text-slate-500 hover:text-rose-400 text-[11px] cursor-pointer"
                >
                  Bersihkan Teks
                </button>
              )}
            </div>

            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={isProcessing}
              rows={12}
              placeholder={examplePlaceholder}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-600 font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 resize-y"
            />
          </div>

          {/* Live Parsing Preview Summary Badge */}
          {livePreview.length > 0 && (
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-white">
                  Terdeteksi {previewCounts.total} Butir Soal:
                </span>
                <span className="text-[11px] text-blue-300">
                  ({previewCounts.mcq} PG, {previewCounts.multi} PG Kompleks, {previewCounts.tf} Benar/Salah, {previewCounts.causeEffect} Sebab-Akibat, {previewCounts.essay} Uraian)
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-bold">
                Format Siap Disimpan
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="p-3.5 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-cyan-200 flex items-center space-x-3 text-xs animate-pulse">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
              <div>
                <p className="font-bold text-white">Sedang Memproses...</p>
                <p className="text-[11px] text-cyan-300">{processStatusMessage || "Mohon tunggu..."}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
          <div className="text-[11px] text-slate-500">
            Penulis: <span className="text-slate-400 font-semibold">{authorName}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExtractAndSave}
              disabled={isProcessing || !rawText.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-600/25 flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Firestore...</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-4 h-4" />
                  <span>Ekstrak &amp; Simpan ke Bank Soal</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
