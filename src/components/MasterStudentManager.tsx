import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Database,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  Copy,
  Check,
  X,
  Plus,
  AlertCircle,
  FileDown,
  Info,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Student } from "../types";
import {
  DATABASE_CLASSES,
  canonicalizeClassName,
  isSameClass,
  deduplicateClasses,
} from "../utils/classUtils";
import {
  parseMasterStudentsInput,
  buildStudentsFromMasterInput,
  ParsedMasterStudent,
  normalizeMasterName,
} from "../utils/masterStudentUtils";
import {
  isGoogleSignedIn,
  googleSignIn,
  googleSignOut,
  getGoogleUser,
} from "../services/googleAuth";
import {
  getMasterDriveSyncInfo,
  syncAllMasterStudentsToGoogleDrive,
  setMasterDriveAutoSync,
  MasterDriveSyncInfo,
} from "../services/googleDriveMasterService";

interface MasterStudentManagerProps {
  students: Student[];
  availableClasses: string[];
  firebaseStatus: "connected" | "connecting" | "disconnected" | "error";
  lastSyncTime?: string;
  onAddStudent: (student: Omit<Student, "id">) => Promise<void> | void;
  onBulkAddStudents: (newStudents: Student[]) => Promise<void> | void;
  onDeleteStudent: (id: string) => Promise<void> | void;
  onBulkDeleteStudents: (ids: string[]) => Promise<void> | void;
  onEmptyClass: (className: string) => Promise<void> | void;
  onAddClasses: (newClasses: string[]) => Promise<void> | void;
  onRefreshData?: () => Promise<number | void> | void;
}

