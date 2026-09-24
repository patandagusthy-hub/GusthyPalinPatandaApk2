import React, { useState } from "react";
import {
  GraduationCap,
  X,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Users,
  Layers,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Student } from "../types";

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingStudents: Student[];
  customClasses: string[];
  onAddClasses: (newClasses: string[], openStudentModalForClass?: string) => void;
  onDeleteCustomClass?: (className: string) => void;
  onDeleteClass?: (className: string, deleteStudents: boolean) => void;
}

export const AddClassModal: React.FC<AddClassModalProps> = ({
  isOpen,
  onClose,
  existingStudents,
  customClasses,
  onAddClasses,
  onDeleteCustomClass,
  onDeleteClass,
}) => {
  const [singleClassName, setSingleClassName] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [classToDelete, setClassToDelete] = useState<{
    name: string;
    studentCount: number;
  } | null>(null);

  if (!isOpen) return null;

  // All currently active classes from students + customClasses
  const allClasses = Array.from(
    new Set([
      ...existingStudents.map((s) => (s?.className || "").trim()).filter(Boolean),
      ...(customClasses || []).map((c) => (c || "").trim()).filter(Boolean),
    ])
  ).sort();

  const handleConfirmDeleteClass = () => {
    if (!classToDelete) return;
    const target = classToDelete.name;
    const hasStudents = classToDelete.studentCount > 0;

    if (onDeleteClass) {
      onDeleteClass(target, hasStudents);
    } else if (onDeleteCustomClass) {
      onDeleteCustomClass(target);
    }
    setClassToDelete(null);
  };

  const handleSaveSingle = (andOpenStudents = false) => {
    const trimmed = singleClassName.trim();
    if (!trimmed) {
      setErrorMsg("Harap masukkan nama kelas terlebih dahulu (contoh: X TKJ 1, XII MIPA 2).");
      return;
    }

    if (allClasses.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Kelas "${trimmed}" sudah terdaftar sebelumnya.`);
      return;
    }

    setErrorMsg(null);
    onAddClasses([trimmed], andOpenStudents ? trimmed : undefined);
    setSingleClassName("");
    if (!andOpenStudents) {
      onClose();
    }
  };

  const handleSaveBulk = () => {
    const lines = bulkInput
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setErrorMsg("Harap masukkan minimal satu nama kelas.");
      return;
    }

    const uniqueNew = lines.filter(
      (c) => !allClasses.some((ac) => ac.toLowerCase() === c.toLowerCase())
    );

    if (uniqueNew.length === 0) {
      setErrorMsg("Semua nama kelas yang dimasukkan sudah ada dalam daftar.");
      return;
    }

    setErrorMsg(null);
    onAddClasses(uniqueNew);
    setBulkInput("");
    onClose();
  };

  const quickPresets = [
    "X RPL 1",
    "X TKJ 1",
    "X AKL 1",
    "XI RPL 1",
    "XI TKJ 1",
    "XII RPL 1",
    "XII TKJ 1",
    "XII MIPA 1",
    "XII IPS 1",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Kelola &amp; Tambah Kelas / Rombel
              </h3>
              <p className="text-xs text-slate-400">
                Daftarkan rombel baru atau hapus kelas yang sudah tidak digunakan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode("single");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                mode === "single"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Satu Kelas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("bulk");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                mode === "bulk"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Banyak Kelas Sekaligus</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {mode === "single" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nama Kelas / Rombel Baru
                </label>
                <input
                  type="text"
                  value={singleClassName}
                  onChange={(e) => {
                    setSingleClassName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveSingle(false);
                    }
                  }}
                  placeholder="Contoh: X TKJ 2, XI RPL 1, VII A, XII MIPA 3..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Preset Cepat (Klik untuk memilih):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSingleClassName(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Daftar Nama Kelas (Pisahkan per baris atau tanda koma)
                </label>
                <textarea
                  value={bulkInput}
                  onChange={(e) => {
                    setBulkInput(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  rows={4}
                  placeholder={`X RPL 1\nX RPL 2\nXI TKJ 1\nXI TKJ 2\nXII AKL 1`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Tips: Anda dapat menyalin daftar rombel dari file Excel atau data dapodik lalu tempel di sini.
              </p>
            </div>
          )}

          {/* List of currently registered classes */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Daftar Kelas Terdaftar Saat Ini ({allClasses.length})</span>
              </label>
              <span className="text-[10px] text-slate-500">
                Klik ikon sampah untuk menghapus kelas
              </span>
            </div>

            {/* In-modal confirmation alert for deleting class */}
            {classToDelete && (
              <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-600/60 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-rose-200">
                      Hapus Kelas &quot;{classToDelete.name}&quot;?
                    </p>
                    <p className="text-rose-300/80 text-[11px] mt-0.5 leading-relaxed">
                      {classToDelete.studentCount > 0
                        ? `Kelas ini memiliki ${classToDelete.studentCount} siswa terdaftar. Menghapus kelas ini juga akan menghapus seluruh data siswa, token, dan nilai ujian di dalamnya secara permanen.`
                        : "Kelas ini belum memiliki siswa dan akan segera dihapus dari daftar rombel."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-rose-900/60">
                  <button
                    type="button"
                    onClick={() => setClassToDelete(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteClass}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/25 cursor-pointer flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {classToDelete.studentCount > 0
                        ? `Ya, Hapus Kelas & ${classToDelete.studentCount} Siswa`
                        : "Ya, Hapus Kelas"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-2 divide-y divide-slate-850">
              {allClasses.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  Belum ada kelas yang terdaftar. Tambahkan kelas pertama di atas.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1">
                  {allClasses.map((cls) => {
                    const studentCount = existingStudents.filter(
                      (s) => (s?.className || "").trim().toLowerCase() === (cls || "").trim().toLowerCase()
                    ).length;
                    return (
                      <div
                        key={cls}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs transition"
                      >
                        <div className="truncate mr-1">
                          <span className="font-semibold text-slate-200">{cls}</span>
                          <span className={`ml-1 text-[10px] ${
                            studentCount > 0 ? "text-slate-400" : "text-amber-400"
                          }`}>
                            ({studentCount} siswa)
                          </span>
                        </div>
                        {(onDeleteClass || onDeleteCustomClass) && (
                          <button
                            type="button"
                            onClick={() => setClassToDelete({ name: cls, studentCount })}
                            title={`Hapus kelas ${cls} ${studentCount > 0 ? `dan ${studentCount} siswanya` : ""}`}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 cursor-pointer transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {mode === "single" ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveSingle(false)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition cursor-pointer"
                >
                  Simpan Kelas
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSingle(true)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
                >
                  <span>Simpan & Tambah Siswa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSaveBulk}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Semua Kelas</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
