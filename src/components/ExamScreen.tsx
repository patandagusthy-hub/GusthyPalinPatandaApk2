import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  FileCheck,
  Sparkles,
  ShieldAlert,
  Loader2,
  Award,
  Zap,
  Wifi,
  WifiOff,
  Shuffle,
  CheckSquare,
  Square,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Student, Question, ExamConfig, ViolationRecord } from "../types";
import { WebcamProctor } from "./WebcamProctor";
import { ThemeToggle } from "./ThemeToggle";
import { HelpdeskSupport } from "./HelpdeskSupport";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { getStudentExamQuestions, getStudentQuestionOptions } from "../utils/shuffleUtils";
import { MathRenderer } from "./MathRenderer";
import { MediaDisplay } from "./MediaDisplay";

interface ExamScreenProps {
  student: Student;
  questions: Question[];
  config: ExamConfig;
  answers: Record<string, any>;
  violationsCount: number;
  isGrading: boolean;
  onRecordAnswer: (questionId: string, answer: any) => void;
  onSubmitExam: (reason?: string) => void;
  onRecordViolation: (
    type: ViolationRecord["type"],
    title: string,
    description: string,
    snapshot?: string
  ) => void;
}

export const ExamScreen: React.FC<ExamScreenProps> = ({
  student,
  questions,
  config,
  answers,
  violationsCount,
  isGrading,
  onRecordAnswer,
  onSubmitExam,
  onRecordViolation,
}) => {
  const { isOnline } = useNetworkStatus();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(config.durationMinutes * 60);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const [confirmAgreed, setConfirmAgreed] = useState(false);

  const handleOpenSubmitConfirm = () => {
    setConfirmAgreed(false);
    setShowSubmitConfirm(true);
  };

  // Deterministic shuffled questions per student (anti-nyontek)
  const studentQuestions = useMemo(() => {
    return getStudentExamQuestions(questions, student, config);
  }, [questions, student, config]);

  // Active question from student's personalized sequence
  const currentQuestion = studentQuestions[currentIndex] || studentQuestions[0] || questions[0];

  // Shuffled options for current question (if MCQ and enabled)
  const currentOptions = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== "mcq") return [];
    return getStudentQuestionOptions(currentQuestion, student, config);
  }, [currentQuestion, student, config]);

  // Anti-Lag Local Essay State (eliminates input stutter/freezing completely)
  const [essayDraft, setEssayDraft] = useState<string>("");
  const essayDebounceRef = useRef<any>(null);

  useEffect(() => {
    if (currentQuestion && currentQuestion.type === "essay") {
      setEssayDraft(String(answers[currentQuestion.id] || ""));
    }
  }, [currentIndex, currentQuestion?.id]);

  const handleEssayChange = (val: string) => {
    setEssayDraft(val);
    if (essayDebounceRef.current) {
      clearTimeout(essayDebounceRef.current);
    }
    essayDebounceRef.current = setTimeout(() => {
      onRecordAnswer(currentQuestion.id, val);
    }, 200);
  };

  const handleEssayBlur = () => {
    if (essayDebounceRef.current) {
      clearTimeout(essayDebounceRef.current);
    }
    onRecordAnswer(currentQuestion.id, essayDraft);
  };

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSubmitExam("Waktu ujian telah habis!");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onSubmitExam]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isLowTime = timeLeftSeconds < 300; // < 5 mins

  // Toggle flag
  const toggleFlag = (qId: string) => {
    setFlaggedQuestions((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid if user is currently typing in an essay textarea
      if (
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "INPUT"
      ) {
        return;
      }

      if (e.key === "ArrowRight" && currentIndex < studentQuestions.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      } else if (["1", "2", "3", "4"].includes(e.key) && currentQuestion?.type === "mcq") {
        const optionPos = parseInt(e.key, 10) - 1;
        if (currentOptions[optionPos]) {
          onRecordAnswer(currentQuestion.id, currentOptions[optionPos].originalIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, currentQuestion, currentOptions, onRecordAnswer, studentQuestions.length]);

  const isQuestionAnswered = (val: any): boolean => {
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    if (typeof val === "boolean") return true;
    return true;
  };

  const answeredStats = useMemo(() => {
    let answered = 0;
    let unanswered = 0;
    let flagged = 0;
    const unansweredIndices: number[] = [];
    const flaggedIndices: number[] = [];

    studentQuestions.forEach((q, idx) => {
      const isAns = isQuestionAnswered(answers[q.id]);
      const isFlg = !!flaggedQuestions[q.id];
      if (isAns) {
        answered++;
      } else {
        unanswered++;
        unansweredIndices.push(idx);
      }
      if (isFlg) {
        flagged++;
        flaggedIndices.push(idx);
      }
    });

    return { answered, unanswered, flagged, unansweredIndices, flaggedIndices };
  }, [studentQuestions, answers, flaggedQuestions]);

  const answeredCount = answeredStats.answered;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white p-3 sm:p-6 select-none relative">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto mb-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Left: Exam Info */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
            {currentIndex + 1}
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white truncate max-w-xs sm:max-w-md">
              {config.subject}
            </h1>
            <p className="text-[11px] text-slate-400">
              Peserta: <strong className="text-slate-200">{student.name}</strong> ({student.nisn})
            </p>
          </div>
        </div>

        {/* Center: Timer & Anti-Lag Indicator */}
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl border font-mono font-bold text-sm sm:text-base ${
              isLowTime
                ? "bg-rose-950/60 border-rose-500 text-rose-400 animate-pulse"
                : "bg-slate-950 border-slate-700 text-amber-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Sisa Waktu: {formatTime(timeLeftSeconds)}</span>
          </div>

          <div className="hidden xl:flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs text-emerald-300 font-semibold shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anti-Lag Engine: Autosave Aktif (0ms)</span>
          </div>
        </div>

        {/* Right: Theme Accessibility Toggle, Violations Badge & Submit Button */}
        <div className="flex items-center space-x-2.5">
          {/* Offline Resilience Indicator */}
          {!isOnline && (
            <div
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-950/90 border border-amber-500/80 text-amber-300 text-xs font-bold animate-pulse shadow-md"
              title="Koneksi internet terputus sementara. Mode offline aktif, ujian Anda aman dan jawaban tersimpan di memori lokal perangkat."
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Offline (Ujian Tetap Berjalan)</span>
            </div>
          )}

          {/* High Contrast Accessibility Toggle for Exam */}
          <ThemeToggle variant="badge" />

          {/* Violations Warning Capsule */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              violationsCount > 0
                ? "bg-rose-950/80 border-rose-500/80 text-rose-300"
                : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Pelanggaran:</span>
            <span className="font-extrabold text-rose-400">
              {violationsCount} / {config.maxAllowedViolations}
            </span>
          </div>

          <HelpdeskSupport
            variant="compact"
            context="exam"
            phoneNumber={config.helpdeskPhone || "085240195357"}
            adminName={config.helpdeskName || "Admin CBT (Gusthy Palin Patanda)"}
            studentName={student.name}
            studentNisn={student.nisn}
          />

          <button
            type="button"
            onClick={handleOpenSubmitConfirm}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Kirim Ujian</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Question Content & Sidebar */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Active Question Workspace */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xl min-h-[460px] flex flex-col justify-between">
            {/* Question Top Info */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold text-xs">
                    Soal No. {currentIndex + 1}
                  </span>
                  {config.randomizeQuestions !== false && (
                    <span
                      className="px-2.5 py-1 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[11px] flex items-center space-x-1"
                      title="Urutan soal diacak unik per peserta untuk mencegah kecurangan dan saling contek"
                    >
                      <Shuffle className="w-3 h-3 text-purple-400" />
                      <span className="hidden sm:inline">Acak Soal Aktif</span>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-semibold text-xs uppercase">
                    {currentQuestion.type === "mcq"
                      ? "Pilihan Ganda"
                      : currentQuestion.type === "true_false"
                      ? "Benar / Salah"
                      : currentQuestion.type === "matching"
                      ? "Menjodohkan"
                      : currentQuestion.type === "multi_choice"
                      ? "PG Kompleks"
                      : currentQuestion.type === "short_answer"
                      ? "Isian Singkat"
                      : "Uraian / Essay"}
                  </span>
                  <span className="text-xs text-amber-400 font-semibold">
                    ({currentQuestion.points} Poin)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    flaggedQuestions[currentQuestion.id]
                      ? "bg-amber-500/20 border-amber-500 text-amber-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{flaggedQuestions[currentQuestion.id] ? "Ragu-ragu" : "Tandai Ragu"}</span>
                </button>
              </div>

              {/* Question Text with KaTeX Math Rendering */}
              <div className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed mb-4">
                <MathRenderer text={currentQuestion.question} />
              </div>

              {/* Rich Media Display (Images, Listening Audio Player, Video) */}
              {currentQuestion.mediaType && currentQuestion.mediaType !== "none" && currentQuestion.mediaUrl && (
                <div className="mb-6">
                  <MediaDisplay
                    mediaType={currentQuestion.mediaType}
                    mediaUrl={currentQuestion.mediaUrl}
                    mediaCaption={currentQuestion.mediaCaption}
                    audioPlayLimit={currentQuestion.audioPlayLimit}
                    questionId={currentQuestion.id}
                  />
                </div>
              )}

              {/* 1. MCQ Options */}
              {currentQuestion.type === "mcq" && currentOptions.length > 0 && (
                <div className="space-y-3">
                  {currentOptions.map((opt, displayIdx) => {
                    const isSelected = answers[currentQuestion.id] === opt.originalIndex;
                    const letter = String.fromCharCode(65 + displayIdx); // A, B, C, D, E

                    return (
                      <button
                        key={opt.originalIndex}
                        type="button"
                        onClick={() => onRecordAnswer(currentQuestion.id, opt.originalIndex)}
                        className={`w-full text-left p-3.5 sm:p-4 rounded-xl border flex items-start space-x-3 transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10"
                            : "bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {letter}
                        </span>
                        <div className="text-sm pt-0.5 leading-relaxed">
                          <MathRenderer text={opt.text} inline={true} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2. True / False (Benar / Salah) */}
              {currentQuestion.type === "true_false" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 max-w-lg">
                  <button
                    type="button"
                    onClick={() => onRecordAnswer(currentQuestion.id, true)}
                    className={`p-5 rounded-2xl border flex items-center space-x-3 transition cursor-pointer ${
                      answers[currentQuestion.id] === true
                        ? "bg-emerald-950/70 border-emerald-500 text-emerald-200 font-black shadow-lg shadow-emerald-500/20"
                        : "bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        answers[currentQuestion.id] === true
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-base font-extrabold block">BENAR (TRUE)</span>
                      <span className="text-[11px] font-normal opacity-80">
                        Pernyataan pada soal ini bernilai benar
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordAnswer(currentQuestion.id, false)}
                    className={`p-5 rounded-2xl border flex items-center space-x-3 transition cursor-pointer ${
                      answers[currentQuestion.id] === false
                        ? "bg-rose-950/70 border-rose-500 text-rose-200 font-black shadow-lg shadow-rose-500/20"
                        : "bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        answers[currentQuestion.id] === false
                          ? "bg-rose-600 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <span className="text-sm font-black">✕</span>
                    </div>
                    <div>
                      <span className="text-base font-extrabold block">SALAH (FALSE)</span>
                      <span className="text-[11px] font-normal opacity-80">
                        Pernyataan pada soal ini bernilai salah
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* 3. Matching (Menjodohkan / Memasangkan) */}
              {currentQuestion.type === "matching" && (
                <div className="space-y-4 pt-2">
                  <div className="rounded-xl bg-blue-950/30 border border-blue-500/20 p-3 text-xs text-blue-300">
                    Petunjuk: Jodohkan setiap pernyataan di kolom kiri dengan pasangan jawaban yang tepat di kolom kanan.
                  </div>

                  <div className="space-y-3">
                    {currentQuestion.matchingPairs?.map((pair, pIdx) => {
                      const studentMatches = (answers[currentQuestion.id] || {}) as Record<number, string>;
                      const selectedRight = studentMatches[pIdx] || "";
                      const availableRights = currentQuestion.matchingPairs?.map((p) => p.right).filter(Boolean) || [];

                      return (
                        <div
                          key={pIdx}
                          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-950/70 border border-slate-800 p-4 rounded-xl"
                        >
                          <div className="md:col-span-1 text-center font-bold text-xs text-blue-400">
                            #{pIdx + 1}
                          </div>
                          <div className="md:col-span-6 text-sm text-slate-200 font-medium leading-relaxed">
                            <MathRenderer text={pair.left} />
                          </div>
                          <div className="md:col-span-5">
                            <select
                              value={selectedRight}
                              onChange={(e) => {
                                const newMatches = { ...studentMatches, [pIdx]: e.target.value };
                                onRecordAnswer(currentQuestion.id, newMatches);
                              }}
                              className={`w-full rounded-xl p-2.5 text-xs font-semibold focus:outline-none transition cursor-pointer border ${
                                selectedRight
                                  ? "bg-emerald-950/60 border-emerald-500 text-emerald-200"
                                  : "bg-slate-900 border-slate-700 text-slate-400"
                              }`}
                            >
                              <option value="">-- Pilih Pasangan Jawaban --</option>
                              {availableRights.map((r, rIdx) => (
                                <option key={rIdx} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Multi-Choice (Pilihan Ganda Kompleks) */}
              {currentQuestion.type === "multi_choice" && currentOptions.length > 0 && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-purple-950/30 border border-purple-500/20 p-2.5 text-xs text-purple-300">
                    Petunjuk: Anda dapat memilih lebih dari satu jawaban yang benar (Centang kotak yang sesuai).
                  </div>

                  {currentOptions.map((opt, displayIdx) => {
                    const selectedList: number[] = Array.isArray(answers[currentQuestion.id])
                      ? answers[currentQuestion.id]
                      : [];
                    const isChecked = selectedList.includes(opt.originalIndex);
                    const letter = String.fromCharCode(65 + displayIdx);

                    return (
                      <button
                        key={opt.originalIndex}
                        type="button"
                        onClick={() => {
                          const newList = isChecked
                            ? selectedList.filter((i) => i !== opt.originalIndex)
                            : [...selectedList, opt.originalIndex];
                          onRecordAnswer(currentQuestion.id, newList);
                        }}
                        className={`w-full text-left p-3.5 rounded-xl border flex items-start space-x-3 transition cursor-pointer ${
                          isChecked
                            ? "bg-purple-950/40 border-purple-500 text-white shadow-md"
                            : "bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                            isChecked
                              ? "bg-purple-600 border-purple-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          {isChecked ? "✓" : letter}
                        </div>
                        <div className="text-sm pt-0.5 leading-relaxed">
                          <MathRenderer text={opt.text} inline={true} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 5. Short Answer (Isian Singkat) */}
              {currentQuestion.type === "short_answer" && (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ketik Jawaban Isian Singkat Anda:
                  </label>
                  <input
                    type="text"
                    value={String(answers[currentQuestion.id] || "")}
                    onChange={(e) => onRecordAnswer(currentQuestion.id, e.target.value)}
                    placeholder="Tuliskan jawaban singkat Anda di sini..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Jawaban tidak mempermasalahkan huruf besar/kecil (case-insensitive).
                  </p>
                </div>
              )}

              {/* 6. Essay Textarea */}
              {currentQuestion.type === "essay" && (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      rows={7}
                      value={essayDraft}
                      onChange={(e) => handleEssayChange(e.target.value)}
                      onBlur={handleEssayBlur}
                      placeholder="Ketik jawaban essay Anda secara terstruktur dan lengkap di sini..."
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Penilaian otomatis berbasis AI Gemini Engine</span>
                    </span>
                    <span>
                      Panjang karakter:{" "}
                      <strong className="text-slate-200">
                        {String(answers[currentQuestion.id] || "").length}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Question Navigation Controls */}
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-6">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => i - 1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs sm:text-sm flex items-center space-x-1.5 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                Soal {currentIndex + 1} dari {studentQuestions.length}
              </span>

              {currentIndex < studentQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenSubmitConfirm}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Selesai &amp; Kirim</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Webcam Proctor & Question Palette */}
        <div className="lg:col-span-4 space-y-4">
          {/* Webcam AI Proctor Box */}
          <WebcamProctor
            examActive={true}
            studentName={student.name}
            onRecordViolation={onRecordViolation}
          />

          {/* Question Palette Number Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Daftar Nomor Soal
              </h3>
              <span className="text-xs font-bold text-emerald-400">
                {answeredCount}/{studentQuestions.length} Terjawab
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4 px-1">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Terjawab</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Ragu</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                <span>Kosong</span>
              </span>
            </div>

            {/* Numbers grid */}
            <div className="grid grid-cols-5 gap-2">
              {studentQuestions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = isQuestionAnswered(answers[q.id]);
                const isFlagged = flaggedQuestions[q.id];

                let bgClass = "bg-slate-950 border-slate-800 text-slate-400";
                if (isFlagged) {
                  bgClass = "bg-amber-500/20 border-amber-500 text-amber-300";
                } else if (isAnswered) {
                  bgClass = "bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold";
                }

                if (isCurrent) {
                  bgClass += " ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl border flex items-center justify-center text-xs font-bold transition cursor-pointer ${bgClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal (Pencegah Pengiriman Tidak Sengaja) */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start space-x-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  answeredStats.unanswered > 0
                    ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                    : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                }`}
              >
                {answeredStats.unanswered > 0 ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <FileCheck className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Konfirmasi Pengumpulan Ujian
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Periksa ringkasan lembar jawaban Anda sebelum menyelesaikan sesi ini.
                </p>
              </div>
            </div>

            {/* Quick Status Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-2.5">
                <div className="text-[11px] font-semibold text-emerald-400">Terjawab</div>
                <div className="text-lg font-black text-white">
                  {answeredStats.answered}
                  <span className="text-xs font-normal text-slate-400">/{studentQuestions.length}</span>
                </div>
              </div>

              <div
                className={`rounded-xl p-2.5 border ${
                  answeredStats.unanswered > 0
                    ? "bg-rose-950/40 border-rose-500/50 text-rose-300"
                    : "bg-slate-950/80 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-[11px] font-semibold">Belum Dijawab</div>
                <div
                  className={`text-lg font-black ${
                    answeredStats.unanswered > 0 ? "text-rose-400 font-extrabold" : "text-slate-300"
                  }`}
                >
                  {answeredStats.unanswered}
                </div>
              </div>

              <div
                className={`rounded-xl p-2.5 border ${
                  answeredStats.flagged > 0
                    ? "bg-amber-950/40 border-amber-500/50 text-amber-300"
                    : "bg-slate-950/80 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-[11px] font-semibold">Ragu-ragu</div>
                <div
                  className={`text-lg font-black ${
                    answeredStats.flagged > 0 ? "text-amber-400" : "text-slate-300"
                  }`}
                >
                  {answeredStats.flagged}
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                <div className="text-[11px] font-semibold text-cyan-400">Sisa Waktu</div>
                <div className="text-lg font-black text-white font-mono">
                  {formatTime(timeLeftSeconds)}
                </div>
              </div>
            </div>

            {/* Warning when unanswered questions exist */}
            {answeredStats.unanswered > 0 && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Perhatian: Ada {answeredStats.unanswered} soal yang belum Anda jawab!</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  Jawaban yang belum diisi akan bernilai 0. Klik nomor di bawah untuk langsung membuka soal tersebut:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {answeredStats.unansweredIndices.map((qIdx) => (
                    <button
                      key={qIdx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(qIdx);
                        setShowSubmitConfirm(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-400/50 text-rose-200 font-bold text-xs transition cursor-pointer flex items-center space-x-1"
                      title={`Buka soal nomor ${qIdx + 1}`}
                    >
                      <span>No. {qIdx + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Flagged questions note */}
            {answeredStats.flagged > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-amber-300">
                  <Bookmark className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Ada {answeredStats.flagged} butir soal masih ditandai Ragu-ragu:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {answeredStats.flaggedIndices.map((qIdx) => (
                    <button
                      key={qIdx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(qIdx);
                        setShowSubmitConfirm(false);
                      }}
                      className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/50 text-amber-300 text-[11px] font-bold transition cursor-pointer"
                      title={`Buka soal nomor ${qIdx + 1}`}
                    >
                      No. {qIdx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Grading & Submission Notice */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              Setelah dikumpulkan, sesi ujian Anda akan <strong>terkunci secara permanen</strong>. Jawaban essay akan diperiksa dan skor Anda langsung tercatat.
            </div>

            {/* Accidental Click Blocker (Explicit Checkbox) */}
            <label
              onClick={() => setConfirmAgreed((prev) => !prev)}
              className="flex items-start space-x-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer select-none transition"
            >
              <div className="mt-0.5 shrink-0 text-blue-400">
                {confirmAgreed ? (
                  <CheckSquare className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Square className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <span className="text-xs text-slate-200 font-medium leading-snug">
                Saya telah memeriksa kembali seluruh jawaban dan yakin ingin mengumpulkan ujian sekarang.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer order-2 sm:order-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali &amp; Periksa Lagi</span>
              </button>

              <button
                type="button"
                disabled={!confirmAgreed}
                onClick={() => {
                  setShowSubmitConfirm(false);
                  onSubmitExam("Siswa mengonfirmasi selesai ujian via modal konfirmasi");
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer order-1 sm:order-2 ${
                  confirmAgreed
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                    : "bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ya, Kumpulkan Ujian</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grading in progress loading modal */}
      {isGrading && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-black text-white">Penilaian Real-Time AI Gemini</h3>
            <p className="text-xs text-slate-300 mt-2">
              Gemini 3.8 Flash sedang memeriksa rubrik essay dan menghitung total skor secara
              otomatis...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