export const MasterStudentManager: React.FC<MasterStudentManagerProps> = ({
  students,
  availableClasses,
  firebaseStatus,
  lastSyncTime,
  onAddStudent,
  onBulkAddStudents,
  onDeleteStudent,
  onBulkDeleteStudents,
  onEmptyClass,
  onAddClasses,
  onRefreshData,
}) => {
  // Navigation inside Master Manager
  const [activeSubView, setActiveSubView] = useState<"list" | "bulk_add" | "single_add" | "bulk_delete" | "drive_sync">("list");

  // Filtering & Search in List
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<"name" | "class">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Toast / Feedback State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "warning" | "error" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "warning" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Google Drive State
  const [driveInfo, setDriveInfo] = useState<MasterDriveSyncInfo>(getMasterDriveSyncInfo());
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const googleUser = getGoogleUser();

  const refreshDriveState = () => {
    setDriveInfo(getMasterDriveSyncInfo());
  };

  useEffect(() => {
    refreshDriveState();
  }, []);

  // ---------------------------------------------------------------------------
  // 1. SINGLE STUDENT INPUT (ONLY Name and Class)
  // ---------------------------------------------------------------------------
  const [singleName, setSingleName] = useState("");
  const [singleClass, setSingleClass] = useState<string>(availableClasses[0] || "X A");
  const [customSingleClass, setCustomSingleClass] = useState("");
  const [isAddingSingle, setIsAddingSingle] = useState(false);

  const effectiveSingleClass = singleClass === "__CUSTOM__" ? customSingleClass.trim() : singleClass;

  // Real-time duplicate check for single student
  const singleStudentDuplicate = useMemo(() => {
    if (!singleName.trim() || !effectiveSingleClass) return null;
    const targetNorm = normalizeMasterName(singleName);
    const targetCls = canonicalizeClassName(effectiveSingleClass);
    return students.find(
      (s) => isSameClass(s.className, targetCls) && normalizeMasterName(s.name) === targetNorm
    );
  }, [singleName, effectiveSingleClass, students]);

  const handleSaveSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) {
      showToast("Nama siswa tidak boleh kosong!", "error");
      return;
    }
    if (!effectiveSingleClass) {
      showToast("Kelas siswa harus dipilih atau diisi!", "error");
      return;
    }

    const canonicalCls = canonicalizeClassName(effectiveSingleClass);
    if (singleStudentDuplicate) {
      showToast(
        `Duplikat Terdeteksi: Siswa dengan nama "${singleName.trim()}" di kelas "${canonicalCls}" sudah terdaftar sebelumnya!`,
        "warning"
      );
      return;
    }

    setIsAddingSingle(true);
    try {
      const parsedItems: ParsedMasterStudent[] = [{ name: singleName.trim(), className: canonicalCls }];
      const [newRecord] = buildStudentsFromMasterInput(parsedItems, students);

      await onAddStudent(newRecord);

      // Auto sync to Google Drive if connected and autoSync is enabled
      if (driveInfo.isConnected && driveInfo.autoSync) {
        syncAllMasterStudentsToGoogleDrive([...students, newRecord]).then(() => refreshDriveState()).catch(() => {});
      }

      showToast(`Berhasil menambahkan siswa "${newRecord.name}" ke kelas ${canonicalCls}!`, "success");
      setSingleName("");
      setActiveSubView("list");
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan siswa.", "error");
    } finally {
      setIsAddingSingle(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. MASS STUDENT INPUT (ONLY Name and Class)
  // ---------------------------------------------------------------------------
  const [bulkInputMode, setBulkInputMode] = useState<"names_only" | "two_columns" | "file_upload">("names_only");
  const [bulkSelectedClass, setBulkSelectedClass] = useState<string>(availableClasses[0] || "X A");
  const [customBulkClass, setCustomBulkClass] = useState("");
  const [rawBulkText, setRawBulkText] = useState("");
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "update">("skip");
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  const effectiveBulkClass = bulkSelectedClass === "__CUSTOM__" ? customBulkClass.trim() : bulkSelectedClass;

  // Real-time batch parsing & duplicate detection
  const batchParseResult = useMemo(() => {
    if (!rawBulkText.trim()) return null;
    return parseMasterStudentsInput(rawBulkText, effectiveBulkClass || "X A", students);
  }, [rawBulkText, effectiveBulkClass, students]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length === 0) {
          showToast("Berkas kosong atau tidak ada data.", "warning");
          return;
        }

        // Detect if first row is header
        let startIndex = 0;
        const firstRow = rows[0].map((c) => String(c || "").toLowerCase());
        if (firstRow.some((c) => c.includes("nama") || c.includes("kelas") || c.includes("name"))) {
          startIndex = 1;
        }

        const lines: string[] = [];
        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          const col1 = String(row[0] || "").trim();
          const col2 = String(row[1] || "").trim();

          if (!col1 && !col2) continue;

          if (col1 && col2) {
            lines.push(`${col1}\t${col2}`);
          } else if (col1) {
            lines.push(col1);
          }
        }

        if (lines.length === 0) {
          showToast("Tidak ada baris data siswa yang ditemukan pada file.", "warning");
          return;
        }

        setRawBulkText(lines.join("\n"));
        showToast(`Berhasil membaca ${lines.length} baris data dari file Excel/CSV!`, "success");
      } catch (err: any) {
        showToast(`Gagal membaca berkas: ${err.message}`, "error");
      } finally {
        if (fileUploadRef.current) fileUploadRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveBulkStudents = async () => {
    if (!batchParseResult) return;
    const { validStudents, duplicatesInDatabase, duplicatesInBatch } = batchParseResult;

    const itemsToSave: ParsedMasterStudent[] = [...validStudents];
    if (duplicatePolicy === "update" && duplicatesInDatabase.length > 0) {
      itemsToSave.push(...duplicatesInDatabase);
    }

    if (itemsToSave.length === 0) {
      showToast("Tidak ada siswa baru yang dapat disimpan (semua terdeteksi duplikat atau kosong).", "warning");
      return;
    }

    setIsProcessingBulk(true);
    try {
      const recordsToCommit = buildStudentsFromMasterInput(itemsToSave, students);
      await onBulkAddStudents(recordsToCommit);

      // Auto sync to Google Drive
      if (driveInfo.isConnected && driveInfo.autoSync) {
        syncAllMasterStudentsToGoogleDrive([...students, ...recordsToCommit])
          .then(() => refreshDriveState())
          .catch(() => {});
      }

      showToast(
        `Berhasil menyimpan ${recordsToCommit.length} siswa baru! (${duplicatesInBatch.length + duplicatesInDatabase.length} duplikat disaring)`,
        "success"
      );
      setRawBulkText("");
      setActiveSubView("list");
    } catch (err: any) {
      showToast(`Gagal menyimpan data massal: ${err.message}`, "error");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. MASS STUDENT DELETION
  // ---------------------------------------------------------------------------
  const [deleteTargetClass, setDeleteTargetClass] = useState<string>(availableClasses[0] || "X A");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: "selected" | "class" | "all";
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    actionType: "selected",
    onConfirm: async () => {},
  });

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      showToast("Pilih setidaknya satu siswa untuk dihapus.", "warning");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Hapus Siswa Terpilih",
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} siswa yang dicentang secara permanen? Data akan otomatis dihapus dari Firebase & Google Drive.`,
      actionType: "selected",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await onBulkDeleteStudents(selectedIds);
          setSelectedIds([]);
          showToast(`Berhasil menghapus ${selectedIds.length} siswa.`, "success");
          if (driveInfo.isConnected && driveInfo.autoSync) {
            const remaining = students.filter((s) => !selectedIds.includes(s.id));
            syncAllMasterStudentsToGoogleDrive(remaining).then(() => refreshDriveState()).catch(() => {});
          }
        } catch (e: any) {
          showToast(`Gagal menghapus siswa: ${e.message}`, "error");
        } finally {
          setIsDeleting(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDeleteByClass = () => {
    if (!deleteTargetClass) return;
    const targetCanonical = canonicalizeClassName(deleteTargetClass);
    const countInClass = students.filter((s) => isSameClass(s.className, targetCanonical)).length;

    if (countInClass === 0) {
      showToast(`Tidak ada siswa di kelas ${targetCanonical}.`, "info");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `Kosongkan Seluruh Siswa di Kelas ${targetCanonical}`,
      message: `Peringatan: Tindakan ini akan menghapus seluruh ${countInClass} siswa di kelas ${targetCanonical}. Nama kelas akan tetap tersimpan. Lanjutkan?`,
      actionType: "class",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await onEmptyClass(targetCanonical);
          showToast(`Berhasil mengosongkan seluruh siswa di kelas ${targetCanonical}.`, "success");
          if (driveInfo.isConnected && driveInfo.autoSync) {
            const remaining = students.filter((s) => !isSameClass(s.className, targetCanonical));
            syncAllMasterStudentsToGoogleDrive(remaining).then(() => refreshDriveState()).catch(() => {});
          }
        } catch (e: any) {
          showToast(`Gagal mengosongkan kelas: ${e.message}`, "error");
        } finally {
          setIsDeleting(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleClearAllMasterStudents = () => {
    if (students.length === 0) {
      showToast("Data master siswa sudah kosong.", "info");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "KOSONGKAN SELURUH DATA MASTER SISWA",
      message: `PERINGATAN KRUSIAL: Anda akan menghapus SELURUH ${students.length} data siswa di semua kelas. Tindakan ini tidak dapat dibatalkan. Apakah Anda benar-benar yakin?`,
      actionType: "all",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const allIds = students.map((s) => s.id);
          await onBulkDeleteStudents(allIds);
          setSelectedIds([]);
          showToast("Seluruh data master siswa berhasil dikosongkan.", "success");
          if (driveInfo.isConnected && driveInfo.autoSync) {
            syncAllMasterStudentsToGoogleDrive([]).then(() => refreshDriveState()).catch(() => {});
          }
        } catch (e: any) {
          showToast(`Gagal mengosongkan data: ${e.message}`, "error");
        } finally {
          setIsDeleting(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ---------------------------------------------------------------------------
  // 4. GOOGLE DRIVE SYNC ACTIONS
  // ---------------------------------------------------------------------------
  const handleConnectGoogleDrive = async () => {
    setIsDriveConnecting(true);
    try {
      await googleSignIn();
      refreshDriveState();
      showToast("Berhasil menghubungkan akun Google Drive!", "success");
      // Trigger sync immediately after connecting
      handleSyncToGoogleDrive();
    } catch (e: any) {
      showToast(e.message || "Gagal menghubungkan Google Drive.", "error");
    } finally {
      setIsDriveConnecting(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    try {
      await googleSignOut();
      refreshDriveState();
      showToast("Akun Google Drive telah diputuskan.", "info");
    } catch {}
  };

  const handleSyncToGoogleDrive = async () => {
    if (!isGoogleSignedIn()) {
      handleConnectGoogleDrive();
      return;
    }

    setIsSyncingDrive(true);
    try {
      const res = await syncAllMasterStudentsToGoogleDrive(students);
      refreshDriveState();
      showToast(
        `Sukses! ${res.syncedCount} siswa telah disinkronkan ke Google Spreadsheet di Drive.`,
        "success"
      );
    } catch (err: any) {
      showToast(`Gagal sinkronisasi ke Google Drive: ${err.message}`, "error");
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setMasterDriveAutoSync(enabled);
    refreshDriveState();
    showToast(`Sinkronisasi otomatis Google Drive ${enabled ? "diaktifkan" : "dinonaktifkan"}.`, "info");
  };

  // ---------------------------------------------------------------------------
  // 5. EXPORT MASTER DATA (EXCEL / CSV)
  // ---------------------------------------------------------------------------
  const handleExportMasterExcel = () => {
    try {
      const dataToExport = filteredStudents.map((s, idx) => ({
        No: idx + 1,
        "Nama Siswa": s.name,
        Kelas: s.className,
        Username: s.username,
        Password: s.password || "siswa123",
        NISN: s.nisn,
        "Token Barcode": s.startBarcodeToken,
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Master Siswa");
      XLSX.writeFile(wb, `Data_Master_Siswa_${classFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast("File Excel data master siswa berhasil diunduh!", "success");
    } catch (e: any) {
      showToast(`Gagal mengunduh berkas: ${e.message}`, "error");
    }
  };

  // Filtered & Alphabetically Sorted Students list (Sesuai Abjad A-Z)
  const filteredStudents = useMemo(() => {
    const list = students.filter((s) => {
      if (classFilter !== "ALL" && !isSameClass(s.className, classFilter)) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = (s.name || "").toLowerCase().includes(query);
        const matchClass = (s.className || "").toLowerCase().includes(query);
        const matchNisn = (s.nisn || "").includes(query);
        const matchUser = (s.username || "").toLowerCase().includes(query);
        if (!matchName && !matchClass && !matchNisn && !matchUser) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortField === "class") {
        const classCmp = (a.className || "").localeCompare(b.className || "", "id", { numeric: true });
        if (classCmp !== 0) return sortDirection === "asc" ? classCmp : -classCmp;
      }
      const nameCmp = (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base", numeric: true });
      if (nameCmp !== 0) return sortDirection === "asc" ? nameCmp : -nameCmp;
      return (a.className || "").localeCompare(b.className || "", "id", { numeric: true });
    });
  }, [students, classFilter, searchTerm, sortField, sortDirection]);

  // Unique classes with student counts
  const classBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    availableClasses.forEach((c) => map.set(c, 0));
    students.forEach((s) => {
      const can = canonicalizeClassName(s.className);
      map.set(can, (map.get(can) || 0) + 1);
    });
    return Array.from(map.entries()).map(([className, count]) => ({ className, count }));
  }, [availableClasses, students]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium animate-in slide-in-from-bottom-3 ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-700/50"
              : toastMessage.type === "warning"
              ? "bg-amber-950/90 text-amber-200 border-amber-700/50"
              : toastMessage.type === "error"
              ? "bg-rose-950/90 text-rose-200 border-rose-700/50"
              : "bg-blue-950/90 text-blue-200 border-blue-700/50"
          }`}
        >
          {toastMessage.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toastMessage.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
          {toastMessage.type === "error" && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {toastMessage.type === "info" && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">{confirmModal.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition flex items-center gap-2 shadow-lg shadow-rose-600/30"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Ya, Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HERO & REAL-TIME STATUS OVERVIEW */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                Data Induk Siswa (Master)
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Real-Time Synchronized
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Input Data Master Siswa (Hanya Nama &amp; Kelas)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Cukup masukkan <strong>Nama</strong> dan <strong>Kelas</strong> siswa. Sistem otomatis menstandarkan rombel, menghasilkan username &amp; token barcode unik tanpa duplikasi, serta menyinkronkan data secara real-time ke <strong>Firebase Firestore</strong> dan <strong>Google Drive</strong>.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center min-w-[110px]">
              <span className="text-2xl font-black text-white">{students.length}</span>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Total Siswa</p>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center min-w-[110px]">
              <span className="text-2xl font-black text-emerald-400">{classBreakdown.filter((c) => c.count > 0).length}</span>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Kelas Terisi</p>
            </div>
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Firebase Status */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Firebase Firestore</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      firebaseStatus === "connected" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-400">
                  {firebaseStatus === "connected" ? "Terkoneksi Real-time" : "Menghubungkan..."}
                  {lastSyncTime && ` • Update: ${lastSyncTime}`}
                </div>
              </div>
            </div>
            {onRefreshData && (
              <button
                type="button"
                onClick={async () => {
                  await onRefreshData();
                  showToast("Data master siswa berhasil disegarkan dari database.", "info");
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-1 cursor-pointer"
                title="Segarkan data dari database"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>

          {/* Google Drive Status */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Google Drive &amp; Sheets</span>
                  {driveInfo.isConnected ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                      Terhubung
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      Belum Login
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {driveInfo.lastSyncedAt ? `Terakhir: ${driveInfo.lastSyncedAt}` : "Belum ada sinkronisasi"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {driveInfo.isConnected ? (
                <>
                  <button
                    type="button"
                    onClick={handleSyncToGoogleDrive}
                    disabled={isSyncingDrive}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-blue-600/20"
                  >
                    {isSyncingDrive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Sinkron Drive</span>
                  </button>
                  {driveInfo.spreadsheetUrl && (
                    <a
                      href={driveInfo.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Buka Spreadsheet di Google Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogleDrive}
                  disabled={isDriveConnecting}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDriveConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                  <span>Hubungkan Drive</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS FOR MASTER DATA */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubView("list")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubView === "list"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar Master Siswa ({students.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView("bulk_add")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubView === "bulk_add"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Tambah Siswa Massal (Nama &amp; Kelas)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView("single_add")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubView === "single_add"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah 1 Siswa Cepat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView("bulk_delete")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubView === "bulk_delete"
              ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Hapus Data Massal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView("drive_sync")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ml-auto ${
            activeSubView === "drive_sync"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Sinkronisasi Google Drive</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DAFTAR MASTER SISWA                                               */}
      {/* ========================================================================= */}
      {activeSubView === "list" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama atau kelas siswa..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Class Filter */}
              <div className="w-full sm:w-auto">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Semua Kelas ({students.length} siswa)</option>
                  {classBreakdown.map((c) => (
                    <option key={c.className} value={c.className}>
                      {c.className} ({c.count} siswa)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Urutan: <strong className="text-emerald-400">{sortField === "name" ? (sortDirection === "asc" ? "Abjad A-Z" : "Abjad Z-A") : (sortDirection === "asc" ? "Kelas A-Z" : "Kelas Z-A")}</strong></span>
              </div>

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Terpilih ({selectedIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportMasterExcel}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubView("bulk_add")}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa Massal</span>
              </button>
            </div>
          </div>

          {/* Quick Class Chips Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
            <button
              type="button"
              onClick={() => setClassFilter("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition ${
                classFilter === "ALL"
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Semua ({students.length})
            </button>
            {classBreakdown.map((c) => (
              <button
                key={c.className}
                type="button"
                onClick={() => setClassFilter(c.className)}
                className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition flex items-center gap-1.5 ${
                  isSameClass(classFilter, c.className)
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                <span>{c.className}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-bold">
                  {c.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
            <div className="overflow-x-auto max-h-[550px] scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredStudents.length > 0 &&
                          filteredStudents.every((s) => selectedIds.includes(s.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(Array.from(new Set([...selectedIds, ...filteredStudents.map((s) => s.id)])));
                          } else {
                            const currentFilteredIds = new Set(filteredStudents.map((s) => s.id));
                            setSelectedIds(selectedIds.filter((id) => !currentFilteredIds.has(id)));
                          }
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3 w-12 text-center font-bold">No</th>
                    <th className="p-3 font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortField === "name") {
                            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                          } else {
                            setSortField("name");
                            setSortDirection("asc");
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-white transition cursor-pointer"
                        title="Urutkan nama sesuai abjad"
                      >
                        <span>Nama Lengkap Siswa</span>
                        {sortField === "name" ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                            {sortDirection === "asc" ? "Abjad A-Z ↓" : "Abjad Z-A ↑"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">↕</span>
                        )}
                      </button>
                    </th>
                    <th className="p-3 font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortField === "class") {
                            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                          } else {
                            setSortField("class");
                            setSortDirection("asc");
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-white transition cursor-pointer"
                        title="Urutkan kelas"
                      >
                        <span>Kelas</span>
                        {sortField === "class" ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                            {sortDirection === "asc" ? "A-Z ↓" : "Z-A ↑"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">↕</span>
                        )}
                      </button>
                    </th>
                    <th className="p-3 font-bold">Username Akun</th>
                    <th className="p-3 font-bold">Password</th>
                    <th className="p-3 font-bold">NISN</th>
                    <th className="p-3 font-bold">Token Barcode</th>
                    <th className="p-3 text-right font-bold w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-sm">Tidak ada siswa ditemukan.</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Klik &quot;Tambah Siswa Massal&quot; untuk menginput nama dan kelas siswa secara cepat.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => {
                      const isSelected = selectedIds.includes(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-900/60 transition font-sans ${
                            isSelected ? "bg-blue-950/20" : ""
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds([...selectedIds, s.id]);
                                } else {
                                  setSelectedIds(selectedIds.filter((id) => id !== s.id));
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-semibold text-white">
                            <span>{s.name}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {s.className}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">
                            {s.username}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">
                            {s.password || "siswa123"}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-500">
                            {s.nisn || "-"}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-emerald-400">
                            {s.startBarcodeToken || "-"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: "Hapus Siswa",
                                  message: `Hapus siswa "${s.name}" (${s.className}) secara permanen?`,
                                  actionType: "selected",
                                  onConfirm: async () => {
                                    await onDeleteStudent(s.id);
                                    showToast(`Siswa "${s.name}" berhasil dihapus.`, "success");
                                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                                  },
                                });
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Hapus siswa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TAMBAH SISWA MASSAL (HANYA NAMA & KELAS)                           */}
      {/* ========================================================================= */}
      {activeSubView === "bulk_add" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <span>Input Massal: Cukup Nama dan Kelas</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hindari input form yang rumit. Anda cukup menempelkan daftar nama atau mengunggah Excel yang hanya berisi Nama dan Kelas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkInputMode("names_only")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  bulkInputMode === "names_only"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                1. Daftar Nama Per Kelas
              </button>
              <button
                type="button"
                onClick={() => setBulkInputMode("two_columns")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  bulkInputMode === "two_columns"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                2. Format Nama, Kelas
              </button>
              <button
                type="button"
                onClick={() => setBulkInputMode("file_upload")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  bulkInputMode === "file_upload"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                3. Unggah Berkas Excel/CSV
              </button>
            </div>
          </div>

          {/* Mode 1: Tempel Daftar Nama Per Kelas (Paling Cepat) */}
          {bulkInputMode === "names_only" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Pilih Kelas Tujuan untuk Daftar Nama:
                  </label>
                  <select
                    value={bulkSelectedClass}
                    onChange={(e) => setBulkSelectedClass(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Buat Rombel / Kelas Baru...</option>
                  </select>
                </div>

                {bulkSelectedClass === "__CUSTOM__" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-400">
                      Ketik Nama Kelas Baru:
                    </label>
                    <input
                      type="text"
                      value={customBulkClass}
                      onChange={(e) => setCustomBulkClass(e.target.value)}
                      placeholder="Contoh: XII PSP 3"
                      className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Semua nama yang ditempel di bawah akan otomatis dimasukkan ke kelas{" "}
                    <strong className="text-white">{effectiveBulkClass || "X A"}</strong>.
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Tempel Daftar Nama Siswa (1 Nama Per Baris):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Nomor urut absensi seperti &quot;1.&quot; atau &quot;1)&quot; otomatis dibersihkan
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={rawBulkText}
                  onChange={(e) => setRawBulkText(e.target.value)}
                  placeholder={`Contoh tempel nama dari buku absensi/Word:\nAhmad Fauzi\nBudi Santoso\nCindy Ayu Wandira\nDewi Lestari\nEko Prasetyo`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-sans text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Mode 2: Format Dua Kolom (Nama, Kelas atau Nama [TAB] Kelas) */}
          {bulkInputMode === "two_columns" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-white">Cara Format Dua Kolom:</p>
                  <p>
                    Anda dapat langsung meng-copy 2 kolom (Kolom Nama dan Kolom Kelas) dari Excel lalu menempelkannya di kotak bawah.
                    Pemisah koma (<code>,</code>), titik koma (<code>;</code>), atau tab otomatis didukung!
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Tempel Data (Nama Siswa dan Kelas):
                </label>
                <textarea
                  rows={8}
                  value={rawBulkText}
                  onChange={(e) => setRawBulkText(e.target.value)}
                  placeholder={`Contoh:\nAhmad Fauzi, X A\nBudi Santoso, X A\nDewi Lestari, XII RPL 1\nCindy Wandira, XII PSP 2`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-sans text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Mode 3: Unggah Berkas Excel / CSV */}
          {bulkInputMode === "file_upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-3xl p-8 text-center bg-slate-950/40 transition">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-emerald-400 mb-3 opacity-80" />
                <h4 className="text-sm font-bold text-white mb-1">
                  Pilih atau Tarik Berkas Excel / CSV
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Sistem hanya membutuhkan 2 kolom: <strong>Kolom 1: Nama Siswa</strong> dan{" "}
                  <strong>Kolom 2: Kelas</strong>. Tidak perlu kolom NISN atau Username!
                </p>
                <input
                  type="file"
                  ref={fileUploadRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileUploadRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>Pilih Berkas Excel / CSV (.xlsx / .csv)</span>
                </button>
              </div>

              {rawBulkText && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      Isi Berkas yang Terbaca:
                    </label>
                    <button
                      type="button"
                      onClick={() => setRawBulkText("")}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Bersihkan
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={rawBulkText}
                    onChange={(e) => setRawBulkText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* REAL-TIME ANTI-DUPLICATE & PREVIEW PANEL */}
          {batchParseResult && (
            <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Hasil Analisis Input &amp; Deteksi Duplikat</span>
                </h4>

                {/* Duplicate Policy Toggle */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Jika Ditemukan Duplikat:</span>
                  <select
                    value={duplicatePolicy}
                    onChange={(e) => setDuplicatePolicy(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="skip">Lewati Duplikat (Rekomendasi Aman)</option>
                    <option value="update">Perbarui Siswa yang Ada</option>
                  </select>
                </div>
              </div>

              {/* Status Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    {batchParseResult.validStudents.length}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-400">Siswa Baru Siap Ditambah</div>
                    <div className="text-[11px] text-slate-400">Nama &amp; kelas unik, belum ada di database</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm">
                    {batchParseResult.duplicatesInDatabase.length}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-400">Sudah Ada di Database</div>
                    <div className="text-[11px] text-slate-400">
                      {duplicatePolicy === "skip" ? "Akan dilewati agar tidak dobel" : "Akan diperbarui"}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold text-sm">
                    {batchParseResult.duplicatesInBatch.length}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-rose-400">Duplikat Dalam Input</div>
                    <div className="text-[11px] text-slate-400">Nama sama berulang di teks yang ditempel</div>
                  </div>
                </div>
              </div>

              {/* Preview Table of Ready to Add */}
              {batchParseResult.validStudents.length > 0 && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-56 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5">Kelas Terstandar</th>
                        <th className="p-2.5">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {batchParseResult.validStudents.slice(0, 50).map((st, i) => (
                        <tr key={i} className="hover:bg-slate-900/40">
                          <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{i + 1}</td>
                          <td className="p-2.5 font-semibold text-white">{st.name}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {st.className}
                            </span>
                          </td>
                          <td className="p-2.5 text-emerald-400 text-[11px] flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Unik &amp; Siap Simpan</span>
                          </td>
                        </tr>
                      ))}
                      {batchParseResult.validStudents.length > 50 && (
                        <tr>
                          <td colSpan={4} className="p-2.5 text-center text-slate-500 text-[11px]">
                            ... dan {batchParseResult.validStudents.length - 50} siswa lainnya
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Warnings for duplicates */}
              {batchParseResult.duplicatesInDatabase.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Contoh siswa yang sudah ada di database (tidak akan diduplikasi):</span>
                  </p>
                  <p className="text-slate-300 text-[11px]">
                    {batchParseResult.duplicatesInDatabase
                      .slice(0, 5)
                      .map((d) => `"${d.name}" (${d.className})`)
                      .join(", ")}
                    {batchParseResult.duplicatesInDatabase.length > 5 && ` (+${batchParseResult.duplicatesInDatabase.length - 5} lainnya)`}
                  </p>
                </div>
              )}

              {/* Action Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setRawBulkText("")}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Batal / Bersihkan
                </button>
                <button
                  type="button"
                  disabled={isProcessingBulk || batchParseResult.validStudents.length === 0}
                  onClick={handleSaveBulkStudents}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  {isProcessingBulk ? <RefreshCw className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                  <span>
                    Simpan {batchParseResult.validStudents.length} Siswa Baru &amp; Sinkronkan Real-Time
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: TAMBAH 1 SISWA CEPAT                                              */}
      {/* ========================================================================= */}
      {activeSubView === "single_add" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl max-w-xl mx-auto space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              <span>Input Cepat: 1 Siswa (Hanya Nama &amp; Kelas)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cukup isi nama dan pilih kelas. Username, password, NISN, dan barcode token ujian di-generate otomatis.
            </p>
          </div>

          <form onSubmit={handleSaveSingleStudent} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Nama Lengkap Siswa: <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Pilih Kelas: <span className="text-rose-400">*</span>
              </label>
              <select
                value={singleClass}
                onChange={(e) => setSingleClass(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Buat Kelas Baru...</option>
              </select>
            </div>

            {singleClass === "__CUSTOM__" && (
              <div className="space-y-1.5 animate-in fade-in">
                <label className="text-xs font-bold text-emerald-400">
                  Nama Kelas Baru:
                </label>
                <input
                  type="text"
                  required
                  value={customSingleClass}
                  onChange={(e) => setCustomSingleClass(e.target.value)}
                  placeholder="Contoh: XII PSP 3"
                  className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Duplicate Notice */}
            {singleStudentDuplicate && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Siswa dengan nama dan kelas ini sudah terdaftar!</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Siswa: {singleStudentDuplicate.name} ({singleStudentDuplicate.className}) • Username: {singleStudentDuplicate.username}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSingleName("");
                  setActiveSubView("list");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isAddingSingle || Boolean(singleStudentDuplicate) || !singleName.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/30"
              >
                {isAddingSingle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Simpan Siswa ke Database</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: HAPUS DATA MASSAL                                                 */}
      {/* ========================================================================= */}
      {activeSubView === "bulk_delete" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>Opsi Hapus Data Massal Siswa</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola dan bersihkan data siswa secara massal dengan perlindungan konfirmasi bertingkat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Opsi A: Hapus Siswa Per Kelas Tertentu */}
            <div className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Kosongkan Siswa Per Kelas</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hapus seluruh siswa yang terdaftar dalam satu kelas tertentu secara instan.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-300">Pilih Kelas yang Ingin Dikosongkan:</label>
                  <select
                    value={deleteTargetClass}
                    onChange={(e) => setDeleteTargetClass(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {availableClasses.map((cls) => {
                      const count = students.filter((s) => isSameClass(s.className, cls)).length;
                      return (
                        <option key={cls} value={cls}>
                          {cls} ({count} siswa)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeleteByClass}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Kosongkan Seluruh Siswa di Kelas Ini</span>
              </button>
            </div>

            {/* Opsi B: Hapus Siswa Terpilih (Centang) */}
            <div className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Hapus Siswa Terpilih (Centang)</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Saat ini ada <strong className="text-white">{selectedIds.length} siswa</strong> yang dicentang pada tabel.
                  </p>
                </div>

                <p className="text-xs text-slate-400 pt-2">
                  Buka tab <strong>Daftar Master Siswa</strong> untuk memilih siswa satu per satu atau memilih seluruh siswa pada filter tertentu.
                </p>
              </div>

              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={handleDeleteSelected}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus {selectedIds.length} Siswa Terpilih</span>
              </button>
            </div>
          </div>

          {/* Danger Zone: Kosongkan Seluruh Data Master */}
          <div className="p-5 rounded-3xl bg-rose-950/20 border border-rose-600/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-black text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Zona Bahaya: Reset Seluruh Data Master Siswa</span>
              </h4>
              <p className="text-xs text-slate-300">
                Menghapus seluruh {students.length} siswa di semua kelas secara permanen dari server lokal, Firebase Firestore, dan Google Drive.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClearAllMasterStudents}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2 shrink-0 shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Kosongkan Seluruh Data Master</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: GOOGLE DRIVE & CLOUD REAL-TIME SYNC PANEL                         */}
      {/* ========================================================================= */}
      {activeSubView === "drive_sync" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-cyan-400" />
                <span>Sinkronisasi Google Drive &amp; Spreadsheet Master Siswa</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Otomatis membuat dan memelihara Google Spreadsheet resmi di akun Google Drive Anda.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {driveInfo.isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectGoogleDrive}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Putuskan Akun
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogleDrive}
                  disabled={isDriveConnecting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {isDriveConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  <span>Hubungkan Google Drive Sekarang</span>
                </button>
              )}
            </div>
          </div>

          {/* Connected User & Folder Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Koneksi</span>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {driveInfo.isConnected ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Terhubung ke Akun Google</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                    <span className="text-slate-400">Belum Terhubung</span>
                  </>
                )}
              </div>
              {googleUser && (
                <p className="text-xs text-slate-400 truncate">{googleUser.email || googleUser.displayName}</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Spreadsheet Master di Drive</span>
              <div className="text-sm font-bold text-white truncate">
                {driveInfo.spreadsheetName || "Data_Master_Induk_Siswa_CBT"}
              </div>
              <p className="text-xs text-slate-400">Tersimpan di folder &quot;GPP_CBT_Backups&quot;</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Terakhir Disinkronkan</span>
              <div className="text-sm font-bold text-emerald-400">
                {driveInfo.lastSyncedAt || "Belum pernah"}
              </div>
              <p className="text-xs text-slate-400">
                {driveInfo.syncedStudentCount > 0 ? `${driveInfo.syncedStudentCount} siswa tercatat` : "-"}
              </p>
            </div>
          </div>

          {/* Sync Trigger and Settings */}
          <div className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white">Sinkronisasi Otomatis</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Setiap kali data master siswa ditambah atau dihapus, otomatis perbarui berkas Google Spreadsheet di Drive.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={driveInfo.autoSync}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-semibold text-white">Aktifkan Sinkron Otomatis</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSyncToGoogleDrive}
                disabled={isSyncingDrive || !driveInfo.isConnected}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-600/20"
              >
                {isSyncingDrive ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Sinkronkan Sekarang ke Google Drive</span>
              </button>

              {driveInfo.spreadsheetUrl && (
                <a
                  href={driveInfo.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka Spreadsheet di Google Drive</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function SaveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
