import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  Trophy,
  Play,
  RotateCcw,
  Volume2,
  Sparkles,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  Edit2,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Student, ExamConfig, Question, isExamClassActive } from "../types";

interface DuckRaceLiveProps {
  students: Student[];
  config?: ExamConfig;
  questions?: Question[];
  onClose?: () => void;
  onUpdateExamConfig?: (updates: Partial<ExamConfig>) => void;
}

export const DuckRaceLive: React.FC<DuckRaceLiveProps> = ({
  students,
  config,
  questions,
  onClose,
  onUpdateExamConfig,
}) => {
  const kkm = config?.passingScore ?? 75;
  const [showKkmModal, setShowKkmModal] = useState(false);
  const [editingKkm, setEditingKkm] = useState(kkm);

  useEffect(() => {
    if (config?.passingScore !== undefined) {
      setEditingKkm(config.passingScore);
    }
  }, [config?.passingScore]);

  const handleSaveKkm = (val: number) => {
    const valid = Math.max(0, Math.min(100, Math.round(val)));
    if (onUpdateExamConfig) {
      onUpdateExamConfig({ passingScore: valid });
    }
    setShowKkmModal(false);
  };
  // Participant filter mode:
  // "active_exam": Siswa dari rombel/kelas yang aktif di sesi ujian ini (default)
  // "in_exam": Hanya siswa yang sedang/telah mengerjakan ujian (in_progress, submitted, completed)
  // "all": Semua siswa terdaftar
  const [participantScope, setParticipantScope] = useState<"active_exam" | "in_exam" | "all">("active_exam");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [simulatedProgress, setSimulatedProgress] = useState<Record<string, number>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [displayMode, setDisplayMode] = useState<"top20" | "top50" | "all">("top20");
  const [duckSearch, setDuckSearch] = useState<string>("");

  // Extract all unique classes
  const allClasses = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort();
  }, [students]);

  // Active classes based on config
  const activeClassesList = useMemo(() => {
    if (!config) return allClasses;
    return allClasses.filter((c) => isExamClassActive(config, c));
  }, [allClasses, config]);

  // Calculate position: real score, live interim answer score, or simulated progress
  const getDuckScore = (s: Student): number => {
    if (simulatedProgress[s.id] !== undefined) {
      return simulatedProgress[s.id];
    }
    if (typeof s.totalScore === "number" && s.totalScore > 0) {
      return s.totalScore;
    }
    // Calculate live interim score if taking exam
    if (s.answers && Object.keys(s.answers).length > 0 && questions && questions.length > 0) {
      let liveMcqScore = 0;
      let liveMcqMax = 0;
      questions.forEach((q) => {
        if (q.type === "mcq") {
          liveMcqMax += q.points;
          const ans = s.answers?.[q.id];
          if (
            ans !== undefined &&
            q.correctAnswer &&
            String(ans).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
          ) {
            liveMcqScore += q.points;
          }
        }
      });
      if (liveMcqMax > 0) {
        return Math.min(100, Math.round((liveMcqScore / liveMcqMax) * 100));
      }
    }
    return s.totalScore || 0;
  };

  // 1. Filter students according to participantScope (Synchronized with active exam)
  const scopedStudents = useMemo(() => {
    return students.filter((s) => {
      if (participantScope === "active_exam") {
        if (config && !isExamClassActive(config, s.className)) {
          return false;
        }
        return true;
      }
      if (participantScope === "in_exam") {
        const isClassActive = !config || isExamClassActive(config, s.className);
        const hasStarted =
          s.examStatus === "in_progress" ||
          s.examStatus === "submitted" ||
          s.loginCount > 0 ||
          (s.answers && Object.keys(s.answers).length > 0);
        return isClassActive && hasStarted;
      }
      return true; // "all"
    });
  }, [students, config, participantScope]);

  // 2. Filter by class and search keyword
  const baseFiltered = useMemo(() => {
    return scopedStudents.filter((s) => {
      const matchClass =
        selectedClass === "all" ||
        (s?.className || "").trim().toLowerCase() === (selectedClass || "").trim().toLowerCase();
      const matchSearch =
        !(duckSearch || "").trim() ||
        (s?.name || "").toLowerCase().includes((duckSearch || "").trim().toLowerCase()) ||
        (s?.nisn || "").includes((duckSearch || "").trim());
      return matchClass && matchSearch;
    });
  }, [scopedStudents, selectedClass, duckSearch]);

  // Sort students by score descending for podium and leaderboard
  const sortedStudents = useMemo(() => {
    return [...baseFiltered].sort((a, b) => getDuckScore(b) - getDuckScore(a));
  }, [baseFiltered, simulatedProgress]);

  // Display limit for high performance rendering
  const displayedStudents = useMemo(() => {
    if (displayMode === "top20") return sortedStudents.slice(0, 20);
    if (displayMode === "top50") return sortedStudents.slice(0, 50);
    return sortedStudents.slice(0, 100);
  }, [sortedStudents, displayMode]);

  // Participant statistics
  const stats = useMemo(() => {
    const total = scopedStudents.length;
    let inProgress = 0;
    let completed = 0;
    let notStarted = 0;
    scopedStudents.forEach((s) => {
      if (s.examStatus === "submitted") {
        completed++;
      } else if (s.examStatus === "in_progress" || (s.loginCount > 0 && s.examStatus !== "disqualified")) {
        inProgress++;
      } else {
        notStarted++;
      }
    });
    return { total, inProgress, completed, notStarted };
  }, [scopedStudents]);

  // Trigger confetti when someone hits 100
  useEffect(() => {
    const hasWinner = sortedStudents.some((s) => getDuckScore(s) >= 100);
    if (hasWinner) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [simulatedProgress, sortedStudents]);

  // Simulation test mode: randomly nudge scores forward
  useEffect(() => {
    let timer: any;
    if (isSimulating) {
      timer = setInterval(() => {
        setSimulatedProgress((prev) => {
          const next = { ...prev };
          let changed = false;
          baseFiltered.forEach((s) => {
            const current = next[s.id] ?? s.totalScore;
            if (current < 100) {
              const boost = Math.floor(Math.random() * 8) + 2;
              next[s.id] = Math.min(100, current + boost);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isSimulating, baseFiltered]);

  const handleResetSimulation = () => {
    setIsSimulating(false);
    setSimulatedProgress({});
  };

  return (
    <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl p-4 sm:p-6 overflow-hidden">
      {/* Top Controls & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 shrink-0">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Duck Race Live Scoreboard
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wide flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1" />
                Live Visualizer
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Balapan Bebek Real-time Berdasarkan Perolehan Skor Peserta Ujian Aktif
            </p>
          </div>
        </div>

        {/* Real-time Status Pills & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Simulation toggle */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
              isSimulating
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 animate-pulse"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isSimulating ? "Simulasi Aktif" : "Uji Balapan (Simulasi)"}</span>
          </button>

          {Object.keys(simulatedProgress).length > 0 && (
            <button
              onClick={handleResetSimulation}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Reset ke perolehan nilai asli"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Tutup
            </button>
          )}
        </div>
      </div>

      {/* Synchronized Participant Status Info Bar */}
      <div className="mt-4 p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-400">Lingkup Peserta:</span>
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setParticipantScope("active_exam")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                participantScope === "active_exam"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ✓ Peserta Ujian Aktif ({config?.activeClasses?.length && !config.allClassesActive ? config.activeClasses.join(", ") : "Semua Kelas"})
            </button>
            <button
              onClick={() => setParticipantScope("in_exam")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                participantScope === "in_exam"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚡ Sedang / Selesai Ujian
            </button>
            <button
              onClick={() => setParticipantScope("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                participantScope === "all"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Seluruh Siswa ({students.length})
            </button>
          </div>
        </div>

        {/* Real-time counters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Peserta: <strong className="text-white font-mono">{stats.total}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
            <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Mengerjakan: <strong className="text-white font-mono">{stats.inProgress}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-800/40 text-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Selesai: <strong className="text-white font-mono">{stats.completed}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Cari siswa di balapan..."
            value={duckSearch}
            onChange={(e) => setDuckSearch(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-44"
          />

          {/* Class Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">
                {participantScope === "active_exam" ? "Semua Kelas Aktif Ujian" : "Semua Kelas"}
              </option>
              {allClasses.map((c) => {
                const isActive = config ? isExamClassActive(config, c) : true;
                return (
                  <option key={c} value={c} className="bg-slate-900">
                    {c} {isActive ? "(✓ Aktif Ujian)" : "(Nonaktif)"}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Display Mode (Anti-Lag) */}
          <div className="flex items-center space-x-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Tampil:</span>
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as any)}
              className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value="top20" className="bg-slate-900">Top 20 Pemimpin</option>
              <option value="top50" className="bg-slate-900">Top 50 Pemimpin</option>
              <option value="all" className="bg-slate-900">Semua (Maks 100)</option>
            </select>
          </div>

          {/* KKM Badge with Quick Edit */}
          <div className="flex items-center space-x-1.5 bg-amber-950/40 border border-amber-500/40 px-2.5 py-1 rounded-xl text-xs">
            <span className="text-amber-300/80 font-medium">KKM:</span>
            <span className="font-mono font-black text-amber-300">{kkm}</span>
            {onUpdateExamConfig && (
              <button
                type="button"
                onClick={() => {
                  setEditingKkm(kkm);
                  setShowKkmModal(true);
                }}
                className="p-1 hover:bg-amber-500/20 rounded text-amber-400 transition cursor-pointer"
                title="Ubah nilai KKM ujian"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Menampilkan <strong className="text-slate-200">{displayedStudents.length}</strong> dari <strong className="text-slate-200">{baseFiltered.length}</strong> peserta</span>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-3 gap-3 my-5">
        {/* 2nd Place */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center flex flex-col items-center justify-center relative overflow-hidden">
          <span className="text-xl">🥈</span>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">Juara 2</p>
          <p className="text-xs sm:text-sm font-extrabold text-slate-200 truncate w-full mt-0.5">
            {sortedStudents[1]?.name || "-"}
          </p>
          <p className="text-[10px] text-slate-500">{sortedStudents[1]?.className || ""}</p>
          <span className="mt-1 font-mono text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
            {sortedStudents[1] ? `${getDuckScore(sortedStudents[1])} Poin` : "-"}
          </span>
        </div>

        {/* 1st Place */}
        <div className="bg-gradient-to-b from-amber-500/20 to-slate-900 border border-amber-500/40 rounded-xl p-3.5 text-center flex flex-col items-center justify-center relative shadow-lg shadow-amber-500/10">
          <span className="text-2xl animate-bounce">👑 🥇</span>
          <p className="text-[10px] text-amber-300 uppercase font-bold tracking-wider mt-1">Pemimpin Balapan</p>
          <p className="text-xs sm:text-sm font-black text-amber-100 truncate w-full mt-0.5">
            {sortedStudents[0]?.name || "-"}
          </p>
          <p className="text-[10px] text-amber-400/80">{sortedStudents[0]?.className || ""}</p>
          <span className="mt-1 font-mono text-xs font-black text-amber-300 bg-amber-950/80 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
            {sortedStudents[0] ? `${getDuckScore(sortedStudents[0])} Poin` : "-"}
          </span>
        </div>

        {/* 3rd Place */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center flex flex-col items-center justify-center relative overflow-hidden">
          <span className="text-xl">🥉</span>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">Juara 3</p>
          <p className="text-xs sm:text-sm font-extrabold text-slate-200 truncate w-full mt-0.5">
            {sortedStudents[2]?.name || "-"}
          </p>
          <p className="text-[10px] text-slate-500">{sortedStudents[2]?.className || ""}</p>
          <span className="mt-1 font-mono text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
            {sortedStudents[2] ? `${getDuckScore(sortedStudents[2])} Poin` : "-"}
          </span>
        </div>
      </div>

      {/* The Water Race Track */}
      <div className="bg-gradient-to-b from-blue-950/70 via-cyan-950/50 to-blue-950/80 border border-cyan-800/40 rounded-2xl p-4 relative overflow-x-auto shadow-inner">
        {/* Track header distance indicators */}
        <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400/80 px-2 pb-2 border-b border-cyan-900/50 mb-3 min-w-[700px] relative">
          <span>🚩 START LINE (0 Poin)</span>
          <span>🌊 25%</span>
          <span>⚡ 50%</span>
          <span className="text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/50">
            🎯 KKM: {kkm} Poin
          </span>
          <span className="text-amber-400 font-bold">🏁 FINISH LINE (100 Poin)</span>
        </div>

        {displayedStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Tidak ada peserta ujian yang cocok dengan filter yang dipilih.
          </div>
        ) : (
          /* Lanes */
          <div className="space-y-3 min-w-[700px]">
            {displayedStudents.map((student) => {
              const score = getDuckScore(student);
              // Percentage from 0% to 100%
              const progressPercent = Math.min(100, Math.max(0, score));
              const duckColor = student.avatarColor || "#facc15";
              const rank = sortedStudents.findIndex((s) => s.id === student.id) + 1;
              const offsetPx = (progressPercent / 100) * 44;

              // Student exam status indicator
              const isFinished = student.examStatus === "submitted";
              const isInProgress = student.examStatus === "in_progress" || (student.loginCount > 0 && !isFinished);
              const isDisqualified = student.examStatus === "disqualified";

              return (
                <div
                  key={student.id}
                  className="bg-slate-950/70 border border-cyan-900/40 rounded-xl p-2.5 flex items-center gap-3 relative overflow-hidden group hover:border-cyan-500/40 transition"
                >
                  {/* Lane Info badge */}
                  <div className="w-44 shrink-0 flex items-center space-x-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        rank === 1
                          ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40"
                          : rank === 2
                          ? "bg-slate-300 text-slate-950"
                          : rank === 3
                          ? "bg-amber-700 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-200 truncate">{student.name}</p>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-slate-400">{student.className}</span>
                        {isFinished ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/60 font-semibold">
                            Selesai
                          </span>
                        ) : isInProgress ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold animate-pulse">
                            Ujian Aktif
                          </span>
                        ) : isDisqualified ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/60 font-semibold">
                            Terkunci
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-500 font-medium">
                            Belum Mulai
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Swimming Water Track with Animated Duck Facing Right */}
                  <div className="flex-1 relative h-10 bg-blue-950/40 rounded-lg border border-cyan-900/30 overflow-hidden flex items-center">
                    {/* Subtle water ripples */}
                    <div className="absolute inset-0 bg-[radial-gradient(#0891b2_1px,transparent_1px)] [background-size:12px_12px] opacity-20 pointer-events-none" />

                    {/* Water wake line behind duck (trailing from left/start to duck) */}
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-cyan-400/60 rounded-full transition-all duration-700"
                      style={{ width: `${progressPercent}%` }}
                    />

                    {/* The Swimming Duck Container Moving from Left to Right */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out flex items-center"
                      style={{
                        left: `calc(${progressPercent}% - ${offsetPx}px)`,
                      }}
                    >
                      {/* Splash particles trailing behind duck's tail on the left */}
                      <span className="text-[10px] text-cyan-300 opacity-75 mr-0.5 animate-pulse select-none">
                        💦
                      </span>

                      {/* Duck Body SVG: Mathematically transformed so it FACES RIGHT towards the FINISH LINE */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110"
                        style={{
                          animation: "bounce 1.2s infinite ease-in-out",
                        }}
                      >
                        <svg
                          viewBox="0 0 64 64"
                          className="w-8 h-8"
                          style={{ filter: `drop-shadow(0 0 4px ${duckColor})` }}
                        >
                          {/* Horizontally mirrored group so duck faces RIGHT towards 100% Finish Line */}
                          <g transform="translate(64, 0) scale(-1, 1)">
                            {/* Body */}
                            <path
                              d="M 16 38 C 16 48 30 52 44 50 C 52 48 58 40 54 32 C 50 26 42 28 38 28 C 36 28 34 22 30 18 C 24 14 16 18 16 26 C 16 30 18 34 16 38 Z"
                              fill={duckColor}
                            />
                            {/* Wing */}
                            <path
                              d="M 32 38 C 32 44 42 46 48 42 C 48 36 40 34 32 38 Z"
                              fill="#ffffff"
                              fillOpacity="0.25"
                            />
                            {/* Eye */}
                            <circle cx="24" cy="22" r="3" fill="#0f172a" />
                            <circle cx="23" cy="21" r="1" fill="#ffffff" />
                            {/* Beak */}
                            <path
                              d="M 16 24 C 10 24 6 27 10 30 C 14 31 16 28 16 24 Z"
                              fill="#ea580c"
                            />
                          </g>
                        </svg>
                      </div>
                    </div>

                    {/* KKM Passing Line Indicator */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 border-r border-dashed border-amber-400/50 pointer-events-none z-10"
                      style={{ left: `${Math.min(98, Math.max(2, kkm))}%` }}
                      title={`Batas Kelulusan KKM: ${kkm} Poin`}
                    />

                    {/* Finish Line Indicator */}
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-b from-red-500 via-white to-red-500 opacity-60 pointer-events-none" />
                  </div>

                  {/* Score Pill */}
                  <div className="w-16 shrink-0 text-right">
                    <span
                      className={`font-mono text-xs font-black px-2 py-1 rounded-md border ${
                        score >= kkm
                          ? "text-emerald-300 bg-emerald-950/80 border-emerald-700/60"
                          : "text-cyan-300 bg-cyan-950 border-cyan-800/60"
                      }`}
                      title={score >= kkm ? `Lulus KKM (≥ ${kkm})` : `Belum Tuntas (< ${kkm})`}
                    >
                      {score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit KKM Modal inside Duck Race */}
      {showKkmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Ubah KKM Ujian</h3>
                <p className="text-xs text-slate-400">Batas nilai minimal kelulusan siswa</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nilai KKM (0 - 100)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingKkm}
                    onChange={(e) => setEditingKkm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-2.5 text-2xl font-black font-mono text-amber-300 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    Poin
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Preset Cepat:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[60, 65, 70, 75, 80, 85, 90].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditingKkm(val)}
                      className={`py-1 rounded-xl font-mono text-xs font-bold transition border cursor-pointer ${
                        editingKkm === val
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKkmModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveKkm(editingKkm)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan KKM</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

