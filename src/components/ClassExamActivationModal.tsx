import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Users,
  CheckCircle2,
  XCircle,
  Search,
  Check,
  Filter,
  Layers,
  Power,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { ExamConfig, Student } from "../types";

interface ClassExamActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  examConfig: ExamConfig;
  availableClasses: string[];
  students: Student[];
  onSaveConfig: (updates: Partial<ExamConfig>) => void;
}

const normalizeClassName = (cls?: string) =>
  (cls || "").trim().replace(/\s+/g, " ").toLowerCase();

export const ClassExamActivationModal: React.FC<ClassExamActivationModalProps> = ({
  isOpen,
  onClose,
  examConfig,
  availableClasses,
  students,
  onSaveConfig,
}) => {
  // Mode: all or selective
  const [allClassesActive, setAllClassesActive] = useState<boolean>(
    examConfig.allClassesActive ?? true
  );

  // Set of selected active classes
  const [selectedClasses, setSelectedClasses] = useState<string[]>(() => {
    if (examConfig.allClassesActive === false) {
      return Array.isArray(examConfig.activeClasses) ? [...examConfig.activeClasses] : [];
    }
    if (examConfig.activeClasses && examConfig.activeClasses.length > 0) {
      return [...examConfig.activeClasses];
    }
    return [...availableClasses];
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");

  // Sync state when modal opens or examConfig changes
  useEffect(() => {
    if (isOpen) {
      const isAll = examConfig.allClassesActive ?? true;
      setAllClassesActive(isAll);
      if (!isAll) {
        setSelectedClasses(
          Array.isArray(examConfig.activeClasses) ? [...examConfig.activeClasses] : []
        );
      } else {
        setSelectedClasses(
          examConfig.activeClasses && examConfig.activeClasses.length > 0
            ? [...examConfig.activeClasses]
            : [...availableClasses]
        );
      }
    }
  }, [isOpen, examConfig.allClassesActive, examConfig.activeClasses, availableClasses]);

  // Compute student count per class with normalized matching
  const classStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    availableClasses.forEach((cls) => {
      counts[cls] = 0;
    });
    students.forEach((s) => {
      if (s.className) {
        const norm = normalizeClassName(s.className);
        const match = availableClasses.find((ac) => normalizeClassName(ac) === norm);
        if (match) {
          counts[match] = (counts[match] || 0) + 1;
        } else {
          counts[s.className] = (counts[s.className] || 0) + 1;
        }
      }
    });
    return counts;
  }, [availableClasses, students]);

  // Extract grade levels (X, XI, XII, etc.)
  const gradeLevels = useMemo(() => {
    const set = new Set<string>();
    availableClasses.forEach((cls) => {
      const match = cls.match(/^(X|XI|XII|X\b|XI\b|XII\b|\d+)/i);
      if (match) {
        set.add(match[1].toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [availableClasses]);

  // Filter classes by search and grade
  const filteredClasses = availableClasses.filter((cls) => {
    const matchesSearch = (cls || "").toLowerCase().includes((searchTerm || "").toLowerCase().trim());
    const matchesGrade =
      gradeFilter === "ALL" ||
      cls.toUpperCase().startsWith(gradeFilter) ||
      cls.toUpperCase().includes(` ${gradeFilter} `);
    return matchesSearch && matchesGrade;
  });

  const isClassActive = (cls: string) => {
    if (allClassesActive) return true;
    const norm = normalizeClassName(cls);
    return selectedClasses.some((sc) => normalizeClassName(sc) === norm);
  };

  // Toggle single class with instant auto-save
  const handleToggleClass = (cls: string) => {
    const norm = normalizeClassName(cls);
    let nextAll = allClassesActive;
    let nextSelected: string[];

    if (allClassesActive) {
      nextAll = false;
      nextSelected = availableClasses.filter((c) => normalizeClassName(c) !== norm);
    } else {
      const alreadyIn = selectedClasses.some((c) => normalizeClassName(c) === norm);
      if (alreadyIn) {
        nextSelected = selectedClasses.filter((c) => normalizeClassName(c) !== norm);
      } else {
        nextSelected = [...selectedClasses, cls];
      }
    }

    setAllClassesActive(nextAll);
    setSelectedClasses(nextSelected);

    // Instant save to examConfig
    onSaveConfig({
      allClassesActive: nextAll,
      activeClasses: nextSelected,
    });
  };

  // Activate all with instant auto-save
  const handleActivateAll = () => {
    setAllClassesActive(true);
    setSelectedClasses([...availableClasses]);
    onSaveConfig({
      allClassesActive: true,
      activeClasses: [...availableClasses],
    });
  };

  // Deactivate all with instant auto-save
  const handleDeactivateAll = () => {
    setAllClassesActive(false);
    setSelectedClasses([]);
    onSaveConfig({
      allClassesActive: false,
      activeClasses: [],
    });
  };

  // Activate grade with instant auto-save
  const handleActivateGrade = (grade: string) => {
    const targetClasses = availableClasses.filter(
      (c) => c.toUpperCase().startsWith(grade) || c.toUpperCase().includes(` ${grade} `)
    );
    const baseList = allClassesActive ? availableClasses : selectedClasses;
    const existing = new Set(baseList.map((c) => normalizeClassName(c)));
    const toAdd = targetClasses.filter((c) => !existing.has(normalizeClassName(c)));
    const nextSelected = [...baseList, ...toAdd];

    setAllClassesActive(false);
    setSelectedClasses(nextSelected);
    onSaveConfig({
      allClassesActive: false,
      activeClasses: nextSelected,
    });
  };

  // Deactivate grade with instant auto-save
  const handleDeactivateGrade = (grade: string) => {
    const baseList = allClassesActive ? availableClasses : selectedClasses;
    const nextSelected = baseList.filter(
      (c) => !(c.toUpperCase().startsWith(grade) || c.toUpperCase().includes(` ${grade} `))
    );
    setAllClassesActive(false);
    setSelectedClasses(nextSelected);
    onSaveConfig({
      allClassesActive: false,
      activeClasses: nextSelected,
    });
  };

  const handleSaveAndClose = () => {
    onSaveConfig({
      allClassesActive,
      activeClasses: selectedClasses,
    });
    onClose();
  };

  // Active statistics
  const totalActiveClasses = allClassesActive
    ? availableClasses.length
    : selectedClasses.filter((c) =>
        availableClasses.some((ac) => normalizeClassName(ac) === normalizeClassName(c))
      ).length;

  const totalActiveStudents = availableClasses.reduce((acc, cls) => {
    if (isClassActive(cls)) {
      return acc + (classStudentCounts[cls] || 0);
    }
    return acc;
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Container with max-h-[90vh] and proper flex layout so footer is ALWAYS visible */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-800 bg-slate-900/95 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 shadow-inner">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Pilih Kelas yang Diaktifkan untuk Ujian
                </h2>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[11px] font-extrabold border border-indigo-500/30">
                  CBT Gate
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Klik kartu kelas untuk mengaktifkan atau menonaktifkan. Perubahan langsung disimpan otomatis.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end space-x-2.5">
            {/* Live active stats pill */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs shrink-0">
              <span className="text-slate-400 font-medium">Terpilih:</span>
              <span className="font-extrabold text-emerald-400 font-mono">
                {totalActiveClasses} / {availableClasses.length} Kelas
              </span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-indigo-300 font-semibold">
                {totalActiveStudents} Siswa
              </span>
            </div>

            {/* Prominent Header Save & Close Button */}
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 transition cursor-pointer shrink-0"
              title="Terapkan dan tutup modal"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Selesai ({totalActiveClasses} Kelas)</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition cursor-pointer"
              title="Tutup & Simpan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Mode Switcher & Quick Controls Row */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-b border-slate-800 bg-slate-950/60 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shrink-0">
          {/* Segmented Mode Control */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleActivateAll}
              className={`flex-1 lg:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                allClassesActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Semua Kelas Diizinkan Ujian ({availableClasses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAllClassesActive(false);
                onSaveConfig({
                  allClassesActive: false,
                  activeClasses: selectedClasses,
                });
              }}
              className={`flex-1 lg:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                !allClassesActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Pilih Kelas Tertentu (Manual)</span>
            </button>
          </div>

          {/* Quick Bulk Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleActivateAll}
              className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-600/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Aktifkan Semua</span>
            </button>
            <button
              type="button"
              onClick={handleDeactivateAll}
              className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-600/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Nonaktifkan Semua</span>
            </button>
          </div>
        </div>

        {/* Search & Grade Level Filter Toolbar */}
        <div className="px-4 py-2 sm:px-6 sm:py-2.5 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama kelas / rombel..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Grade Level Pills and Quick Grade Toggle */}
          {gradeLevels.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs text-slate-400 font-semibold mr-1 shrink-0">
                Tingkat:
              </span>
              <button
                type="button"
                onClick={() => setGradeFilter("ALL")}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  gradeFilter === "ALL"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Semua ({availableClasses.length})
              </button>
              {gradeLevels.map((lvl) => {
                const count = availableClasses.filter(
                  (c) => c.toUpperCase().startsWith(lvl) || c.toUpperCase().includes(` ${lvl} `)
                ).length;
                return (
                  <div key={lvl} className="inline-flex items-center rounded-xl bg-slate-950 border border-slate-800 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGradeFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        gradeFilter === lvl
                          ? "bg-indigo-600 text-white"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      {lvl} ({count})
                    </button>
                    {!allClassesActive && (
                      <div className="flex items-center space-x-0.5 ml-1 border-l border-slate-800 pl-1">
                        <button
                          type="button"
                          onClick={() => handleActivateGrade(lvl)}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/60 rounded transition cursor-pointer"
                          title={`Aktifkan semua rombel ${lvl}`}
                        >
                          +Aktif
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivateGrade(lvl)}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-rose-400 hover:bg-rose-950/60 rounded transition cursor-pointer"
                          title={`Nonaktifkan semua rombel ${lvl}`}
                        >
                          -Non
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable Class Selection Cards Area with min-h-0 so it fits in any screen */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-slate-950/70">
          {filteredClasses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <Filter className="w-9 h-9 mx-auto text-slate-600" />
              <p className="text-xs sm:text-sm font-semibold text-slate-300">
                Tidak ada kelas yang cocok dengan pencarian "{searchTerm}".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setGradeFilter("ALL");
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Reset Filter Pencarian
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredClasses.map((cls) => {
                const active = isClassActive(cls);
                const count = classStudentCounts[cls] || 0;

                return (
                  <div
                    key={cls}
                    onClick={() => handleToggleClass(cls)}
                    className={`p-3.5 rounded-2xl border-2 transition-all duration-150 cursor-pointer flex items-center justify-between select-none ${
                      active
                        ? "bg-slate-900/95 border-emerald-500 hover:border-emerald-400 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/30"
                        : "bg-slate-950/80 border-slate-800/90 hover:border-slate-700 opacity-75 hover:opacity-100 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Switch / Toggle */}
                      <div
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0 flex items-center ${
                          active ? "bg-emerald-500 shadow-sm shadow-emerald-500/30" : "bg-slate-800"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                            active ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <h3
                          className={`font-black text-base tracking-wide truncate ${
                            active ? "text-white" : "text-slate-300"
                          }`}
                        >
                          {cls}
                        </h3>
                        <div className="flex items-center space-x-1 text-xs text-slate-400 mt-0.5 font-medium">
                          <Users className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{count} Siswa Terdaftar</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 ml-2">
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-lg border flex items-center space-x-1 ${
                          active
                            ? "text-emerald-300 bg-emerald-950/70 border-emerald-500/50"
                            : "text-rose-300 bg-rose-950/40 border-rose-900/40"
                        }`}
                      >
                        {active ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>AKTIF</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            <span>NONAKTIF</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Informational Footer Note */}
        <div className="bg-slate-950 border-t border-slate-800 px-5 py-2 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">
              Siswa pada kelas non-aktif tidak dapat login dan otomatis disembunyikan dari daftar peserta aktif.
            </span>
            <span className="sm:hidden">
              Perubahan tersimpan otomatis seketika.
            </span>
          </div>
          <div className="flex items-center space-x-1 text-emerald-400 font-semibold text-[11px] shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tersimpan Otomatis</span>
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            <Power className="w-4 h-4" />
            <span>Terapkan Pengaturan ({totalActiveClasses} Kelas Aktif)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
