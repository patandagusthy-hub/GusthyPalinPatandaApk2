import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Cloud,
  HardDrive,
  Upload,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Folder,
  FileText,
  Database,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Check,
  FolderSync,
  FileSpreadsheet,
  Zap,
  ToggleLeft,
  ToggleRight,
  CheckCheck,
} from "lucide-react";
import {
  googleSignIn,
  googleSignOut,
  getGoogleAccessToken,
  getGoogleUser,
  initGoogleAuth,
  isGoogleSignedIn,
} from "../services/googleAuth";
import {
  listDriveFiles,
  uploadJsonToDrive,
  uploadTextToDrive,
  downloadFileContent,
  deleteDriveFile,
  getDriveStorageInfo,
  GoogleDriveFile,
  DriveStorageQuota,
} from "../services/googleDriveService";
import {
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getStoredSpreadsheetInfo,
  getOrCreateExamSpreadsheet,
  syncAllSubmittedStudents,
} from "../services/googleSheetsService";
import { Student, Question, ExamConfig, TeacherOrAdmin } from "../types";

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  questions: Question[];
  examConfig: ExamConfig;
  staffUsers: TeacherOrAdmin[];
  onRestoreFullDatabase: (importedDb: any) => Promise<boolean>;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  students,
  questions,
  examConfig,
  staffUsers,
  onRestoreFullDatabase,
}) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [storageQuota, setStorageQuota] = useState<DriveStorageQuota | null>(null);

  const [activeTab, setActiveTab] = useState<"auto_sync" | "backup" | "files">("auto_sync");
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Auto-Sync Real-Time to Google Spreadsheet state
  const [autoSyncActive, setAutoSyncActive] = useState<boolean>(isAutoSyncEnabled());
  const [spreadsheetInfo, setSpreadsheetInfo] = useState(getStoredSpreadsheetInfo());
  const [isInitializingSheet, setIsInitializingSheet] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  // Mandatory Confirmation Modal for Destructive Operations
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<GoogleDriveFile | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);

  // Confirmation Modal for Restore
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<GoogleDriveFile | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const submittedStudents = students.filter(
    (s) => s.examStatus === "submitted" || s.examStatus === "disqualified"
  );

  // Initialize Auth state & load resources
  useEffect(() => {
    if (isOpen) {
      setAutoSyncActive(isAutoSyncEnabled());
      setSpreadsheetInfo(getStoredSpreadsheetInfo());

      const unsub = initGoogleAuth(
        (user) => {
          setIsSignedIn(true);
          setGoogleUser(user);
          loadStorageInfo();
          loadDriveFiles();
          ensureSpreadsheetReady();
        },
        () => {
          const hasToken = isGoogleSignedIn();
          setIsSignedIn(hasToken);
          setGoogleUser(getGoogleUser());
          if (hasToken) {
            loadStorageInfo();
            loadDriveFiles();
            ensureSpreadsheetReady();
          }
        }
      );
      return () => unsub();
    }
  }, [isOpen]);

  const ensureSpreadsheetReady = async () => {
    if (!getGoogleAccessToken()) return;
    setIsInitializingSheet(true);
    try {
      const sheet = await getOrCreateExamSpreadsheet(examConfig.title);
      setSpreadsheetInfo(getStoredSpreadsheetInfo());
    } catch (e) {
      console.warn("Could not pre-initialize spreadsheet:", e);
    } finally {
      setIsInitializingSheet(false);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const info = await getDriveStorageInfo();
      setStorageQuota(info.quota);
      if (info.user) {
        setGoogleUser((prev: any) => ({ ...prev, ...info.user }));
      }
    } catch (e) {
      console.warn("Storage info warning:", e);
    }
  };

  const loadDriveFiles = useCallback(async () => {
    if (!getGoogleAccessToken()) return;
    setIsLoadingFiles(true);
    setActionError(null);
    try {
      const res = await listDriveFiles({
        searchTerm: fileSearchTerm,
        pageSize: 50,
      });
      setDriveFiles(res.files);
    } catch (err: any) {
      setActionError(err.message || "Gagal memuat berkas dari Google Drive");
    } finally {
      setIsLoadingFiles(false);
    }
  }, [fileSearchTerm]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setActionError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setIsSignedIn(true);
        setGoogleUser(result.user);
        await loadStorageInfo();
        await loadDriveFiles();
        await ensureSpreadsheetReady();
      }
    } catch (err: any) {
      setActionError(err.message || "Gagal masuk dengan Google");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setIsSignedIn(false);
    setGoogleUser(null);
    setDriveFiles([]);
    setStorageQuota(null);
  };

  const handleToggleAutoSync = () => {
    const nextVal = !autoSyncActive;
    setAutoSyncActive(nextVal);
    setAutoSyncEnabled(nextVal);
    if (nextVal && isSignedIn) {
      ensureSpreadsheetReady();
    }
  };

  // Sync all submitted students in one click
  const handleSyncAllSubmitted = async () => {
    if (!getGoogleAccessToken()) return;
    setIsSyncingAll(true);
    setActionError(null);
    setUploadSuccess(null);

    try {
      const res = await syncAllSubmittedStudents(
        students,
        examConfig.passingScore,
        examConfig.title
      );
      setSpreadsheetInfo(getStoredSpreadsheetInfo());
      setUploadSuccess(
        `Berhasil menyinkronkan ${res.totalSynced} data siswa ke Google Spreadsheet!`
      );
      await loadDriveFiles();
    } catch (err: any) {
      setActionError(err.message || "Gagal menyinkronkan data ke Google Sheets");
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Perform full database backup to Google Drive
  const handleBackupFullDatabase = async () => {
    if (!getGoogleAccessToken()) return;
    setIsUploading(true);
    setActionError(null);
    setUploadSuccess(null);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `cbt_database_backup_${timestamp}.json`;

      const payload = {
        meta: {
          app: "GusthyPalinPatandaExam",
          version: "2.5",
          exportedAt: new Date().toISOString(),
          totalStudents: students.length,
          totalQuestions: questions.length,
          examTitle: examConfig.title,
        },
        students,
        questions,
        examConfig,
        staffUsers,
      };

      const result = await uploadJsonToDrive({
        fileName,
        data: payload,
        description: `Cadangan Lengkap CBT Database (${students.length} Siswa, ${questions.length} Soal)`,
      });

      setUploadSuccess(`Berhasil dicadangkan ke Google Drive! Nama berkas: ${result.name}`);
      await loadDriveFiles();
      await loadStorageInfo();
    } catch (err: any) {
      setActionError(err.message || "Gagal mengunggah cadangan ke Google Drive");
    } finally {
      setIsUploading(false);
    }
  };

  // Export questions only to Google Drive
  const handleBackupQuestions = async () => {
    if (!getGoogleAccessToken()) return;
    setIsUploading(true);
    setActionError(null);
    setUploadSuccess(null);

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `bank_soal_${examConfig.subject.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.json`;

      const payload = {
        subject: examConfig.subject,
        gradeLevel: examConfig.gradeLevel,
        questionsCount: questions.length,
        exportedAt: new Date().toISOString(),
        questions,
      };

      const result = await uploadJsonToDrive({
        fileName,
        data: payload,
        description: `Bank Soal Mata Pelajaran: ${examConfig.subject}`,
      });

      setUploadSuccess(`Bank Soal berhasil diunggah ke Google Drive: ${result.name}`);
      await loadDriveFiles();
    } catch (err: any) {
      setActionError(err.message || "Gagal mengunggah bank soal ke Google Drive");
    } finally {
      setIsUploading(false);
    }
  };

  // Export student exam results CSV to Google Drive
  const handleBackupResultsCsv = async () => {
    if (!getGoogleAccessToken()) return;
    setIsUploading(true);
    setActionError(null);
    setUploadSuccess(null);

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `rekap_nilai_cbt_${timestamp}.csv`;

      // Build CSV
      const headers = [
        "No",
        "NISN",
        "Nama Siswa",
        "Kelas",
        "Status Ujian",
        "Skor PG",
        "Skor Essay",
        "Nilai Akhir",
        "Pelanggaran",
      ];
      const rows = students.map((s, idx) => [
        idx + 1,
        `"${s.nisn}"`,
        `"${s.name}"`,
        `"${s.className}"`,
        `"${s.examStatus}"`,
        s.mcqScore ?? 0,
        s.essayScore ?? 0,
        s.totalScore ?? 0,
        s.violationsCount ?? 0,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      const result = await uploadTextToDrive({
        fileName,
        content: csvContent,
        mimeType: "text/csv",
        description: `Rekap Nilai Siswa CBT (${students.length} Siswa)`,
      });

      setUploadSuccess(`Rekap Nilai Siswa (.CSV) berhasil disimpan di Google Drive: ${result.name}`);
      await loadDriveFiles();
    } catch (err: any) {
      setActionError(err.message || "Gagal mengunggah rekap nilai ke Google Drive");
    } finally {
      setIsUploading(false);
    }
  };

  // Execute confirmed file deletion (MANDATORY User Confirmation satisfied)
  const handleExecuteDelete = async () => {
    if (!confirmDeleteFile) return;
    setIsDeletingFile(true);
    setActionError(null);
    try {
      await deleteDriveFile(confirmDeleteFile.id);
      setConfirmDeleteFile(null);
      await loadDriveFiles();
      await loadStorageInfo();
    } catch (err: any) {
      setActionError(err.message || "Gagal menghapus berkas dari Google Drive");
    } finally {
      setIsDeletingFile(false);
    }
  };

  // Execute restore from Google Drive file
  const handleExecuteRestore = async () => {
    if (!confirmRestoreFile) return;
    setIsRestoring(true);
    setActionError(null);
    setRestoreSuccess(null);

    try {
      const content = await downloadFileContent(confirmRestoreFile.id);
      const parsed = JSON.parse(content);

      if (!parsed.students && !parsed.questions) {
        throw new Error("Berkas ini bukan format cadangan database CBT yang valid.");
      }

      const success = await onRestoreFullDatabase(parsed);
      if (success) {
        setRestoreSuccess(`Berhasil memulihkan database dari berkas '${confirmRestoreFile.name}'!`);
        setConfirmRestoreFile(null);
      } else {
        throw new Error("Gagal menerapkan pemulihan database.");
      }
    } catch (err: any) {
      setActionError(err.message || "Gagal memulihkan database dari Google Drive");
    } finally {
      setIsRestoring(false);
    }
  };

  // Format bytes helper
  const formatBytes = (bytesStr?: string) => {
    if (!bytesStr) return "-";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "-";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Google Drive &amp; Sheets Integration</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  Auto-Sync Real-time
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sinkronisasi otomatis nilai siswa saat submit ke Google Spreadsheet di folder{" "}
                <span className="font-mono text-amber-300 font-semibold">GPP_CBT_Backups</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Bar / Google Sign In Bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {isSignedIn && googleUser ? (
            <div className="flex items-center space-x-3">
              {googleUser.photoURL || googleUser.photoLink ? (
                <img
                  src={googleUser.photoURL || googleUser.photoLink}
                  alt={googleUser.displayName || "Google User"}
                  className="w-8 h-8 rounded-full border border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                  {(googleUser.displayName || googleUser.email || "G")[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{googleUser.displayName || "Akun Google Terhubung"}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </p>
                <p className="text-[11px] text-slate-400">{googleUser.email || googleUser.emailAddress}</p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-300">
              Sambungkan akun Google Anda untuk mengaktifkan Auto-Sync Real-time ke Google Spreadsheet.
            </div>
          )}

          <div className="flex items-center space-x-2">
            {isSignedIn ? (
              <>
                {storageQuota && (
                  <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {formatBytes(storageQuota.usage)} / {formatBytes(storageQuota.limit)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Akun</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center space-x-2 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isSigningIn ? "Menghubungkan..." : "Masuk dengan Akun Google"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-900 flex space-x-6 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("auto_sync")}
            className={`py-3 text-xs font-bold border-b-2 flex items-center space-x-2 cursor-pointer transition shrink-0 ${
              activeTab === "auto_sync"
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-Sync Real-time (Google Sheets)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`py-3 text-xs font-bold border-b-2 flex items-center space-x-2 cursor-pointer transition shrink-0 ${
              activeTab === "backup"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cadangan Database Lengkap</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("files");
              if (isSignedIn) loadDriveFiles();
            }}
            className={`py-3 text-xs font-bold border-b-2 flex items-center space-x-2 cursor-pointer transition shrink-0 ${
              activeTab === "files"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Semua Berkas di Drive ({driveFiles.length})</span>
          </button>
        </div>

        {/* Notifications */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {uploadSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{uploadSuccess}</span>
            </div>
            <button onClick={() => setUploadSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {restoreSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FolderSync className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>{restoreSuccess}</span>
            </div>
            <button onClick={() => setRestoreSuccess(null)} className="text-indigo-400 hover:text-indigo-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isSignedIn ? (
            <div className="py-12 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 mb-4 shadow-xl">
                <Cloud className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">Hubungkan Google Drive Anda</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Untuk mengaktifkan <strong className="text-emerald-400">Auto-Sync Real-Time</strong> nilai siswa ke
                Google Spreadsheet tanpa ekspor manual, silakan masuk dengan akun Google Anda terlebih dahulu.
              </p>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="mt-6 px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm flex items-center space-x-2.5 shadow-xl transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isSigningIn ? "Menghubungkan..." : "Masuk dengan Akun Google"}</span>
              </button>
            </div>
          ) : activeTab === "auto_sync" ? (
            /* TAB 1: AUTO-SYNC REAL-TIME GOOGLE SHEETS */
            <div className="space-y-6">
              {/* Feature Banner & Switch */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                      <Zap className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white">Auto-Sync Real-Time ke Google Spreadsheet</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${
                            autoSyncActive
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              autoSyncActive ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                            }`}
                          />
                          <span>{autoSyncActive ? "AKTIF REAL-TIME" : "NONAKTIF"}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        Setiap kali siswa menekan tombol <strong className="text-emerald-300">"Selesai Ujian"</strong>,
                        aplikasi secara otomatis menambahkan atau memperbarui baris data nilai siswa (Nama, NISN, Kelas,
                        Nilai PG, Nilai Essay, Total Nilai, dan Waktu Selesai) ke Google Spreadsheet di Drive tanpa perlu ekspor manual.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={handleToggleAutoSync}
                    className={`shrink-0 px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center space-x-2 transition cursor-pointer border ${
                      autoSyncActive
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-600/30"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                  >
                    {autoSyncActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    <span>{autoSyncActive ? "Auto-Sync Nyala" : "Nyalakan Auto-Sync"}</span>
                  </button>
                </div>

                {/* Target Spreadsheet Info Box */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {spreadsheetInfo.name || `Rekap_Nilai_Realtime_${examConfig.title.replace(/\s+/g, "_")}`}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2">
                        <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Folder: GPP_CBT_Backups</span>
                        <span>&bull;</span>
                        <span>{submittedStudents.length} Peserta Selesai</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {spreadsheetInfo.url && (
                      <a
                        href={spreadsheetInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer border border-slate-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Buka di Google Sheets</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={handleSyncAllSubmitted}
                      disabled={isSyncingAll || submittedStudents.length === 0}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin" : ""}`} />
                      <span>
                        {isSyncingAll
                          ? "Menyinkronkan..."
                          : `Sinkronkan Seluruh Siswa Selesai (${submittedStudents.length})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Last Sync Info */}
                {spreadsheetInfo.lastSyncedAt && (
                  <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Terakhir disinkronkan:{" "}
                      <strong className="text-white">{spreadsheetInfo.lastStudent || "Siswa"}</strong> pada{" "}
                      {new Date(spreadsheetInfo.lastSyncedAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Table Preview of Auto-Synced Format */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Format Kolom Google Spreadsheet (A sampai L)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Nilai KKM Kelulusan: <strong className="text-amber-400 font-mono">{examConfig.passingScore}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                  {[
                    "1. No",
                    "2. NISN",
                    "3. Nama Lengkap",
                    "4. Kelas",
                    "5. Nilai PG",
                    "6. Nilai Essay",
                    "7. Total Nilai",
                    "8. Status Ujian",
                    "9. Waktu Selesai",
                    "10. Kelulusan (LULUS/REMIDIAL)",
                    "11. Pelanggaran",
                    "12. Jam Sinkron",
                  ].map((col, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center font-mono text-[11px] text-slate-300"
                    >
                      {col}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Submitted Students Live Queue */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Daftar Siswa yang Telah Selesai Ujian ({submittedStudents.length})
                </h4>
                {submittedStudents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                    Belum ada siswa yang menyelesaikan ujian saat ini. Saat ada siswa yang mengklik "Selesai Ujian",
                    namanya akan otomatis muncul di sini dan disinkronkan ke Google Spreadsheet.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 bg-slate-950/40 max-h-60 overflow-y-auto">
                    {submittedStudents.slice(0, 10).map((st) => (
                      <div
                        key={st.id}
                        className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center font-mono text-[11px]">
                            {st.className.split(" ")[0]}
                          </div>
                          <div>
                            <p className="font-bold text-white">{st.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              NISN: {st.nisn} &bull; Kelas: {st.className}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="font-mono font-bold text-amber-300 text-sm">
                              {st.totalScore ?? 0}
                              <span className="text-[10px] text-slate-400 font-sans ml-1">poin</span>
                            </p>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                (st.totalScore ?? 0) >= examConfig.passingScore
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-rose-500/20 text-rose-300"
                              }`}
                            >
                              {(st.totalScore ?? 0) >= examConfig.passingScore ? "LULUS" : "REMIDIAL"}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>Tersinkron</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "backup" ? (
            /* TAB 2: MANUAL BACKUP */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Full CBT Database Backup */}
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/20">
                      <Database className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Cadangkan Master Database</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Menyimpan seluruh {students.length} peserta, {questions.length} butir soal, sesi ujian aktif, dan konfigurasi server ke folder{" "}
                      <span className="font-mono text-amber-300 font-semibold">GPP_CBT_Backups</span> di Drive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackupFullDatabase}
                    disabled={isUploading}
                    className="mt-4 w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? "Mengunggah..." : "Cadangkan Database Lengkap"}</span>
                  </button>
                </div>

                {/* 2. Questions / Bank Soal */}
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Simpan Paket Bank Soal</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Menyimpan {questions.length} butir soal (Pilihan Ganda &amp; Essay) beserta kunci jawaban dan rubrik penilaian AI ke Google Drive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackupQuestions}
                    disabled={isUploading}
                    className="mt-4 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? "Mengunggah..." : "Simpan Bank Soal"}</span>
                  </button>
                </div>

                {/* 3. Student Results CSV */}
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 transition flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Rekap Nilai Siswa (CSV)</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Mengekspor daftar nilai seluruh {students.length} siswa ke Google Drive dalam format spreadsheet (.csv) siap olah di Google Sheets.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackupResultsCsv}
                    disabled={isUploading}
                    className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? "Mengunggah..." : "Ekspor Rekap Nilai CSV"}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start space-x-3 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Seluruh data yang diunggah tersimpan secara privat di akun Google Drive Anda dalam folder{" "}
                  <strong className="text-white">GPP_CBT_Backups</strong>. Tidak ada pihak ketiga yang dapat mengakses berkas ini tanpa izin Anda.
                </p>
              </div>
            </div>
          ) : (
            /* TAB 3: FILES LIST */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={fileSearchTerm}
                    onChange={(e) => setFileSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadDriveFiles()}
                    placeholder="Cari berkas di Google Drive..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadDriveFiles}
                  disabled={isLoadingFiles}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-2 transition cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? "animate-spin text-amber-400" : ""}`} />
                  <span>Segarkan Berkas</span>
                </button>
              </div>

              {isLoadingFiles ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mb-2" />
                  <span>Memuat daftar berkas dari Google Drive...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
                  <Folder className="w-8 h-8 text-slate-600 mb-2" />
                  <span>Belum ada berkas cadangan ditemukan di Google Drive.</span>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Gunakan tombol cadangkan untuk membuat berkas baru.
                  </span>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 bg-slate-950/40">
                  {driveFiles.map((file) => {
                    const isCbtBackup = file.name.endsWith(".json") && file.name.includes("cbt");
                    const isSpreadsheet =
                      file.mimeType.includes("spreadsheet") || file.name.includes("Spreadsheet") || file.name.endsWith(".csv");
                    return (
                      <div
                        key={file.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition"
                      >
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                            {isSpreadsheet ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                            ) : isCbtBackup ? (
                              <Database className="w-4 h-4 text-amber-400" />
                            ) : (
                              <FileText className="w-4 h-4 text-indigo-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{file.name}</p>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                              <span>{formatBytes(file.size)}</span>
                              <span>&bull;</span>
                              <span>
                                {file.modifiedTime
                                  ? new Date(file.modifiedTime).toLocaleString("id-ID", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "-"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-auto">
                          {isCbtBackup && (
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreFile(file)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer"
                              title="Pulihkan database CBT dari berkas cadangan ini"
                            >
                              <FolderSync className="w-3.5 h-3.5" />
                              <span>Pulihkan</span>
                            </button>
                          )}

                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                              title="Buka di Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Destructive Action Trigger with Mandatory Modal */}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFile(file)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition cursor-pointer border border-rose-500/20"
                            title="Hapus berkas dari Google Drive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Terhubung dengan Google Drive API v3 &amp; Google Sheets API v4.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION MODAL: DELETE FILE */}
      {confirmDeleteFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Hapus Berkas dari Google Drive?</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus berkas{" "}
              <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                {confirmDeleteFile.name}
              </strong>{" "}
              secara permanen dari akun Google Drive Anda? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteFile(null)}
                disabled={isDeletingFile}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeletingFile}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingFile ? "Menghapus..." : "Ya, Hapus Berkas"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY USER CONFIRMATION MODAL: RESTORE DATABASE */}
      {confirmRestoreFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/30">
              <FolderSync className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Pulihkan Database dari Google Drive?</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Memulihkan data dari berkas{" "}
              <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                {confirmRestoreFile.name}
              </strong>{" "}
              akan memperbarui seluruh peserta ujian, bank soal, dan pengaturan CBT dengan data yang tersimpan di cadangan ini.
            </p>
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setConfirmRestoreFile(null)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
              >
                <FolderSync className="w-3.5 h-3.5" />
                <span>{isRestoring ? "Memulihkan..." : "Ya, Terapkan Pemulihan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
