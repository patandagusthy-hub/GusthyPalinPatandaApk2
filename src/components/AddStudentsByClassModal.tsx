import React, { useState, useMemo } from "react";
import {
  GraduationCap,
  X,
  Plus,
  Trash2,
  Sparkles,
  ClipboardList,
  Table,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  Check,
  Hash,
  KeyRound,
  UserCheck,
  Loader2,
} from "lucide-react";
import { Student } from "../types";
import { generateUniqueStudentToken } from "../utils/barcodeUtils";

interface AddStudentsByClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingStudents: Student[];
  customClasses?: string[];
  initialSelectedClass?: string;
  onSaveStudents: (newStudents: Student[]) => Promise<void> | void;
}

interface StudentDraft {
  id: string;
  name: string;
  nisn: string;
  username: string;
  password?: string;
}

const AVATAR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316"];

export const AddStudentsByClassModal: React.FC<AddStudentsByClassModalProps> = ({
  isOpen,
  onClose,
  existingStudents,
  customClasses = [],
  initialSelectedClass,
  onSaveStudents,
}) => {
  // Existing unique classes
  const existingClasses = useMemo(() => {
    const set = new Set([
      ...existingStudents.map((s) => (s?.className || "").trim()).filter(Boolean),
      ...(customClasses || []).map((c) => (c || "").trim()).filter(Boolean),
    ]);
    return Array.from(set).sort();
  }, [existingStudents, customClasses]);

  // Class Selection state
  const [classMode, setClassMode] = useState<"existing" | "new">(
    existingClasses.length > 0 ? "existing" : "new"
  );
  const [selectedClass, setSelectedClass] = useState<string>(
    initialSelectedClass || existingClasses[0] || "X RPL 1"
  );
  const [customClassName, setCustomClassName] = useState<string>("");

  React.useEffect(() => {
    if (initialSelectedClass) {
      setClassMode("existing");
      setSelectedClass(initialSelectedClass);
    }
  }, [initialSelectedClass]);

  const targetClass = (classMode === "existing" ? (selectedClass || "") : (customClassName || "")).trim();

  // Input Method tab
  const [inputTab, setInputTab] = useState<"paste" | "manual" | "batch">("paste");

  // Calculate the next safe NISN sequence from existing students so classes don't collide
  const nextSafeNisnStart = useMemo(() => {
    let maxSeq = 1000;
    existingStudents.forEach((s) => {
      const match = (s.nisn || "").match(/\d{4}$/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (!isNaN(val) && val >= maxSeq && val < 9999) {
          maxSeq = val;
        }
      }
    });
    return maxSeq + 1;
  }, [existingStudents]);

  // Tab 1: Paste names state
  const [pastedText, setPastedText] = useState<string>(
    "Ahmad Rizqi Ramadhan\nBudi Pratama\nCitra Kirana Lestari\nDimas Arya Nugraha\nEka Putri Cahyani"
  );
  const [nisnPrefix, setNisnPrefix] = useState<string>("006");
  const [nisnStartNumber, setNisnStartNumber] = useState<number>(nextSafeNisnStart);
  const [usernamePattern, setUsernamePattern] = useState<"name" | "nisn" | "class_num">("name");
  const [defaultPassword, setDefaultPassword] = useState<string>("siswa123");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Tab 2: Manual Rows state
  const [manualRows, setManualRows] = useState<StudentDraft[]>([
    { id: "draft-1", name: "", nisn: "", username: "", password: "siswa123" },
    { id: "draft-2", name: "", nisn: "", username: "", password: "siswa123" },
    { id: "draft-3", name: "", nisn: "", username: "", password: "siswa123" },
  ]);

  // Tab 3: Batch Generator state
  const [batchCount, setBatchCount] = useState<number>(30);
  const [batchNamePrefix, setBatchNamePrefix] = useState<string>("Peserta");
  const [batchNisnStart, setBatchNisnStart] = useState<string>("0071234001");
  const [batchUsernamePrefix, setBatchUsernamePrefix] = useState<string>("user");

  // Generated preview list ready to be committed
  const [stagedStudents, setStagedStudents] = useState<StudentDraft[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setNisnStartNumber(nextSafeNisnStart);
      setSaveErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, nextSafeNisnStart]);

  // Duplicate checks against existing database
  const duplicateNisns = useMemo(() => {
    const existingNisnSet = new Set(
      existingStudents
        .map((s) => (s?.nisn || "").trim().toLowerCase())
        .filter(Boolean)
    );
    return new Set(
      stagedStudents
        .map((s) => (s?.nisn || "").trim().toLowerCase())
        .filter((nisn) => nisn && existingNisnSet.has(nisn))
    );
  }, [existingStudents, stagedStudents]);

  const duplicateUsernames = useMemo(() => {
    const existingUserSet = new Set(
      existingStudents
        .map((s) => (s?.username || "").trim().toLowerCase())
        .filter(Boolean)
    );
    return new Set(
      stagedStudents
        .map((s) => (s?.username || "").trim().toLowerCase())
        .filter((u) => u && existingUserSet.has(u))
    );
  }, [existingStudents, stagedStudents]);

  // Helper to count pending input lines even before staged is generated
  const pendingInputCount = useMemo(() => {
    if (stagedStudents.length > 0) return stagedStudents.length;
    if (inputTab === "paste") {
      return (pastedText || "").split(/\r?\n/).filter((l) => (l || "").trim().length > 0).length;
    }
    if (inputTab === "manual") {
      return manualRows.filter((r) => (r?.name || "").trim().length > 0).length;
    }
    if (inputTab === "batch") {
      return Math.min(Math.max(Number(batchCount) || 1, 1), 100);
    }
    return 0;
  }, [stagedStudents, inputTab, pastedText, manualRows, batchCount]);

  if (!isOpen) return null;

  // Helper to sanitize name for username
  const makeUsernameFromName = (name: string, index: number, className: string): string => {
    const clean = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8);
    const clsClean = className
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5);
    if (!clean) {
      return `${clsClean}_${String(index + 1).padStart(2, "0")}`;
    }
    return `${clean}${String(index + 1).padStart(2, "0")}`;
  };

  // Convert pasted text into staged drafts
  const handleGenerateFromPaste = () => {
    if (!targetClass) {
      alert("Silakan tentukan atau pilih nama kelas terlebih dahulu.");
      return;
    }

    const lines = pastedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      alert("Masukkan minimal satu nama siswa pada kotak teks.");
      return;
    }

    const clsClean = targetClass.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    let curNisnSeq = Number(nisnStartNumber) || 1001;

    const generated: StudentDraft[] = lines.map((line, idx) => {
      // Check if line is CSV formatted: NISN, Name OR Name, NISN
      const parts = line.split(/[,\t|;]/).map((p) => p.trim());
      let name = "";
      let nisn = "";
      let username = "";
      let password = defaultPassword || "siswa123";

      if (parts.length >= 2) {
        // If first part is digits, assume NISN, Name
        if (/^\d{5,}$/.test(parts[0])) {
          nisn = parts[0];
          name = parts[1];
          if (parts[2]) username = parts[2];
          if (parts[3]) password = parts[3];
        } else {
          name = parts[0];
          nisn = parts[1];
          if (parts[2]) username = parts[2];
          if (parts[3]) password = parts[3];
        }
      } else {
        name = line;
      }

      if (!nisn) {
        nisn = `${nisnPrefix}${String(curNisnSeq).padStart(7, "0")}`;
        curNisnSeq++;
      }

      if (!username) {
        if (usernamePattern === "nisn") {
          username = `s_${nisn.slice(-6)}`;
        } else if (usernamePattern === "class_num") {
          username = `${clsClean}_${String(idx + 1).padStart(2, "0")}`;
        } else {
          username = makeUsernameFromName(name, idx, targetClass);
        }
      }

      return {
        id: "draft-" + Date.now() + "-" + idx,
        name,
        nisn,
        username,
        password,
      };
    });

    setStagedStudents(generated);
  };

  // Convert manual table rows to staged drafts
  const handleApplyManualRows = () => {
    if (!targetClass) {
      alert("Silakan tentukan atau pilih nama kelas terlebih dahulu.");
      return;
    }

    const filled = manualRows.filter((r) => (r?.name || "").trim().length > 0);
    if (filled.length === 0) {
      alert("Silakan isi minimal 1 baris nama siswa pada tabel.");
      return;
    }

    let curNisnSeq = Number(nisnStartNumber) || 1001;
    const clsClean = targetClass.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);

    const processed: StudentDraft[] = filled.map((r, idx) => {
      let nisn = (r.nisn || "").trim();
      if (!nisn) {
        nisn = `${nisnPrefix}${String(curNisnSeq).padStart(7, "0")}`;
        curNisnSeq++;
      }
      let username = (r.username || "").trim();
      if (!username) {
        username = makeUsernameFromName((r.name || "").trim(), idx, targetClass);
      }
      return {
        id: "draft-" + Date.now() + "-" + idx,
        name: (r.name || "").trim(),
        nisn,
        username,
        password: (r.password || "").trim() || defaultPassword || "siswa123",
      };
    });

    setStagedStudents(processed);
  };

  // Convert batch generator to staged drafts
  const handleGenerateBatch = () => {
    if (!targetClass) {
      alert("Silakan tentukan atau pilih nama kelas terlebih dahulu.");
      return;
    }

    const count = Math.min(Math.max(Number(batchCount) || 1, 1), 100);
    const startNisnNum = BigInt(batchNisnStart.replace(/\D/g, "") || "0071234001");
    const userPrefixClean = (batchUsernamePrefix || "user").toLowerCase().replace(/[^a-z0-9_]/g, "");

    const generated: StudentDraft[] = [];
    for (let i = 0; i < count; i++) {
      const nisnVal = (startNisnNum + BigInt(i)).toString().padStart(10, "0");
      const numPad = String(i + 1).padStart(2, "0");
      const name = `${batchNamePrefix || "Peserta"} ${targetClass} - ${numPad}`;
      const username = `${userPrefixClean}_${numPad}`;

      generated.push({
        id: "draft-batch-" + Date.now() + "-" + i,
        name,
        nisn: nisnVal,
        username,
        password: defaultPassword || "siswa123",
      });
    }

    setStagedStudents(generated);
  };

  // Helper to extract student drafts from whichever tab is currently active if preview wasn't explicitly generated
  const buildDraftsFromCurrentInput = (): StudentDraft[] => {
    if (stagedStudents.length > 0) return stagedStudents;

    const clsClean = targetClass.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    let curNisnSeq = Number(nisnStartNumber) || nextSafeNisnStart;

    if (inputTab === "paste") {
      const lines = pastedText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) return [];

      return lines.map((line, idx) => {
        const parts = line.split(/[,\t|;]/).map((p) => p.trim());
        let name = "";
        let nisn = "";
        let username = "";
        let password = defaultPassword || "siswa123";

        if (parts.length >= 2) {
          if (/^\d{5,}$/.test(parts[0])) {
            nisn = parts[0];
            name = parts[1];
            if (parts[2]) username = parts[2];
            if (parts[3]) password = parts[3];
          } else {
            name = parts[0];
            nisn = parts[1];
            if (parts[2]) username = parts[2];
            if (parts[3]) password = parts[3];
          }
        } else {
          name = line;
        }

        if (!nisn) {
          nisn = `${nisnPrefix}${String(curNisnSeq).padStart(7, "0")}`;
          curNisnSeq++;
        }

        if (!username) {
          if (usernamePattern === "nisn") {
            username = `s_${nisn.slice(-6)}`;
          } else if (usernamePattern === "class_num") {
            username = `${clsClean}_${String(idx + 1).padStart(2, "0")}`;
          } else {
            username = makeUsernameFromName(name, idx, targetClass);
          }
        }

        return {
          id: "draft-" + Date.now() + "-" + idx,
          name,
          nisn,
          username,
          password,
        };
      });
    }

    if (inputTab === "manual") {
      const filled = manualRows.filter((r) => (r?.name || "").trim().length > 0);
      return filled.map((r, idx) => {
        let nisn = (r.nisn || "").trim();
        if (!nisn) {
          nisn = `${nisnPrefix}${String(curNisnSeq).padStart(7, "0")}`;
          curNisnSeq++;
        }
        let username = (r.username || "").trim();
        if (!username) {
          username = makeUsernameFromName((r.name || "").trim(), idx, targetClass);
        }
        return {
          id: "draft-" + Date.now() + "-" + idx,
          name: (r.name || "").trim(),
          nisn,
          username,
          password: (r.password || "").trim() || defaultPassword || "siswa123",
        };
      });
    }

    if (inputTab === "batch") {
      const count = Math.min(Math.max(Number(batchCount) || 1, 1), 100);
      const startNisnNum = BigInt(batchNisnStart.replace(/\D/g, "") || "0071234001");
      const userPrefixClean = (batchUsernamePrefix || "user").toLowerCase().replace(/[^a-z0-9_]/g, "");

      const generated: StudentDraft[] = [];
      for (let i = 0; i < count; i++) {
        const nisnVal = (startNisnNum + BigInt(i)).toString().padStart(10, "0");
        const numPad = String(i + 1).padStart(2, "0");
        const name = `${batchNamePrefix || "Peserta"} ${targetClass} - ${numPad}`;
        const username = `${userPrefixClean}_${numPad}`;

        generated.push({
          id: "draft-batch-" + Date.now() + "-" + i,
          name,
          nisn: nisnVal,
          username,
          password: defaultPassword || "siswa123",
        });
      }
      return generated;
    }

    return [];
  };

  // Final Commit to Store
  const handleFinalSave = async () => {
    if (!targetClass) {
      setSaveErrorMessage("Nama kelas tidak boleh kosong. Silakan pilih atau tentukan kelas.");
      return;
    }

    let draftsToSave = stagedStudents;
    if (draftsToSave.length === 0) {
      draftsToSave = buildDraftsFromCurrentInput();
    }

    if (draftsToSave.length === 0) {
      setSaveErrorMessage("Tidak ada data siswa untuk disimpan. Isi nama siswa pada tab terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage(null);

    try {
      // Build actual Student objects
      const newStudents: Student[] = draftsToSave.map((draft, idx) => {
        const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
        const studentId = "std-" + Date.now() + "-" + idx + "-" + Math.random().toString(36).slice(2, 6);
        return {
          id: studentId,
          name: draft.name,
          nisn: draft.nisn,
          className: targetClass,
          username: draft.username,
          password: draft.password || defaultPassword || "siswa123",
          role: "siswa" as const,
          loginCount: 0,
          isLocked: false,
          examStatus: "not_started" as const,
          startBarcodeToken: generateUniqueStudentToken(targetClass, draft.nisn, studentId),
          mcqScore: 0,
          essayScore: 0,
          totalScore: 0,
          violationsCount: 0,
          violationsLog: [],
          answers: {},
          avatarColor: color,
          isSample: false, // Explicit real student created by admin
        };
      });

      await onSaveStudents(newStudents);
      setIsSaving(false);
      onClose();
    } catch (err: any) {
      console.error("Error saving students:", err);
      setSaveErrorMessage("Gagal menyimpan data siswa: " + (err?.message || "Terjadi kesalahan sistem"));
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-black text-white">Tambah Siswa Per Kelas</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Massal Rombel
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Daftarkan siswa secara massal untuk kelas tertentu dengan penomoran NISN &amp; Akun otomatis.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 space-y-5 flex-1">
          {/* STEP 1: Pilih / Tentukan Kelas */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>1. Tentukan Kelas / Rombongan Belajar Target</span>
              </label>
              {targetClass && (
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Target: {targetClass}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Pilih Kelas Yang Ada */}
              <div
                onClick={() => setClassMode("existing")}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  classMode === "existing"
                    ? "bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <input
                      type="radio"
                      checked={classMode === "existing"}
                      onChange={() => setClassMode("existing")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Pilih Dari Kelas Yang Ada</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {existingClasses.length} kelas terdaftar
                  </span>
                </div>

                {existingClasses.length > 0 ? (
                  <select
                    disabled={classMode !== "existing"}
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {existingClasses.map((cls) => {
                      const count = existingStudents.filter((s) => s.className === cls).length;
                      return (
                        <option key={cls} value={cls}>
                          {cls} ({count} siswa aktif)
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">Belum ada data kelas terdaftar.</p>
                )}
              </div>

              {/* Option B: Buat Kelas Baru */}
              <div
                onClick={() => setClassMode("new")}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  classMode === "new"
                    ? "bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <input
                      type="radio"
                      checked={classMode === "new"}
                      onChange={() => setClassMode("new")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Input Nama Kelas Baru</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Ketik bebas</span>
                </div>

                <input
                  type="text"
                  disabled={classMode !== "new"}
                  value={customClassName}
                  onChange={(e) => setCustomClassName(e.target.value)}
                  placeholder="Contoh: XII TKJ 2 atau X MIPA 1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {["X RPL 1", "XI RPL 1", "XII RPL 1", "X TKJ 1", "XI TKJ 1", "XII TKJ 1"].map((sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      disabled={classMode !== "new"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClassMode("new");
                        setCustomClassName(sugg);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Metode Input Data Siswa */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                <span>2. Pilih Metode Input Siswa</span>
              </label>

              {/* Input Method Buttons */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setInputTab("paste")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                    inputTab === "paste"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Tempel Daftar Nama</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab("manual")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                    inputTab === "manual"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Tabel Input Baris</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab("batch")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                    inputTab === "batch"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Akun Kilat Ujian</span>
                </button>
              </div>
            </div>

            {/* Global Settings: Password Seragam & NISN Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Password Seragam Siswa
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="siswa123"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 pr-8 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Awalan NISN Otomatis
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={nisnPrefix}
                    onChange={(e) => setNisnPrefix(e.target.value)}
                    placeholder="006"
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center"
                    title="Prefix tahun NISN (3 digit)"
                  />
                  <input
                    type="number"
                    value={nisnStartNumber}
                    onChange={(e) => setNisnStartNumber(Number(e.target.value))}
                    placeholder="1001"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    title="Nomor urut mulai"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Format Username Otomatis
                </label>
                <select
                  value={usernamePattern}
                  onChange={(e) => setUsernamePattern(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="name">Dari Nama Siswa (cth: ahmad01)</option>
                  <option value="nisn">Dari NISN Siswa (cth: s_123456)</option>
                  <option value="class_num">Dari Nama Kelas (cth: rpl1_01)</option>
                </select>
              </div>
            </div>

            {/* TAB 1: Tempel Daftar Nama */}
            {inputTab === "paste" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Tempel daftar nama siswa di bawah (1 nama per baris, atau format{" "}
                    <code className="text-indigo-300 font-mono">NISN, Nama</code>):
                  </span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {pastedText.split(/\r?\n/).filter((l) => l.trim()).length} Baris Terdeteksi
                  </span>
                </div>

                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={"Contoh:\nAhmad Rizqi Ramadhan\nBudi Pratama\nCitra Kirana Lestari\n...atau:\n0061234001, Doni Saputra"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-400">
                    💡 Tips: Anda dapat langsung menyalin kolom nama dari Excel atau daftar absensi kelas.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateFromPaste}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Terapkan ke Pratinjau Siswa</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Tabel Input Baris Manual */}
            {inputTab === "manual" && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-2.5 w-10 text-center">No</th>
                        <th className="p-2.5">Nama Lengkap Siswa</th>
                        <th className="p-2.5 w-32">NISN (Opsional)</th>
                        <th className="p-2.5 w-32">Username</th>
                        <th className="p-2.5 w-28">Password</th>
                        <th className="p-2.5 w-10 text-center">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {manualRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-900/50">
                          <td className="p-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, name: val } : r))
                                );
                              }}
                              placeholder="Nama Siswa..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.nisn}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, nisn: val } : r))
                                );
                              }}
                              placeholder="Auto generate"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.username}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, username: val } : r))
                                );
                              }}
                              placeholder="Auto generate"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.password || "siswa123"}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, password: val } : r))
                                );
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setManualRows((prev) => prev.filter((r) => r.id !== row.id));
                              }}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Hapus baris ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setManualRows((prev) => [
                          ...prev,
                          {
                            id: "draft-" + Date.now() + "-" + prev.length,
                            name: "",
                            nisn: "",
                            username: "",
                            password: defaultPassword || "siswa123",
                          },
                        ]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+1 Baris</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newRows: StudentDraft[] = [];
                        for (let i = 0; i < 5; i++) {
                          newRows.push({
                            id: "draft-" + Date.now() + "-" + i,
                            name: "",
                            nisn: "",
                            username: "",
                            password: defaultPassword || "siswa123",
                          });
                        }
                        setManualRows((prev) => [...prev, ...newRows]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                    >
                      +5 Baris
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualRows([
                          { id: "draft-1", name: "", nisn: "", username: "", password: "siswa123" },
                          { id: "draft-2", name: "", nisn: "", username: "", password: "siswa123" },
                        ]);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 text-xs"
                    >
                      Reset Baris
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyManualRows}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Terapkan ke Pratinjau Siswa</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Batch Generator Akun Kilat */}
            {inputTab === "batch" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Buat akun bernomor secara instan untuk simulasi atau jika nama siswa asli belum tersedia.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Jumlah Siswa (1 - 100)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={batchCount}
                      onChange={(e) => setBatchCount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Awalan Nama Siswa
                    </label>
                    <input
                      type="text"
                      value={batchNamePrefix}
                      onChange={(e) => setBatchNamePrefix(e.target.value)}
                      placeholder="Peserta / Siswa"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      NISN Mulai (10 Digit)
                    </label>
                    <input
                      type="text"
                      value={batchNisnStart}
                      onChange={(e) => setBatchNisnStart(e.target.value)}
                      placeholder="0071234001"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Awalan Username
                    </label>
                    <input
                      type="text"
                      value={batchUsernamePrefix}
                      onChange={(e) => setBatchUsernamePrefix(e.target.value)}
                      placeholder="user"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleGenerateBatch}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate {batchCount} Akun Kelas {targetClass || "..."}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: Pratinjau Siswa Yang Akan Disimpan */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>3. Pratinjau Siswa Siap Disimpan</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Periksa data siswa yang akan dimasukkan ke Kelas{" "}
                  <strong className="text-white">{targetClass || "(Belum dipilih)"}</strong>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {stagedStudents.length} Siswa Siap Disimpan
                </span>
                {stagedStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStagedStudents([])}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                    title="Kosongkan pratinjau"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Warning if duplicates exist */}
            {(duplicateNisns.size > 0 || duplicateUsernames.size > 0) && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Peringatan Duplikasi Ditemukan:</p>
                  {duplicateNisns.size > 0 && (
                    <p className="text-[11px] text-amber-300">
                      &bull; {duplicateNisns.size} NISN sudah digunakan oleh siswa lain di database.
                    </p>
                  )}
                  {duplicateUsernames.size > 0 && (
                    <p className="text-[11px] text-amber-300">
                      &bull; {duplicateUsernames.size} Username sudah terdaftar di database.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Table of Staged Students */}
            {stagedStudents.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold">
                  Belum ada siswa dalam pratinjau.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tempel daftar nama pada tab di atas lalu klik tombol "Terapkan ke Pratinjau Siswa".
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5">Kelas</th>
                      <th className="p-2.5">NISN</th>
                      <th className="p-2.5">Username</th>
                      <th className="p-2.5">Password</th>
                      <th className="p-2.5">Token Barcode</th>
                      <th className="p-2.5 w-10 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                    {stagedStudents.map((st, idx) => {
                      const isDupNisn = duplicateNisns.has(st.nisn.toLowerCase());
                      const isDupUser = duplicateUsernames.has(st.username.toLowerCase());

                      return (
                        <tr key={st.id} className="hover:bg-slate-800/50">
                          <td className="p-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-200">{st.name}</td>
                          <td className="p-2 text-indigo-300 font-semibold">{targetClass}</td>
                          <td className="p-2 font-mono">
                            <span
                              className={
                                isDupNisn
                                  ? "text-rose-400 font-bold underline"
                                  : "text-slate-300"
                              }
                            >
                              {st.nisn}
                            </span>
                            {isDupNisn && (
                              <span className="ml-1 text-[10px] text-rose-400">(Duplikat)</span>
                            )}
                          </td>
                          <td className="p-2 font-mono">
                            <span
                              className={
                                isDupUser
                                  ? "text-amber-400 font-bold"
                                  : "text-slate-300"
                              }
                            >
                              {st.username}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-slate-400">{st.password || "siswa123"}</td>
                          <td className="p-2">
                            <span className="font-mono text-[10px] text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-cyan-500/20">
                              GPP-{st.nisn}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setStagedStudents((prev) => prev.filter((item) => item.id !== st.id));
                              }}
                              className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                              title="Hapus baris ini dari pratinjau"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800 pt-4 flex-shrink-0">
          <div className="text-xs text-slate-400">
            {saveErrorMessage ? (
              <span className="text-rose-400 font-semibold flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 inline mr-1" />
                <span>{saveErrorMessage}</span>
              </span>
            ) : pendingInputCount > 0 ? (
              <span>
                Total <strong className="text-white">{pendingInputCount} siswa</strong> akan didaftarkan dan disimpan ke{" "}
                <strong className="text-indigo-400">{targetClass || "kelas"}</strong>
              </span>
            ) : (
              <span>Ketik atau tempel nama siswa pada kolom input di atas untuk menyimpan.</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={pendingInputCount === 0 || !targetClass || isSaving}
              onClick={handleFinalSave}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center space-x-2 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Database...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Simpan {pendingInputCount > 0 ? `${pendingInputCount} Siswa` : "Siswa"} ke {targetClass || "Kelas"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
