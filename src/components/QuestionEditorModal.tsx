import React, { useState, useRef } from "react";
import {
  X,
  Save,
  Eye,
  Edit3,
  Image as ImageIcon,
  Headphones,
  Video as VideoIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  FileCode,
  Upload,
  Link,
  ArrowRight,
  ListOrdered,
  CheckSquare,
  FileText,
  Percent,
  History,
} from "lucide-react";
import { Question, QuestionType, MatchingPair } from "../types";
import { MathRenderer } from "./MathRenderer";
import { MediaDisplay } from "./MediaDisplay";

interface QuestionEditorModalProps {
  isOpen?: boolean;
  onClose: () => void;
  question?: Question | null; // null if creating new
  initialQuestion?: Question | null; // alternative prop name
  onSave: (question: Omit<Question, "id">, id?: string) => void;
  onOpenRevisionHistory?: (question: Question) => void;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  isOpen = true,
  onClose,
  question,
  initialQuestion,
  onSave,
  onOpenRevisionHistory,
}) => {
  if (isOpen === false) return null;

  const targetQuestion = question || initialQuestion;
  const isEditing = !!targetQuestion?.id;

  // Active Tab: Editor Form vs Live Preview
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // Question Basic Data
  const [type, setType] = useState<QuestionType>(targetQuestion?.type || "mcq");
  const [questionText, setQuestionText] = useState(targetQuestion?.question || "");
  const [points, setPoints] = useState<number>(targetQuestion?.points ?? 10);
  const [subject, setSubject] = useState(targetQuestion?.subject || "");
  const [explanation, setExplanation] = useState(targetQuestion?.explanation || "");

  // Options for MCQ & Multi-choice
  const [options, setOptions] = useState<string[]>(
    targetQuestion?.options && targetQuestion.options.length > 0
      ? targetQuestion.options
      : ["", "", "", ""]
  );
  const [correctAnswer, setCorrectAnswer] = useState<number>(targetQuestion?.correctAnswer ?? 0);
  const [correctAnswers, setCorrectAnswers] = useState<number[]>(targetQuestion?.correctAnswers ?? [0]);

  // True/False
  const [correctBool, setCorrectBool] = useState<boolean>(targetQuestion?.correctBool ?? true);

  // Matching Pairs
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>(
    targetQuestion?.matchingPairs && targetQuestion.matchingPairs.length > 0
      ? targetQuestion.matchingPairs
      : [
          { left: "Pernyataan / Konsep A", right: "Pasangan Jawaban 1" },
          { left: "Pernyataan / Konsep B", right: "Pasangan Jawaban 2" },
        ]
  );

  // Key Answer for Essay / Short Answer
  const [keyAnswer, setKeyAnswer] = useState(targetQuestion?.keyAnswer || "");

  // Media
  const [mediaType, setMediaType] = useState<"none" | "image" | "audio" | "video">(
    targetQuestion?.mediaType || "none"
  );
  const [mediaUrl, setMediaUrl] = useState(targetQuestion?.mediaUrl || "");
  const [mediaCaption, setMediaCaption] = useState(targetQuestion?.mediaCaption || "");
  const [audioPlayLimit, setAudioPlayLimit] = useState<number>(targetQuestion?.audioPlayLimit || 0);

  // Equation insertion state
  const [showFormulaHelper, setShowFormulaHelper] = useState(false);
  const questionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick insert math formula into active cursor position of textarea
  const insertFormulaSnippet = (snippet: string) => {
    const textarea = questionTextareaRef.current;
    if (!textarea) {
      setQuestionText((prev) => prev + " " + snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = questionText;
    const newText = text.substring(0, start) + snippet + text.substring(end);
    setQuestionText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 50);
  };

  // Handle local media file upload (converted to data URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("Ukuran berkas maksimal adalah 25MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Save
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!(questionText || "").trim()) {
      alert("Teks butir soal tidak boleh kosong.");
      return;
    }

    // Build question payload
    const payload: Omit<Question, "id"> = {
      type,
      question: (questionText || "").trim(),
      points: Number(points) || 10,
      subject: (subject || "").trim() || undefined,
      explanation: (explanation || "").trim() || undefined,
      mediaType,
      mediaUrl: mediaType !== "none" ? (mediaUrl || "").trim() : undefined,
      mediaCaption: mediaType !== "none" ? (mediaCaption || "").trim() : undefined,
      audioPlayLimit: mediaType === "audio" ? Number(audioPlayLimit) || 0 : undefined,
    };

    if (type === "mcq") {
      const filteredOptions = (options || []).map((o) => (o || "").trim()).filter(Boolean);
      if (filteredOptions.length < 2) {
        alert("Pilihan Ganda minimal harus memiliki 2 opsi jawaban.");
        return;
      }
      payload.options = filteredOptions;
      payload.correctAnswer = Math.min(correctAnswer, filteredOptions.length - 1);
    } else if (type === "multi_choice") {
      const filteredOptions = (options || []).map((o) => (o || "").trim()).filter(Boolean);
      if (filteredOptions.length < 2) {
        alert("Pilihan Ganda Kompleks minimal harus memiliki 2 opsi jawaban.");
        return;
      }
      payload.options = filteredOptions;
      payload.correctAnswers = correctAnswers.filter((idx) => idx < filteredOptions.length);
    } else if (type === "true_false") {
      payload.correctBool = correctBool;
      payload.keyAnswer = correctBool ? "Benar" : "Salah";
    } else if (type === "matching") {
      const validPairs = matchingPairs.filter(
        (p) => (p?.left || "").trim() !== "" && (p?.right || "").trim() !== ""
      );
      if (validPairs.length < 2) {
        alert("Soal menjodohkan minimal harus memiliki 2 pasang pernyataan.");
        return;
      }
      payload.matchingPairs = validPairs;
    } else if (type === "short_answer" || type === "essay") {
      payload.keyAnswer = (keyAnswer || "").trim();
    }

    onSave(payload, question?.id);
    onClose();
  };

  // Mock student preview object
  const previewQuestion: Question = {
    id: question?.id || "preview-q",
    type,
    question: questionText,
    options: options.filter(Boolean),
    correctAnswer,
    correctAnswers,
    correctBool,
    matchingPairs,
    keyAnswer,
    points,
    mediaType,
    mediaUrl,
    mediaCaption,
    audioPlayLimit,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {isEditing ? "Edit Butir Soal Ujian" : "Tambah Butir Soal Baru"}
              </h3>
              <p className="text-xs text-slate-400">
                Mendukung formula LaTeX MathML, media visual/audio listening, dan variasi format soal
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tab switch: Edit vs Preview */}
            <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === "edit"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Formulir Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Siswa</span>
              </button>
            </div>

            {targetQuestion?.id && onOpenRevisionHistory && (
              <button
                type="button"
                onClick={() => onOpenRevisionHistory(targetQuestion)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                title="Lihat riwayat revisi dan audit perubahan butir soal ini"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Riwayat ({targetQuestion.revisionHistory?.length || 0})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {activeTab === "edit" ? (
            <form id="question-editor-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Row 1: Question Type & Points & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Tipe Variasi Soal <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as QuestionType)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="mcq">Pilihan Ganda (Single Choice)</option>
                    <option value="true_false">Benar / Salah (True / False)</option>
                    <option value="matching">Menjodohkan (Memasangkan Pernyataan)</option>
                    <option value="multi_choice">Pilihan Ganda Kompleks (Multi Checkbox)</option>
                    <option value="short_answer">Isian Singkat</option>
                    <option value="essay">Uraian / Essay (AI Gemini Evaluated)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Bobot Skor / Poin <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={points}
                    onChange={(e) => setPoints(parseInt(e.target.value, 10) || 10)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Mata Pelajaran (Opsional)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: Matematika, Bahasa Inggris"
                  />
                </div>
              </div>

              {/* Row 2: Question Text with LaTeX Formula Toolbar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Badan Soal / Pernyataan <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFormulaHelper(!showFormulaHelper)}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      showFormulaHelper
                        ? "bg-purple-600/30 border-purple-500/50 text-purple-300"
                        : "bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-purple-400" />
                    <span>Equation Editor (LaTeX)</span>
                  </button>
                </div>

                {/* Equation Helper Toolbar */}
                {showFormulaHelper && (
                  <div className="rounded-2xl border border-purple-500/30 bg-purple-950/30 p-3 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs text-purple-200 font-bold border-b border-purple-500/20 pb-1.5">
                      <span>Klik untuk menyisipkan rumus LaTeX ke kursor:</span>
                      <span className="text-[11px] font-normal text-purple-300">
                        Gunakan <code>$rumus$</code> (inline) atau <code>$$rumus$$</code> (blok tengah)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$\\frac{a}{b}$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Pecahan"
                      >
                        Pecahan (\frac&#123;a&#125;&#123;b&#125;)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$\\sqrt{x}$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Akar kuadrat"
                      >
                        Akar (\sqrt&#123;x&#125;)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$x^{2}$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Pangkat"
                      >
                        Pangkat (x^2)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$x_{1}$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Indeks bawah"
                      >
                        Indeks (x_1)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$$\\int_{a}^{b} f(x)\\,dx$$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Integral"
                      >
                        Integral (\int)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$$\\sum_{i=1}^{n} x_i$$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Sigma"
                      >
                        Sigma (\sum)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$\\lim_{x \\to 0} f(x)$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Limit"
                      >
                        Limit (\lim)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$\\alpha, \\beta, \\theta, \\pi$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Simbol Yunani"
                      >
                        Yunani (α, β, θ, π)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$\\pm, \\le, \\ge, \\approx, \\neq$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Operator matematika"
                      >
                        Relasi (±, ≤, ≥, ≈, ≠)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Matriks"
                      >
                        Matriks 2x2
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormulaSnippet("$\\text{H}_2\\text{O} + \\text{CO}_2$")}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-600/40 text-purple-200 text-xs font-mono border border-purple-500/30"
                        title="Rumus Kimia"
                      >
                        Kimia (H₂O)
                      </button>
                    </div>
                  </div>
                )}

                <textarea
                  ref={questionTextareaRef}
                  rows={4}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Ketik isi pertanyaan di sini. Anda dapat memasukkan rumus LaTeX seperti $\frac{a}{b}$ atau $$\sqrt{x^2+y^2}$$..."
                  className="w-full rounded-2xl bg-slate-950 border border-slate-800 p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
                  required
                />

                {/* Real-time Math Preview Box */}
                {(questionText.includes("$") || questionText.includes("\\(")) && (
                  <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                      Live KaTeX Preview:
                    </span>
                    <MathRenderer text={questionText} className="text-slate-200 font-medium" />
                  </div>
                )}
              </div>

              {/* Row 3: Media Support (Image, Listening Audio, Video) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Lampiran Media Soal
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                      Gambar / Audio Listening / Video Singkat
                    </span>
                  </div>

                  {/* Media Type Selector */}
                  <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setMediaType("none")}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        mediaType === "none"
                          ? "bg-slate-800 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Tanpa Media
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaType("image")}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition cursor-pointer ${
                        mediaType === "image"
                          ? "bg-blue-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Gambar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaType("audio")}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition cursor-pointer ${
                        mediaType === "audio"
                          ? "bg-purple-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      <span>Audio (Listening)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaType("video")}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition cursor-pointer ${
                        mediaType === "video"
                          ? "bg-rose-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <VideoIcon className="w-3.5 h-3.5" />
                      <span>Video</span>
                    </button>
                  </div>
                </div>

                {/* Media Configuration Details */}
                {mediaType !== "none" && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          URL Media atau Unggah Berkas:
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                            placeholder={
                              mediaType === "image"
                                ? "https://example.com/diagram.png atau klik Upload"
                                : mediaType === "audio"
                                ? "https://example.com/listening-track.mp3 atau klik Upload"
                                : "https://example.com/clip.mp4 atau link YouTube"
                            }
                            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={
                              mediaType === "image"
                                ? "image/*"
                                : mediaType === "audio"
                                ? "audio/*"
                                : "video/*"
                            }
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="shrink-0 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Unggah</span>
                          </button>
                        </div>
                      </div>

                      {/* Specific settings for Audio Listening */}
                      {mediaType === "audio" ? (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Batas Putar Audio (Listening Limit):
                          </label>
                          <select
                            value={audioPlayLimit}
                            onChange={(e) => setAudioPlayLimit(parseInt(e.target.value, 10) || 0)}
                            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value={0}>Bebas (Tanpa Batas)</option>
                            <option value={1}>Maksimal 1 Kali Putar</option>
                            <option value={2}>Maksimal 2 Kali Putar (Standar CBT)</option>
                            <option value={3}>Maksimal 3 Kali Putar</option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Keterangan / Caption Media:
                          </label>
                          <input
                            type="text"
                            value={mediaCaption}
                            onChange={(e) => setMediaCaption(e.target.value)}
                            placeholder="Contoh: Gambar 1. Diagram Sirkuit Listrik"
                            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Audio caption if audio */}
                    {mediaType === "audio" && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Instruksi Listening / Keterangan:
                        </label>
                        <input
                          type="text"
                          value={mediaCaption}
                          onChange={(e) => setMediaCaption(e.target.value)}
                          placeholder="Contoh: Dengarkan dialog pendek berikut untuk menjawab soal No. 4 dan 5."
                          className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    )}

                    {/* Media Inline Preview */}
                    {mediaUrl && (
                      <div className="pt-2">
                        <MediaDisplay
                          mediaType={mediaType}
                          mediaUrl={mediaUrl}
                          mediaCaption={mediaCaption}
                          audioPlayLimit={audioPlayLimit}
                          questionId="editor-preview"
                          readOnly={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Row 4: Answer Configuration based on Type */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                {/* 1. MCQ OPTIONS */}
                {type === "mcq" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Opsi Pilihan Jawaban (Pilih Radio untuk Kunci Benar)
                      </label>
                      <button
                        type="button"
                        onClick={() => setOptions((prev) => [...prev, ""])}
                        className="flex items-center space-x-1 text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Opsi ({String.fromCharCode(65 + options.length)})</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {options.map((opt, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isCorrect = correctAnswer === idx;

                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border flex items-center space-x-3 transition ${
                              isCorrect
                                ? "bg-emerald-950/30 border-emerald-500/60 text-emerald-200"
                                : "bg-slate-950 border-slate-800 text-slate-300"
                            }`}
                          >
                            <label className="flex items-center space-x-2 cursor-pointer shrink-0">
                              <input
                                type="radio"
                                name="mcq-correct-answer"
                                checked={isCorrect}
                                onChange={() => setCorrectAnswer(idx)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isCorrect
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {letter}
                              </span>
                            </label>

                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...options];
                                newOpts[idx] = e.target.value;
                                setOptions(newOpts);
                              }}
                              placeholder={`Teks opsi ${letter}... (bisa rumus LaTeX seperti $x^2$)`}
                              className="w-full bg-transparent border-0 text-xs font-medium text-white focus:outline-none placeholder-slate-600"
                              required
                            />

                            {/* Math preview of option if contains formula */}
                            {opt.includes("$") && (
                              <div className="shrink-0 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs text-blue-300 font-serif">
                                <MathRenderer text={opt} inline={true} />
                              </div>
                            )}

                            {options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOpts = options.filter((_, i) => i !== idx);
                                  setOptions(newOpts);
                                  if (correctAnswer >= newOpts.length) {
                                    setCorrectAnswer(0);
                                  }
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Hapus opsi ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. TRUE / FALSE */}
                {type === "true_false" && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Tentukan Kunci Jawaban Benar / Salah:
                    </label>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => setCorrectBool(true)}
                        className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          correctBool === true
                            ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-black shadow-lg shadow-emerald-500/10"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                        }`}
                      >
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        <span className="text-base">BENAR (TRUE)</span>
                        <span className="text-[10px] font-normal opacity-80">
                          Pernyataan pada soal bernilai Benar
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCorrectBool(false)}
                        className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          correctBool === false
                            ? "bg-rose-950/60 border-rose-500 text-rose-300 font-black shadow-lg shadow-rose-500/10"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                        }`}
                      >
                        <X className="w-6 h-6 text-rose-400" />
                        <span className="text-base">SALAH (FALSE)</span>
                        <span className="text-[10px] font-normal opacity-80">
                          Pernyataan pada soal bernilai Salah
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. MATCHING / MENJODOHKAN */}
                {type === "matching" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Daftar Pasangan Pernyataan (Kolom Kiri &rarr; Kolom Kanan)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Siswa akan menjodohkan setiap konsep di Kolom Kiri dengan pasangan yang tepat di Kolom Kanan. Urutan kanan akan diacak otomatis saat ujian.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setMatchingPairs((prev) => [
                            ...prev,
                            { left: "", right: "" },
                          ])
                        }
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-bold hover:bg-blue-600/30 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Pasangan</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {matchingPairs.map((pair, pIdx) => (
                        <div
                          key={pIdx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-950 border border-slate-800 p-2.5 rounded-xl"
                        >
                          <div className="sm:col-span-1 text-center font-bold text-xs text-blue-400">
                            #{pIdx + 1}
                          </div>
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={pair.left}
                              onChange={(e) => {
                                const newPairs = [...matchingPairs];
                                newPairs[pIdx].left = e.target.value;
                                setMatchingPairs(newPairs);
                              }}
                              placeholder="Pernyataan Kolom Kiri (Premis)..."
                              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div className="sm:col-span-1 text-center text-slate-500 hidden sm:block">
                            &rarr;
                          </div>
                          <div className="sm:col-span-4">
                            <input
                              type="text"
                              value={pair.right}
                              onChange={(e) => {
                                const newPairs = [...matchingPairs];
                                newPairs[pIdx].right = e.target.value;
                                setMatchingPairs(newPairs);
                              }}
                              placeholder="Pasangan Benar Kolom Kanan..."
                              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-emerald-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                              required
                            />
                          </div>
                          <div className="sm:col-span-1 text-right">
                            {matchingPairs.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMatchingPairs(matchingPairs.filter((_, i) => i !== pIdx));
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Hapus Pasangan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. MULTI-CHOICE (KOMPLEKS) */}
                {type === "multi_choice" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Pilihan Ganda Kompleks (Centang Semua Jawaban yang Benar)
                        </label>
                        <p className="text-[11px] text-slate-400">
                          Siswa dapat memilih lebih dari satu jawaban yang benar (format checkbox).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOptions((prev) => [...prev, ""])}
                        className="flex items-center space-x-1 text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Opsi</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {options.map((opt, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isChecked = correctAnswers.includes(idx);

                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border flex items-center space-x-3 transition ${
                              isChecked
                                ? "bg-emerald-950/30 border-emerald-500/60 text-emerald-200"
                                : "bg-slate-950 border-slate-800 text-slate-300"
                            }`}
                          >
                            <label className="flex items-center space-x-2 cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setCorrectAnswers(correctAnswers.filter((i) => i !== idx));
                                  } else {
                                    setCorrectAnswers([...correctAnswers, idx]);
                                  }
                                }}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isChecked
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {letter}
                              </span>
                            </label>

                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...options];
                                newOpts[idx] = e.target.value;
                                setOptions(newOpts);
                              }}
                              placeholder={`Teks opsi ${letter}...`}
                              className="w-full bg-transparent border-0 text-xs font-medium text-white focus:outline-none placeholder-slate-600"
                              required
                            />

                            {options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOpts = options.filter((_, i) => i !== idx);
                                  setOptions(newOpts);
                                  setCorrectAnswers(correctAnswers.filter((i) => i !== idx));
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. SHORT ANSWER */}
                {type === "short_answer" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Kunci Jawaban Isian Singkat:
                    </label>
                    <input
                      type="text"
                      value={keyAnswer}
                      onChange={(e) => setKeyAnswer(e.target.value)}
                      placeholder="Masukkan kata/frasa kunci jawaban benar (contoh: Fotosintesis)..."
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-emerald-300 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <p className="text-[11px] text-slate-400">
                      Penilaian isian singkat otomatis mencocokkan teks jawaban siswa secara case-insensitive tanpa mempermasalahkan spasi berlebih.
                    </p>
                  </div>
                )}

                {/* 6. ESSAY / URAIAN */}
                {type === "essay" && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Rubrik &amp; Model Jawaban (AI Gemini Evaluation)</span>
                    </div>
                    <textarea
                      rows={3}
                      value={keyAnswer}
                      onChange={(e) => setKeyAnswer(e.target.value)}
                      placeholder="Tuliskan poin-poin konsep penting, kata kunci, atau contoh jawaban lengkap untuk dipedomani oleh AI saat menilai jawaban siswa..."
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Gemini AI Engine akan membandingkan pemahaman konsep jawaban siswa dengan rubrik ini dan memberikan skor proporsional serta feedback diagnostik.
                    </p>
                  </div>
                )}

                {/* Optional Explanation (Pembahasan) */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Pembahasan Soal / Keterangan Tambahan (Opsional):
                  </label>
                  <input
                    type="text"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Contoh: Jawaban benar adalah B karena hukum Ohm menyatakan V = I * R."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </form>
          ) : (
            /* Tab: Live Preview of how students see the question */
            <div className="space-y-5 rounded-2xl bg-slate-950 border border-slate-800 p-5 sm:p-7 shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold text-xs">
                    Preview Soal
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-semibold text-xs uppercase">
                    {type === "mcq"
                      ? "Pilihan Ganda"
                      : type === "true_false"
                      ? "Benar / Salah"
                      : type === "matching"
                      ? "Menjodohkan"
                      : type === "multi_choice"
                      ? "PG Kompleks"
                      : type === "short_answer"
                      ? "Isian Singkat"
                      : "Uraian / Essay"}
                  </span>
                  <span className="text-xs text-amber-400 font-bold">
                    ({points} Poin)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium italic">
                  Mode Simulasi Tampilan Peserta Ujian
                </span>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed">
                <MathRenderer text={questionText || "Pertanyaan belum diisi..."} />
              </div>

              {/* Media Display */}
              {mediaType !== "none" && mediaUrl && (
                <MediaDisplay
                  mediaType={mediaType}
                  mediaUrl={mediaUrl}
                  mediaCaption={mediaCaption}
                  audioPlayLimit={audioPlayLimit}
                  questionId="sim-preview"
                  readOnly={true}
                />
              )}

              {/* Options or Interactive Student Controls */}
              {type === "mcq" && (
                <div className="space-y-2.5 pt-2">
                  {options.filter(Boolean).map((opt, idx) => (
                    <div
                      key={idx}
                      className={`w-full text-left p-3.5 rounded-xl border flex items-start space-x-3 transition ${
                        idx === correctAnswer
                          ? "bg-blue-600/20 border-blue-500 text-white"
                          : "bg-slate-900 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-black shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className="text-sm pt-0.5 leading-relaxed">
                        <MathRenderer text={opt} inline={true} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {type === "true_false" && (
                <div className="grid grid-cols-2 gap-3 pt-2 max-w-md">
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm ${
                      correctBool === true
                        ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>BENAR</span>
                  </div>
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm ${
                      correctBool === false
                        ? "bg-rose-950/40 border-rose-500 text-rose-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <X className="w-4 h-4 text-rose-400" />
                    <span>SALAH</span>
                  </div>
                </div>
              )}

              {type === "matching" && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">
                    Format Interaktif Menjodohkan:
                  </h4>
                  <div className="space-y-2">
                    {matchingPairs.map((p, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl items-center"
                      >
                        <div className="text-xs text-slate-200 font-medium">
                          <MathRenderer text={p.left} inline={true} />
                        </div>
                        <div className="text-xs text-emerald-400 font-bold bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                          <span>Pasangan: {p.right}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {type === "multi_choice" && (
                <div className="space-y-2.5 pt-2">
                  {options.filter(Boolean).map((opt, idx) => (
                    <div
                      key={idx}
                      className={`w-full text-left p-3 rounded-xl border flex items-start space-x-3 ${
                        correctAnswers.includes(idx)
                          ? "bg-emerald-950/30 border-emerald-500/60 text-emerald-200"
                          : "bg-slate-900 border-slate-800 text-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={correctAnswers.includes(idx)}
                        readOnly
                        className="w-4 h-4 mt-0.5 rounded text-emerald-600"
                      />
                      <span className="text-xs font-bold">{String.fromCharCode(65 + idx)}.</span>
                      <span className="text-xs">{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              {type === "short_answer" && (
                <div className="pt-2 space-y-2">
                  <input
                    type="text"
                    disabled
                    placeholder="Siswa mengetik isian singkat di sini..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-400"
                  />
                  <p className="text-xs text-emerald-400 font-semibold">
                    Kunci Jawaban: {keyAnswer}
                  </p>
                </div>
              )}

              {type === "essay" && (
                <div className="pt-2 space-y-2">
                  <textarea
                    rows={4}
                    disabled
                    placeholder="Siswa mengetik jawaban uraian essay di sini..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 resize-none"
                  />
                  {keyAnswer && (
                    <p className="text-xs text-cyan-300 font-medium">
                      Rubrik AI: {keyAnswer}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={(e) => {
              if (activeTab === "preview") {
                setActiveTab("edit");
              }
              const form = document.getElementById("question-editor-form") as HTMLFormElement;
              if (form) {
                form.requestSubmit();
              }
            }}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center space-x-1.5 shadow-lg shadow-blue-600/25 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isEditing ? "Simpan Perubahan Soal" : "Tambahkan Soal ke Bank Soal"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
