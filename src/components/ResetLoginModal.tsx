import React, { useState, useMemo } from "react";
import {
  RotateCcw,
  Search,
  CheckCircle2,
  X,
  Lock,
  Unlock,
  Users,
  UserCheck,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { Student, ExamConfig, isExamClassActive } from "../types";

interface ResetLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  config?: ExamConfig;
  onResetStudentLogin: (studentId: string) => void;
  onResetMultipleStudentsLogin?: (studentIds: string[]) => void;
  onResetAllStudentsLogin: () => void;
  initialSelectedIds?: string[];
  onSuccessToast?: (msg: string) => void;
}

export const ResetLoginModal: React.FC<ResetLoginModalProps> = ({
  isOpen,
  onClose,
  students,
  config,
  onResetStudentLogin,
  onResetMultipleStudentsLogin,
  onResetAllStudentsLogin,
  initialSelectedIds = [],
  onSuccessToast,
}) => {
  const [activeMode, setActiveMode] = useState<"select" | "all">("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [filterLockedOnly, setFilterLockedOnly] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [allScope, setAllScope] = useState<"active_class" | "all_database">("active_class");
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  // Sync initialSelectedIds when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
      setConfirmAllOpen(false);
    }
  }, [isOpen, initialSelectedIds]);

  // Unique classes list
  const classesList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set).sort();
  }, [students]);

  // Students in active exam class
  const activeClassStudents = useMemo(() => {
    if (!config) return students;
    return students.filter((s) => isExamClassActive(config, s.className));
  }, [students, config]);

  // Filtered students for manual selection
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        !(searchQuery || "").trim() ||
        (s.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
        (s.nisn || "").toLowerCase().includes((searchQuery || "").toLowerCase());

      const matchClass =
        selectedClass === "all" ||
        (selectedClass === "active_only" && config && isExamClassActive(config, s.className)) ||
        s.className === selectedClass;

      const isLockedOrLoggedIn = s.isLocked || s.loginCount > 0;
      const matchLocked = !filterLockedOnly || isLockedOrLoggedIn;

      return matchSearch && matchClass && matchLocked;
    });
  }, [students, searchQuery, selectedClass, filterLockedOnly, config]);

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredStudents.map((s) => s.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      // Unselect visible
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Union visible
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSelectAllLocked = () => {
    const lockedIds = students
      .filter((s) => s.isLocked || s.loginCount > 0)
      .map((s) => s.id);
    setSelectedIds(lockedIds);
  };

  const handleResetSelected = () => {
    if (selectedIds.length === 0) return;
    if (onResetMultipleStudentsLogin) {
      onResetMultipleStudentsLogin(selectedIds);
    } else {
      selectedIds.forEach((id) => onResetStudentLogin(id));
    }
    const count = selectedIds.length;
    onSuccessToast?.(`Berhasil mereset status login untuk ${count} siswa terpilih. Siswa kini dapat login kembali.`);
    setSelectedIds([]);
    onClose();
  };

  const handleResetSingleQuick = (student: Student) => {
    onResetStudentLogin(student.id);
    onSuccessToast?.(`Status login siswa "${student.name}" (NISN: ${student.nisn}) berhasil direset.`);
  };

  const handleResetAllConfirm = () => {
    if (allScope === "active_class") {
      const activeIds = activeClassStudents.map((s) => s.id);
      if (onResetMultipleStudentsLogin) {
        onResetMultipleStudentsLogin(activeIds);
      } else {
        activeIds.forEach((id) => onResetStudentLogin(id));
      }
      onSuccessToast?.(`Berhasil mereset login seluruh ${activeIds.length} siswa kelas aktif.`);
    } else {
      onResetAllStudentsLogin();
      onSuccessToast?.(`Berhasil mereset login seluruh ${students.length} siswa terdaftar di database.`);
    }
    setConfirmAllOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>Reset Izin Login Siswa</span>
                <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                  1 Siswa = 1 Sesi
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pilih siswa tertentu untuk dibuka kuncinya atau reset seluruh peserta ujian
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Pilih Siswa Tertentu vs Reset Semua */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-slate-800 bg-slate-900/50 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveMode("select")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                activeMode === "select"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Pilih Siswa Tertentu</span>
              {selectedIds.length > 0 && (
                <span className="bg-slate-950 text-amber-400 text-[10px] font-mono px-1.5 py-0.2 rounded-full ml-1">
                  {selectedIds.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                activeMode === "all"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Reset Semua Peserta</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:flex items-center space-x-2">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>Terkunci/Pernah Login ({students.filter((s) => s.isLocked || s.loginCount > 0).length})</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Belum Login ({students.filter((s) => !s.isLocked && s.loginCount === 0).length})</span>
            </span>
          </div>
        </div>

        {/* Tab 1: SELECT SPECIFIC STUDENTS */}
        {activeMode === "select" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Search & Filter Bar */}
            <div className="p-4 sm:px-6 bg-slate-950/40 border-b border-slate-800/60 grid grid-cols-1 sm:grid-cols-12 gap-2.5 shrink-0">
              {/* Search Box */}
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama siswa atau NISN..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Class Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
                >
                  <option value="all">Semua Kelas ({students.length})</option>
                  {config && (
                    <option value="active_only">
                      ⚡ Kelas Ujian Aktif ({activeClassStudents.length})
                    </option>
                  )}
                  {classesList.map((c) => (
                    <option key={c} value={c}>
                      Kelas {c} ({students.filter((s) => s.className === c).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Locked Only Filter */}
              <div className="sm:col-span-3 flex items-center">
                <button
                  type="button"
                  onClick={() => setFilterLockedOnly(!filterLockedOnly)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    filterLockedOnly
                      ? "bg-rose-950/60 border-rose-500/50 text-rose-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Hanya Terkunci</span>
                </button>
              </div>
            </div>

            {/* Quick Bulk Selection Buttons */}
            <div className="px-5 sm:px-6 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition cursor-pointer"
                >
                  {filteredStudents.length > 0 &&
                  filteredStudents.every((s) => selectedIds.includes(s.id))
                    ? "Batalkan Pilihan Semua"
                    : `Pilih Semua (${filteredStudents.length})`}
                </button>

                <button
                  type="button"
                  onClick={handleSelectAllLocked}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 font-semibold text-[11px] transition cursor-pointer"
                >
                  Pilih Semua Terkunci (
                  {students.filter((s) => s.isLocked || s.loginCount > 0).length})
                </button>

                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-slate-500 hover:text-slate-300 text-[11px] underline"
                  >
                    Kosongkan Pilihan
                  </button>
                )}
              </div>

              <div className="text-[11px] font-mono text-amber-400 font-bold">
                {selectedIds.length} siswa dipilih
              </div>
            </div>

            {/* Students List Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 sm:px-4">
              {filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <UserCheck className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                  <p className="text-xs font-semibold">Tidak ada siswa yang sesuai filter.</p>
                  <p className="text-[11px] text-slate-600">Coba ubah kata kunci pencarian atau filter kelas.</p>
                </div>
              ) : (
                filteredStudents.map((st) => {
                  const isSelected = selectedIds.includes(st.id);
                  const isLocked = st.isLocked || st.loginCount > 0;

                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleSelectOne(st.id)}
                      className={`p-2.5 sm:px-3 rounded-2xl flex items-center justify-between gap-3 transition cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/10 border border-amber-500/40"
                          : "hover:bg-slate-800/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(st.id)}
                          className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 shrink-0 cursor-pointer"
                        />

                        {/* Lock / Unlock Icon */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isLocked
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </div>

                        {/* Student Info */}
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white truncate">
                              {st.name}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.2 rounded">
                              {st.className}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                            <span className="font-mono">NISN: {st.nisn}</span>
                            <span>•</span>
                            <span>Login: {st.loginCount}x</span>
                            <span>•</span>
                            <span
                              className={`font-semibold ${
                                isLocked ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {isLocked ? "Terkunci (Sudah Login)" : "Bisa Login"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action: Quick Single Reset Button */}
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetSingleQuick(st);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-bold text-[11px] flex items-center space-x-1 transition cursor-pointer"
                          title={`Reset login untuk ${st.name}`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span className="hidden sm:inline">Reset</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="px-5 sm:px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-400">
                <span className="font-bold text-white">{selectedIds.length}</span> siswa terpilih
                untuk direset status logingnya.
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={handleResetSelected}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset {selectedIds.length} Siswa Terpilih</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: RESET ALL PARTICIPANTS */}
        {activeMode === "all" && (
          <div className="p-5 sm:p-7 space-y-6 overflow-y-auto">
            <div className="bg-rose-950/30 border border-rose-500/40 rounded-3xl p-5 space-y-3">
              <div className="flex items-center space-x-3 text-rose-400">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <h4 className="text-sm sm:text-base font-extrabold text-white">
                  Reset Semua Peserta Ujian Serentak
                </h4>
              </div>
              <p className="text-xs text-rose-200/80 leading-relaxed">
                Tindakan ini akan membuka kunci login untuk banyak peserta sekaligus.
                Siswa yang sedang mengalami kendala terputus koneksi atau tidak sengaja logout
                akan dapat masuk kembali ke sistem ujian menggunakan NISN/Barcode mereka.
              </p>
            </div>

            {/* Scope Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Pilih Cakupan Siswa yang Ingin Direset:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Scope 1: Active Exam Class Only */}
                <div
                  onClick={() => setAllScope("active_class")}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    allScope === "active_class"
                      ? "bg-amber-500/15 border-amber-500 text-white"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center space-x-1.5">
                      <GraduationCap className="w-4 h-4 text-amber-400" />
                      <span>Hanya Kelas Ujian Aktif</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {activeClassStudents.length} Siswa
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Hanya siswa dalam rombel yang saat ini aktif dijadwalkan mengikuti sesi ujian
                    {config?.activeClasses && config.activeClasses.length > 0 ? ` (${config.activeClasses.join(", ")})` : ""}.
                  </p>
                </div>

                {/* Scope 2: All Database */}
                <div
                  onClick={() => setAllScope("all_database")}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    allScope === "all_database"
                      ? "bg-rose-600/15 border-rose-500 text-white"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center space-x-1.5">
                      <Users className="w-4 h-4 text-rose-400" />
                      <span>Seluruh Siswa Terdaftar</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      {students.length} Siswa
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Mereset status login seluruh data siswa yang ada di database dari seluruh rombel/kelas.
                  </p>
                </div>
              </div>
            </div>

            {/* Confirmation Box if clicked */}
            {!confirmAllOpen ? (
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAllOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/20 transition cursor-pointer flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    Lanjutkan Reset{" "}
                    {allScope === "active_class"
                      ? `${activeClassStudents.length} Siswa Kelas Aktif`
                      : `Semua ${students.length} Siswa`}
                  </span>
                </button>
              </div>
            ) : (
              <div className="bg-rose-950/70 border border-rose-500 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center space-x-2 text-rose-300 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Konfirmasi Keamanan Terakhir:</span>
                </div>
                <p className="text-xs text-rose-200">
                  Apakah Anda yakin ingin mereset login untuk{" "}
                  <strong className="text-white underline">
                    {allScope === "active_class"
                      ? `${activeClassStudents.length} siswa kelas ujian aktif`
                      : `seluruh ${students.length} siswa terdaftar`}
                  </strong>
                  ? Token sesi aktif mereka akan direset agar dapat login kembali.
                </p>
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmAllOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAllConfirm}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ya, Reset Sekarang</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function ShieldAlert(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
