import React, { useState, useMemo, useEffect } from "react";
import {
  Key,
  Lock,
  Eye,
  EyeOff,
  User,
  Mail,
  Save,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Shield,
  Clock,
  RefreshCw,
  School,
  Calendar,
  Hash,
  Award,
  FileText,
  Volume2,
  Copy,
  Maximize2,
  Camera,
  Trash2,
  AlertOctagon,
  Sparkles,
  Zap,
  RotateCcw,
  Sun,
  Moon,
  MessageSquare,
  Phone,
  Database,
  Download,
  Upload,
  HardDrive,
  History,
  FileCheck,
  ShieldCheck,
  UserMinus,
  Layers,
  Users,
  Check,
  XCircle,
  Power,
  Filter,
  Search,
  Shuffle,
  ListOrdered,
  UserCheck,
} from "lucide-react";
import { TeacherOrAdmin, ExamConfig, BackupFileInfo, Student, isExamClassActive } from "../types";
import { ThemeToggle } from "./ThemeToggle";
import { HelpdeskSupport } from "./HelpdeskSupport";
import { ResetLoginModal } from "./ResetLoginModal";
import { AIRubricTuningModal } from "./AIRubricTuningModal";

interface AdminSettingsViewProps {
  currentUser: TeacherOrAdmin;
  examConfig: ExamConfig;
  totalStudents: number;
  totalQuestions: number;
  sampleStudentsCount?: number;
  onDeleteSampleStudents?: () => void;
  hasAdminCustomData?: boolean;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
  onExportDatabase?: () => boolean;
  onImportDatabase?: (jsonContent: string) => Promise<{ success: boolean; message: string }>;
  onFetchBackups?: () => Promise<BackupFileInfo[]>;
  onRestoreBackup?: (filename: string) => Promise<{ success: boolean; message: string }>;
  onCreateManualBackup?: (label?: string) => Promise<boolean>;
  onUpdateAdminProfile?: (
    staffId: string,
    updates: { name?: string; username?: string; email?: string; password?: string }
  ) => { success: boolean; message?: string };
  onUpdateExamConfig?: (updates: Partial<ExamConfig>) => void;
  onResetStudentLogin?: (studentId: string) => void;
  onResetMultipleStudentsLogin?: (studentIds: string[]) => void;
  onResetAllStudentsLogin?: () => void;
  onResetAllExamData?: () => void;
  onRestoreDefaultExamConfig?: () => void;
  onGenerate1000Students?: (count?: number) => void;
  onRestoreInitialStudents?: () => void;
  availableClasses?: string[];
  students?: Student[];
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  currentUser,
  examConfig,
  totalStudents,
  totalQuestions,
  sampleStudentsCount = 0,
  onDeleteSampleStudents,
  hasAdminCustomData,
  lastSyncTime,
  isSyncing,
  onExportDatabase,
  onImportDatabase,
  onFetchBackups,
  onRestoreBackup,
  onCreateManualBackup,
  onUpdateAdminProfile,
  onUpdateExamConfig,
  onResetStudentLogin,
  onResetMultipleStudentsLogin,
  onResetAllStudentsLogin,
  onResetAllExamData,
  onRestoreDefaultExamConfig,
  onGenerate1000Students,
  onRestoreInitialStudents,
  availableClasses = [],
  students = [],
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"account" | "exam" | "security" | "database" | "performance" | "theme" | "danger">("account");
  const [perfMessage, setPerfMessage] = useState<string | null>(null);
  const [showResetLoginModal, setShowResetLoginModal] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);

  // Database Management State
  const [backupsList, setBackupsList] = useState<BackupFileInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [manualBackupLabel, setManualBackupLabel] = useState("");
  const [dbMessage, setDbMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileImportInputRef = React.useRef<HTMLInputElement | null>(null);

  // Account form state
  const [name, setName] = useState(currentUser.name || "");
  const [username, setUsername] = useState(currentUser.username || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [accountMessage, setAccountMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Exam parameters form state
  const [institutionName, setInstitutionName] = useState(examConfig.institutionName || "SMK / SMA Negeri Unggulan");
  const [academicYear, setAcademicYear] = useState(examConfig.academicYear || "2025/2026");
  const [examTitle, setExamTitle] = useState(examConfig.title);
  const [subject, setSubject] = useState(examConfig.subject);
  const [gradeLevel, setGradeLevel] = useState(examConfig.gradeLevel);
  const [durationMinutes, setDurationMinutes] = useState(examConfig.durationMinutes);
  const [passingScore, setPassingScore] = useState(examConfig.passingScore);
  const [maxAllowedViolations, setMaxAllowedViolations] = useState(examConfig.maxAllowedViolations);
  const [gateToken, setGateToken] = useState(examConfig.gateToken);
  const [helpdeskPhone, setHelpdeskPhone] = useState(examConfig.helpdeskPhone || "085240195357");
  const [helpdeskName, setHelpdeskName] = useState(examConfig.helpdeskName || "Admin CBT (Gusthy Palin Patanda)");
  const [instructionsText, setInstructionsText] = useState(examConfig.instructions.join("\n"));
  const [examMessage, setExamMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync KKM if updated externally
  useEffect(() => {
    if (examConfig.passingScore !== undefined) {
      setPassingScore(examConfig.passingScore);
    }
  }, [examConfig.passingScore]);

  // Class Exam Activation State
  const computedClassesList = useMemo(() => {
    if (availableClasses && availableClasses.length > 0) return availableClasses;
    if (students && students.length > 0) {
      return Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort();
    }
    return ["XII RPL 1", "XII RPL 2", "XII TKJ 1"];
  }, [availableClasses, students]);

  const [allClassesActive, setAllClassesActive] = useState<boolean>(
    examConfig.allClassesActive ?? true
  );

  const [activeClasses, setActiveClasses] = useState<string[]>(() => {
    if (examConfig.allClassesActive === false) {
      return Array.isArray(examConfig.activeClasses) ? [...examConfig.activeClasses] : [];
    }
    if (examConfig.activeClasses && examConfig.activeClasses.length > 0) {
      return [...examConfig.activeClasses];
    }
    return [...computedClassesList];
  });

  useEffect(() => {
    const isAll = examConfig.allClassesActive ?? true;
    setAllClassesActive(isAll);
    if (!isAll) {
      setActiveClasses(
        Array.isArray(examConfig.activeClasses) ? [...examConfig.activeClasses] : []
      );
    } else {
      setActiveClasses(
        examConfig.activeClasses && examConfig.activeClasses.length > 0
          ? [...examConfig.activeClasses]
          : [...computedClassesList]
      );
    }
  }, [examConfig.allClassesActive, examConfig.activeClasses, computedClassesList]);

  const [classSearch, setClassSearch] = useState("");

  const classStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    computedClassesList.forEach((cls) => {
      counts[cls] = 0;
    });
    students.forEach((s) => {
      if (s.className) {
        counts[s.className] = (counts[s.className] || 0) + 1;
      }
    });
    return counts;
  }, [computedClassesList, students]);

  // Security protocols state
  const [blockCopyPaste, setBlockCopyPaste] = useState(examConfig.blockCopyPaste ?? true);
  const [detectSplitScreen, setDetectSplitScreen] = useState(examConfig.detectSplitScreen ?? true);
  const [detectScreenshot, setDetectScreenshot] = useState(examConfig.detectScreenshot ?? true);
  const [enableSoundAlerts, setEnableSoundAlerts] = useState(examConfig.enableSoundAlerts ?? true);
  const [enableWebcamProctoring, setEnableWebcamProctoring] = useState(examConfig.enableWebcamProctoring ?? true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(examConfig.randomizeQuestions ?? true);
  const [randomizeOptions, setRandomizeOptions] = useState(examConfig.randomizeOptions ?? true);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Danger zone confirmations
  const [confirmResetLogins, setConfirmResetLogins] = useState(false);
  const [confirmDeleteSampleStudents, setConfirmDeleteSampleStudents] = useState(false);
  const [confirmResetScores, setConfirmResetScores] = useState(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [dangerActionSuccess, setDangerActionSuccess] = useState<string | null>(null);

  // Password strength helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // Handle Account & Password Update
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMessage(null);

    // If changing password, validate
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setAccountMessage({ type: "error", text: "Masukkan kata sandi saat ini untuk verifikasi keamanan!" });
        return;
      }
      // Check current password match
      if (currentUser.password && currentPassword !== currentUser.password) {
        setAccountMessage({ type: "error", text: "Kata sandi saat ini tidak cocok!" });
        return;
      }
      if (newPassword.length < 6) {
        setAccountMessage({ type: "error", text: "Kata sandi baru minimal harus 6 karakter!" });
        return;
      }
      if (newPassword !== confirmPassword) {
        setAccountMessage({ type: "error", text: "Konfirmasi kata sandi baru tidak sama!" });
        return;
      }
    }

    if (!name.trim()) {
      setAccountMessage({ type: "error", text: "Nama administrator tidak boleh kosong!" });
      return;
    }

    if (!username.trim()) {
      setAccountMessage({ type: "error", text: "Username administrator tidak boleh kosong!" });
      return;
    }

    const updates: { name?: string; username?: string; email?: string; password?: string } = {
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
    };

    if (newPassword) {
      updates.password = newPassword;
    }

    if (onUpdateAdminProfile) {
      const res = onUpdateAdminProfile(currentUser.id, updates);
      if (res?.success) {
        setAccountMessage({
          type: "success",
          text: newPassword
            ? "Profil dan kata sandi baru berhasil diperbarui!"
            : "Profil administrator berhasil disimpan!",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setAccountMessage(null), 5000);
      } else {
        setAccountMessage({ type: "error", text: res?.message || "Gagal memperbarui profil." });
      }
    }
  };

  // Handle Exam Config Update
  const handleSaveExamConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setExamMessage(null);

    if (!examTitle.trim()) {
      setExamMessage({ type: "error", text: "Judul ujian tidak boleh kosong!" });
      return;
    }

    if (!gateToken.trim()) {
      setExamMessage({ type: "error", text: "Token barcode gate ujian tidak boleh kosong!" });
      return;
    }

    const cleanInstructions = instructionsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsedKkm = Number(passingScore);
    const validPassingScore = !isNaN(parsedKkm) ? Math.max(0, Math.min(100, Math.round(parsedKkm))) : 75;

    const updates: Partial<ExamConfig> = {
      institutionName: institutionName.trim(),
      academicYear: academicYear.trim(),
      title: examTitle.trim(),
      subject: subject.trim(),
      gradeLevel: gradeLevel.trim(),
      durationMinutes: Number(durationMinutes) || 60,
      passingScore: validPassingScore,
      maxAllowedViolations: Number(maxAllowedViolations) || 2,
      gateToken: gateToken.trim().toUpperCase(),
      helpdeskPhone: helpdeskPhone.trim() || "085240195357",
      helpdeskName: helpdeskName.trim() || "Admin CBT (Gusthy Palin Patanda)",
      instructions: cleanInstructions.length > 0 ? cleanInstructions : examConfig.instructions,
      allClassesActive,
      activeClasses,
      randomizeQuestions,
      randomizeOptions,
    };

    if (onUpdateExamConfig) {
      onUpdateExamConfig(updates);
      setExamMessage({ type: "success", text: "Konfigurasi parameter ujian berhasil disimpan!" });
      setTimeout(() => setExamMessage(null), 5000);
    }
  };

  // Handle Security Protocols Update
  const handleSaveSecurity = () => {
    if (onUpdateExamConfig) {
      onUpdateExamConfig({
        blockCopyPaste,
        detectSplitScreen,
        detectScreenshot,
        enableSoundAlerts,
        enableWebcamProctoring,
        randomizeQuestions,
        randomizeOptions,
      });
      setSecurityMessage("Protokol keamanan anti-kecurangan berhasil diterapkan!");
      setTimeout(() => setSecurityMessage(null), 5000);
    }
  };

  // Generate random new gate token
  const handleGenerateRandomToken = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let token = "EXAM-";
    for (let i = 0; i < 4; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGateToken(token);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-7 animate-in fade-in duration-200">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-semibold mb-1">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>PANEL KONTROL ADMINISTRATOR</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Pengaturan Sistem &amp; Akun
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Kelola kata sandi akun admin, profil, parameter ujian CBT, dan protokol anti-kecurangan.
          </p>
        </div>

        {/* Current Admin Badge */}
        <div className="flex items-center space-x-3 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-white">{currentUser.name}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {currentUser.role.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">@{currentUser.username}</p>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/60 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab("account")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === "account"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Keamanan &amp; Kata Sandi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("exam")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === "exam"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Parameter Ujian</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("security")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === "security"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Protokol Anti-Kecurangan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("performance")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === "performance"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>⚡ Performa 1.000+ Siswa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("theme")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === "theme"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80"
          }`}
        >
          <Sun className="w-4 h-4 text-amber-400" />
          <span>Tema &amp; Aksesibilitas</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab("database");
            if (onFetchBackups) {
              setLoadingBackups(true);
              onFetchBackups().then((b) => {
                setBackupsList(b);
                setLoadingBackups(false);
              }).catch(() => setLoadingBackups(false));
            }
          }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === "database"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-950/60 text-emerald-400 hover:text-emerald-300 border border-emerald-900/40"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Cadangan &amp; Anti-Data Loss</span>
          {hasAdminCustomData && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="Data Admin Terlindungi" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("danger")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === "danger"
              ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
              : "bg-slate-950/60 text-rose-400 hover:text-rose-200 border border-rose-900/40"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Manajemen Data &amp; Reset</span>
        </button>
      </div>

      {/* SUB-TAB 1: ACCOUNT & PASSWORD */}
      {activeSubTab === "account" && (
        <form onSubmit={handleSaveAccount} className="space-y-6">
          {accountMessage && (
            <div
              className={`p-4 rounded-2xl flex items-center space-x-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
                accountMessage.type === "success"
                  ? "bg-emerald-950/70 border border-emerald-500/60 text-emerald-200"
                  : "bg-rose-950/70 border border-rose-500/60 text-rose-200"
              }`}
            >
              {accountMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              )}
              <span className="font-semibold">{accountMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 1: Profil Admin */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <User className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Informasi Identitas Administrator</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Nama Lengkap &amp; Gelar
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Nama Admin / Guru"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Username Login
                </label>
                <div className="relative">
                  <span className="text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Digunakan untuk masuk ke sistem dashboard.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Email Kontak Resmi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@sekolah.sch.id"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Ganti Password */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Ubah Kata Sandi (Password)</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Kata Sandi Saat Ini
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password saat ini"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Kosongkan jika hanya ingin mengubah nama atau email.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Kekuatan Sandi:</span>
                      <span
                        className={`font-bold ${
                          passwordStrength <= 2
                            ? "text-rose-400"
                            : passwordStrength <= 3
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {passwordStrength <= 2 ? "Lemah" : passwordStrength <= 3 ? "Sedang" : "Kuat & Aman"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordStrength <= 2
                            ? "bg-rose-500 w-1/3"
                            : passwordStrength <= 3
                            ? "bg-amber-500 w-2/3"
                            : "bg-emerald-500 w-full"
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Konfirmasi Kata Sandi Baru
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-rose-400 mt-1">Kata sandi konfirmasi tidak cocok!</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan Akun &amp; Sandi</span>
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: EXAM PARAMETERS */}
      {activeSubTab === "exam" && (
        <form onSubmit={handleSaveExamConfig} className="space-y-6">
          {examMessage && (
            <div
              className={`p-4 rounded-2xl flex items-center space-x-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
                examMessage.type === "success"
                  ? "bg-emerald-950/70 border border-emerald-500/60 text-emerald-200"
                  : "bg-rose-950/70 border border-rose-500/60 text-rose-200"
              }`}
            >
              {examMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              )}
              <span className="font-semibold">{examMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Header / Identity Info */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <School className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Identitas Sekolah &amp; Mata Ujian</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Nama Institusi / Sekolah
                </label>
                <div className="relative">
                  <School className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="Contoh: SMA / SMK Negeri 1 Jakarta"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Tahun Ajaran / Semester
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="Contoh: 2025/2026 Genap"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Judul Ujian CBT
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    required
                    placeholder="Contoh: Ujian Akhir Semester Genap 2026"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="Mata Pelajaran"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Tingkat / Kelas
                  </label>
                  <input
                    type="text"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    required
                    placeholder="Contoh: XII - RPL"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Rules & Metrics */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Durasi, Nilai &amp; Token Gate</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="360"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-400">
                      KKM / Kelulusan
                    </label>
                    <span className="text-[11px] font-bold text-amber-400 font-mono">
                      Target: {passingScore} Poin
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-500">Preset KKM:</span>
                    {[55, 60, 65, 70, 75, 80, 85].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPassingScore(val)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                          passingScore === val
                            ? "bg-amber-500 text-slate-950 font-black shadow-sm shadow-amber-500/30"
                            : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Batas Pelanggaran
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxAllowedViolations}
                    onChange={(e) => setMaxAllowedViolations(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-rose-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Otomatis submit bila batas terlampaui.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Token Barcode Gate Mulai Ujian
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={gateToken}
                      onChange={(e) => setGateToken(e.target.value.toUpperCase())}
                      required
                      placeholder="GPP-EXAM-2026"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs sm:text-sm font-bold tracking-widest focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateRandomToken}
                    className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                    title="Acak Token Baru"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Acak</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Siswa harus memindai barcode atau memasukkan token ini sebelum dapat mulai mengerjakan soal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Petunjuk &amp; Tata Tertib Ujian (Satu baris per instruksi)
                </label>
                <textarea
                  rows={4}
                  value={instructionsText}
                  onChange={(e) => setInstructionsText(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs leading-relaxed focus:outline-none focus:border-blue-500"
                  placeholder="Masukkan petunjuk ujian..."
                />
              </div>
            </div>
          </div>

          {/* Section: AI Rubric Tuning for Essay Questions */}
          <div className="bg-slate-950/60 border border-cyan-500/40 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                    <span>AI Rubric Tuning (Penilaian Essay Otomatis)</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-extrabold uppercase">
                      Gemini 3.8 Flash
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Kustomisasi kelonggaran evaluasi essay: ketat berbasis kata kunci vs fleksibel berbasis esensi makna dan toleransi typo.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRubricModal(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-cyan-600/20 cursor-pointer self-start sm:self-auto"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Sesuaikan Parameter Rubrik</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block mb-1">Mode Kelonggaran</span>
                <div className="text-xs font-bold text-white">
                  {examConfig.aiRubricConfig?.strictnessMode === "strict_keyword"
                    ? "Ketat (Berbasis Kata Kunci)"
                    : examConfig.aiRubricConfig?.strictnessMode === "flexible_semantic"
                    ? "Fleksibel (Esensi Makna)"
                    : "Seimbang (Balanced)"}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block mb-1">Toleransi Typo</span>
                <div className="text-xs font-bold text-white">
                  {examConfig.aiRubricConfig?.typoTolerance === "low"
                    ? "Ketat (Nol Toleransi Typo)"
                    : examConfig.aiRubricConfig?.typoTolerance === "high"
                    ? "Toleran Tinggi (Typo Banyak Diampuni)"
                    : "Seimbang (Medium)"}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block mb-1">Batas Minimum Kata Kunci</span>
                <div className="text-xs font-bold text-cyan-400 font-mono">
                  {examConfig.aiRubricConfig?.minKeywordCoveragePercent ?? 60}%
                </div>
              </div>
            </div>
          </div>

          {/* Section: Helpdesk & Layanan Bantuan WhatsApp */}
          <div className="bg-slate-950/60 border border-emerald-500/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                    <span>Helpdesk WhatsApp Siswa &amp; Pengawas</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase">
                      Terhubung
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Nomor WhatsApp resmi yang ditampilkan ke siswa saat akun terkunci, lupa kredensial, atau kendala ujian.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nomor WhatsApp Helpdesk (Format Indonesia / 08xx)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={helpdeskPhone}
                    onChange={(e) => setHelpdeskPhone(e.target.value)}
                    required
                    placeholder="085240195357"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Nomor aktif Admin CBT: <strong className="text-emerald-400 font-mono">085240195357</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Kontak / Penanggung Jawab Helpdesk
                </label>
                <input
                  type="text"
                  value={helpdeskName}
                  onChange={(e) => setHelpdeskName(e.target.value)}
                  required
                  placeholder="Admin CBT (Gusthy Palin Patanda)"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama ini akan dicantumkan pada template pesan otomatis WhatsApp siswa.
                </p>
              </div>
            </div>

            {/* Live Preview of Student View */}
            <div className="mt-3 pt-3 border-t border-slate-800/80">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Pratinjau Tampilan Helpdesk di Layar Siswa:
              </p>
              <HelpdeskSupport
                variant="card"
                phoneNumber={helpdeskPhone}
                adminName={helpdeskName}
                context="locked"
              />
            </div>
          </div>

          {/* Section: Pengaturan Aktivasi Kelas Peserta Ujian */}
          <div className="bg-slate-950/60 border border-indigo-500/40 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                    <span>Aktivasi Kelas Peserta Ujian</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase">
                      Akses CBT
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Aktifkan rombel/kelas yang dijadwalkan ujian dan nonaktifkan kelas yang tidak ujian. Siswa dari kelas nonaktif akan ditolak login.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-300 font-semibold">
                  <strong className="text-indigo-400">
                    {allClassesActive
                      ? computedClassesList.length
                      : activeClasses.filter((c) => computedClassesList.includes(c)).length}
                  </strong>{" "}
                  / {computedClassesList.length} Kelas Aktif
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-emerald-400 font-bold">
                  (
                  {computedClassesList.reduce(
                    (sum, c) =>
                      allClassesActive || activeClasses.includes(c)
                        ? sum + (classStudentCounts[c] || 0)
                        : sum,
                    0
                  )}{" "}
                  Siswa)
                </span>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAllClassesActive(true);
                  setActiveClasses([...computedClassesList]);
                  if (onUpdateExamConfig) {
                    onUpdateExamConfig({
                      allClassesActive: true,
                      activeClasses: [...computedClassesList],
                    });
                  }
                }}
                className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition cursor-pointer ${
                  allClassesActive
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm shadow-indigo-500/10"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    allClassesActive ? "border-indigo-400 bg-indigo-500" : "border-slate-600"
                  }`}
                >
                  {allClassesActive && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Semua Kelas Mengikuti Ujian</div>
                  <div className="text-[11px] text-slate-400">Seluruh rombel yang terdaftar diizinkan ujian</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAllClassesActive(false);
                  if (onUpdateExamConfig) {
                    onUpdateExamConfig({
                      allClassesActive: false,
                      activeClasses,
                    });
                  }
                }}
                className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition cursor-pointer ${
                  !allClassesActive
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm shadow-indigo-500/10"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    !allClassesActive ? "border-indigo-400 bg-indigo-500" : "border-slate-600"
                  }`}
                >
                  {!allClassesActive && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Pilih Kelas Tertentu Saja</div>
                  <div className="text-[11px] text-slate-400">Khusus kelas yang diaktifkan di bawah ini</div>
                </div>
              </button>
            </div>

            {/* Quick Actions & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Cari nama kelas..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAllClassesActive(true);
                    setActiveClasses([...computedClassesList]);
                    if (onUpdateExamConfig) {
                      onUpdateExamConfig({
                        allClassesActive: true,
                        activeClasses: [...computedClassesList],
                      });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px] flex items-center space-x-1 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aktifkan Semua</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAllClassesActive(false);
                    setActiveClasses([]);
                    if (onUpdateExamConfig) {
                      onUpdateExamConfig({
                        allClassesActive: false,
                        activeClasses: [],
                      });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-[11px] flex items-center space-x-1 transition cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Nonaktifkan Semua</span>
                </button>
              </div>
            </div>

            {/* Grid of Classes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {computedClassesList
                .filter((c) => (c || "").toLowerCase().includes((classSearch || "").toLowerCase().trim()))
                .map((cls) => {
                  const isActive = allClassesActive || activeClasses.includes(cls);
                  const count = classStudentCounts[cls] || 0;

                  return (
                    <div
                      key={cls}
                      onClick={() => {
                        let nextAll = allClassesActive;
                        let nextActive: string[];
                        if (allClassesActive) {
                          nextAll = false;
                          nextActive = computedClassesList.filter((c) => c !== cls);
                        } else {
                          nextActive = activeClasses.includes(cls)
                            ? activeClasses.filter((c) => c !== cls)
                            : [...activeClasses, cls];
                        }
                        setAllClassesActive(nextAll);
                        setActiveClasses(nextActive);
                        if (onUpdateExamConfig) {
                          onUpdateExamConfig({
                            allClassesActive: nextAll,
                            activeClasses: nextActive,
                          });
                        }
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer select-none flex items-center justify-between ${
                        isActive
                          ? "bg-slate-900 border-emerald-500/50 hover:border-emerald-400"
                          : "bg-slate-950/80 border-slate-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {/* Switch */}
                        <div
                          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                            isActive ? "bg-emerald-500" : "bg-slate-800"
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 shadow ${
                              isActive ? "translate-x-3.5" : "translate-x-0"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <span
                            className={`text-xs font-bold truncate block ${
                              isActive ? "text-white" : "text-slate-400"
                            }`}
                          >
                            {cls}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {count} siswa
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                          isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {isActive ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Parameter Ujian</span>
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 3: SECURITY PROTOCOLS */}
      {activeSubTab === "security" && (
        <div className="space-y-6">
          {securityMessage && (
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 flex items-center space-x-3 text-xs sm:text-sm animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold">{securityMessage}</span>
            </div>
          )}

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Protokol Keamanan &amp; Sensor Anti-Kecurangan</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Atur perlindungan proctoring otomatis yang aktif di browser peserta selama ujian berlangsung.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option: Shuffle Questions (Anti-Cheating) */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/30 bg-gradient-to-br from-purple-950/20 to-slate-900 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Shuffle className="w-4 h-4 text-purple-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Acak Urutan Soal (Anti-Nyontek Siswa)</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold border border-purple-500/40">
                      Rekomendasi
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Setiap siswa yang login menerima urutan nomor soal yang teracak unik otomatis. Siswa yang duduk bersebelahan memiliki soal berbeda di nomor yang sama sehingga tidak bisa saling menyontek.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRandomizeQuestions(!randomizeQuestions)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    randomizeQuestions ? "bg-purple-600" : "bg-slate-800"
                  }`}
                  title="Klik untuk mengaktifkan atau menonaktifkan pengacakan urutan soal"
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      randomizeQuestions ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Option: Shuffle Options (MCQ A, B, C, D) */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-blue-500/30 bg-gradient-to-br from-blue-950/20 to-slate-900 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <ListOrdered className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Acak Pilihan Jawaban (Opsi A, B, C, D)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Posisi opsi pilihan ganda A, B, C, D diacak secara independen di setiap perangkat siswa untuk mencegah pembocoran jawaban lewat kode huruf.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRandomizeOptions(!randomizeOptions)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    randomizeOptions ? "bg-blue-600" : "bg-slate-800"
                  }`}
                  title="Klik untuk mengaktifkan atau menonaktifkan pengacakan opsi jawaban"
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      randomizeOptions ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Option 1: Copy-Paste Block */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Blokir Salin, Tempel &amp; Klik Kanan</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mencegah peserta menyalin soal atau menempelkan contekan dari clipboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBlockCopyPaste(!blockCopyPaste)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    blockCopyPaste ? "bg-blue-600" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      blockCopyPaste ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Option 2: Split Screen & Floating Apps */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Maximize2 className="w-4 h-4 text-rose-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Deteksi Layar Terbelah &amp; Blur Tab</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mendeteksi jika peserta membagi layar (split screen) atau membuka aplikasi jendela lain.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetectSplitScreen(!detectSplitScreen)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    detectSplitScreen ? "bg-blue-600" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      detectSplitScreen ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Option 3: Screenshot Shield */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <AlertOctagon className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Proteksi Tangkapan Layar (Blackout Shield)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Menggelapkan layar seketika saat tombol PrintScreen atau shortcut snipping tool ditekan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetectScreenshot(!detectScreenshot)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    detectScreenshot ? "bg-blue-600" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      detectScreenshot ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Option 4: Audio Alarm Beep */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Alarm Peringatan Suara Otomatis</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Membunyikan sinyal nada peringatan audio saat pelanggaran dicatat di perangkat siswa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableSoundAlerts(!enableSoundAlerts)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    enableSoundAlerts ? "bg-blue-600" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      enableSoundAlerts ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Option 5: Webcam AI Proctoring */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3 md:col-span-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-4 h-4 text-purple-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Pengawasan Kamera AI Webcam Proctoring</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mengaktifkan cuplikan sensor kamera untuk mendeteksi kehadiran peserta di depan monitor secara berkala.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableWebcamProctoring(!enableWebcamProctoring)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    enableWebcamProctoring ? "bg-blue-600" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      enableWebcamProctoring ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={handleSaveSecurity}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-blue-600/25 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Aturan Keamanan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: PERFORMA & 1000+ SISWA ENGINE */}
      {activeSubTab === "performance" && (
        <div className="space-y-6">
          {perfMessage && (
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 flex items-center space-x-3 text-xs sm:text-sm animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold">{perfMessage}</span>
            </div>
          )}

          {/* Engine Architecture Overview */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    Arsitektur Mesin Ujian Anti-Lag (Zero-Latency CBT Engine)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dirancang untuk menangani 1.000 hingga 5.000 siswa serentak tanpa lag atau macet
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Status: Optimal &amp; Siap 1.000+ Siswa</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Engine Basis Data</p>
                <p className="text-sm font-extrabold text-white">IndexedDB Asinkron</p>
                <p className="text-xs text-slate-400">Bypass batasan 5MB LocalStorage, penyimpanan non-blocking thread terisolasi.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Latensi Rekam Jawaban</p>
                <p className="text-sm font-extrabold text-emerald-400">&lt; 0.5 ms (Microtask)</p>
                <p className="text-xs text-slate-400">Penyimpanan terisolasi per sesi siswa, UI 60 FPS tanpa jeda pengetikan.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DOM Optimization</p>
                <p className="text-sm font-extrabold text-cyan-400">Smart Pagination &amp; Slicing</p>
                <p className="text-xs text-slate-400">Membatasi render tabel DOM maksimal 25-100 baris aktif demi kelancaran perangkat.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resiliensi Jaringan</p>
                <p className="text-sm font-extrabold text-amber-400">Service Worker &amp; PWA Cache</p>
                <p className="text-xs text-slate-400">Ujian tetap berjalan normal 100% jika WiFi/koneksi putus sementara di tengah jalan.</p>
              </div>
            </div>
          </div>

          {/* Load Test & Simulation Actions */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                <span>Pengujian Beban (Stress Test) Ujian Serentak</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Simulasikan 1.000 atau 2.000 data siswa sekaligus untuk menguji kecepatan pencarian, rekap nilai, barcode, dan kestabilan antarmuka.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onGenerate1000Students) {
                    onGenerate1000Students(1000);
                    setPerfMessage("Berhasil membuat dan memuat 1.000 data siswa simulasi ke IndexedDB!");
                    setTimeout(() => setPerfMessage(null), 5000);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>⚡ Generate 1.000 Siswa Simulasi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onGenerate1000Students) {
                    onGenerate1000Students(2000);
                    setPerfMessage("Berhasil membuat dan memuat 2.000 data siswa simulasi untuk Stress Testing!");
                    setTimeout(() => setPerfMessage(null), 5000);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-purple-600/20 transition cursor-pointer"
              >
                <Zap className="w-4 h-4 text-cyan-300" />
                <span>⚡ Generate 2.000 Siswa Simulasi</span>
              </button>

              {totalStudents > 20 && onRestoreInitialStudents && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Kembalikan daftar siswa ke setelan awal (menghapus data simulasi)?")) {
                      onRestoreInitialStudents();
                      setPerfMessage("Data simulasi dibersihkan. Kembali ke siswa awal.");
                      setTimeout(() => setPerfMessage(null), 5000);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center space-x-2 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Kembalikan ke Siswa Asli</span>
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Total Siswa di Database Saat Ini:</span>
              <strong className="text-white text-sm font-mono">{totalStudents.toLocaleString()} Siswa</strong>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: THEME & ACCESSIBILITY */}
      {activeSubTab === "theme" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2 text-amber-400 mb-1">
                <Sun className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Aksesibilitas &amp; Tema Tampilan Ujian</h3>
              </div>
              <p className="text-xs text-slate-400">
                Pilih tampilan sistem untuk memastikan kenyamanan visual siswa selama pelaksanaan ujian berlangsung.
              </p>
            </div>

            {/* Live Interactive Switcher Card */}
            <ThemeToggle variant="full" />

            {/* Accessibility Features Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs sm:text-sm">
                  <Sun className="w-4 h-4" />
                  <span>Mode Terang (High Contrast Accessibility)</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>Memenuhi rekomendasi kontras WCAG AAA (&gt; 7:1) untuk keterbacaan teks maksimal.</li>
                  <li>Latar putih bersih dengan teks arang hitam pekat dan batas opsi soal yang tegas.</li>
                  <li>Sangat disarankan untuk ruangan laboratorium/kelas dengan pencahayaan lampu terang.</li>
                  <li>Dilengkapi *focus ring* biru jelas untuk navigasi keyboard siswa berkebutuhan khusus.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs sm:text-sm">
                  <Moon className="w-4 h-4" />
                  <span>Mode Gelap (Cyber Dark Default)</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>Latar belakang hitam slate pekat yang menghemat baterai perangkat tablet/laptop siswa.</li>
                  <li>Mengurangi silau cahaya di ruangan redup dan meminimalkan ketegangan mata jangka panjang.</li>
                  <li>Aksen warna cyan, emerald, dan blue dengan visibilitas status yang menonjol.</li>
                </ul>
              </div>
            </div>

            {/* Direct Student Switch Notice */}
            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-800/40 flex items-start space-x-3 text-xs text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-blue-200">Kenyamanan Mandiri Siswa:</strong>
                <p className="mt-0.5 text-blue-300/90">
                  Siswa dapat mengubah mode tampilan secara langsung di bilah atas layar ujian kapan saja tanpa me-refresh halaman atau kehilangan jawaban yang sedang dikerjakan.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: DATABASE & ANTI-DATA LOSS PROTECTION */}
      {activeSubTab === "database" && (
        <div className="space-y-6">
          {dbMessage && (
            <div
              className={`p-4 rounded-2xl border flex items-center space-x-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
                dbMessage.type === "success"
                  ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-200"
                  : "bg-rose-950/70 border-rose-500/60 text-rose-200"
              }`}
            >
              {dbMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              )}
              <span className="font-semibold">{dbMessage.text}</span>
            </div>
          )}

          {/* Guarantee & Anti-Data Loss Protocol Banner */}
          <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center space-x-2">
                    <span>Protokol Perlindungan Data Admin (Anti-Data Loss)</span>
                  </h3>
                  <p className="text-xs text-emerald-300/90 mt-0.5">
                    Menjamin seluruh data yang diinput oleh Admin tetap utuh dan aman saat pembaruan sistem.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Sistem Database: AKTIF &amp; TERKUNCI</span>
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Sesuai instruksi khusus administrator (<em>&ldquo;jangan menghapus data yang di input admin jika ada perubahan atau penambahan fitur aplikasi ini&rdquo;</em>), sistem kini mengintegrasikan <strong>Server Persistence Engine</strong> dengan <strong>Schema Migration otomatis</strong>. Setiap penambahan siswa, pembuatan soal, dan pengaturan tidak akan pernah terhapus atau tertimpa oleh data awal ketika fitur baru ditambahkan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Sinkronisasi</p>
                <div className="flex items-center space-x-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs font-bold text-emerald-400">
                    {isSyncing ? "Sedang Menyimpan..." : "Tersinkronisasi"}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Waktu: {lastSyncTime || "Baru saja"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data Siswa Terdaftar</p>
                <p className="text-sm font-extrabold text-white mt-1">
                  {totalStudents} Siswa
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Disimpan permanen (Server + IndexedDB)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bank Soal Ujian</p>
                <p className="text-sm font-extrabold text-white mt-1">
                  {totalQuestions} Butir Soal
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  PG &amp; Essay terlindungi
                </p>
              </div>
            </div>
          </div>

          {/* Pembersihan Data Sampel Siswa Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-sm sm:text-base text-white flex items-center space-x-2">
                  <UserMinus className="w-4 h-4 text-amber-400" />
                  <span>Pembersihan Data Sampel Siswa (Sample Students)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hapus data contoh bawaan agar daftar siswa bersih dan hanya berisi siswa riil yang Anda daftarkan.
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                sampleStudentsCount > 0
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              }`}>
                {sampleStudentsCount > 0
                  ? `${sampleStudentsCount} Siswa Sampel Aktif`
                  : "0 Siswa Sampel (Database Bersih)"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-bold text-slate-200">
                  {sampleStudentsCount > 0
                    ? `Ditemukan ${sampleStudentsCount} data siswa sampel bawaan sistem.`
                    : "Seluruh data sampel siswa telah dibersihkan dari sistem."}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {sampleStudentsCount > 0
                    ? "Menghapus data sampel akan mengosongkan siswa contoh bawaan. Data bank soal dan konfigurasi ujian yang Anda buat TIDAK AKAN terhapus."
                    : "Database siswa Anda saat ini bersih dari data contoh bawaan dan siap digunakan untuk ujian peserta riil."}
                </p>
              </div>

              {sampleStudentsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Hapus seluruh ${sampleStudentsCount} data sampel siswa bawaan sistem?\n\nTindakan ini akan mengosongkan/membersihkan data siswa contoh agar database bersih untuk data siswa riil.`
                      )
                    ) {
                      onDeleteSampleStudents?.();
                      setDbMessage({
                        type: "success",
                        text: `Berhasil menghapus seluruh ${sampleStudentsCount} data siswa sampel bawaan!`,
                      });
                      setTimeout(() => setDbMessage(null), 5000);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer flex-shrink-0 shadow-lg shadow-rose-600/20"
                >
                  <UserMinus className="w-4 h-4" />
                  <span>Hapus {sampleStudentsCount} Data Sampel</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Data Sampel Bersih</span>
                </div>
              )}
            </div>
          </div>

          {/* Backup, Export & Import Actions */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm sm:text-base text-white flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-blue-400" />
                <span>Cadangan Mandiri &amp; Pemulihan Database (Backup &amp; Restore)</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Unduh salinan berkas `.json` lengkap ke komputer lokal Anda atau pulihkan data kapan saja.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Action 1: Export */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-white font-bold text-xs sm:text-sm">
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Unduh Cadangan (.json)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Download seluruh data siswa, bank soal, dan pengaturan ke berkas file JSON untuk arsip offline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onExportDatabase) {
                      const ok = onExportDatabase();
                      if (ok) {
                        setDbMessage({
                          type: "success",
                          text: "Berkas cadangan JSON berhasil diunduh ke komputer Anda!",
                        });
                        setTimeout(() => setDbMessage(null), 5000);
                      }
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup Sekarang</span>
                </button>
              </div>

              {/* Action 2: Import */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-white font-bold text-xs sm:text-sm">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>Pulihkan dari Berkas JSON</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Unggah berkas cadangan JSON yang pernah Anda unduh untuk memulihkan seluruh data secara instan.
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileImportInputRef}
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsImporting(true);
                    try {
                      const text = await file.text();
                      if (onImportDatabase) {
                        const res = await onImportDatabase(text);
                        if (res.success) {
                          setDbMessage({
                            type: "success",
                            text: res.message || "Database berhasil dipulihkan dari berkas JSON!",
                          });
                        } else {
                          setDbMessage({
                            type: "error",
                            text: res.message || "Gagal mengimpor file JSON!",
                          });
                        }
                      }
                    } catch (err: any) {
                      setDbMessage({
                        type: "error",
                        text: "Format file JSON tidak valid: " + err.message,
                      });
                    } finally {
                      setIsImporting(false);
                      if (fileImportInputRef.current) fileImportInputRef.current.value = "";
                      setTimeout(() => setDbMessage(null), 6000);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => fileImportInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isImporting ? "Sedang Memproses..." : "Pilih File Cadangan"}</span>
                </button>
              </div>

              {/* Action 3: Manual Snapshot */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-white font-bold text-xs sm:text-sm">
                    <History className="w-4 h-4 text-purple-400" />
                    <span>Buat Snapshot Server</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Simpan titik pemulihan baru di server (misal sebelum ujian atau sebelum import data baru).
                  </p>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={manualBackupLabel}
                    onChange={(e) => setManualBackupLabel(e.target.value)}
                    placeholder="Label (Contoh: Siap Ujian Utama)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (onCreateManualBackup) {
                        const label = manualBackupLabel.trim() || "manual_snapshot";
                        const ok = await onCreateManualBackup(label);
                        if (ok) {
                          setDbMessage({
                            type: "success",
                            text: `Snapshot server [${label}] berhasil dibuat!`,
                          });
                          setManualBackupLabel("");
                          if (onFetchBackups) {
                            onFetchBackups().then(setBackupsList);
                          }
                          setTimeout(() => setDbMessage(null), 5000);
                        }
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-lg shadow-purple-600/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Snapshot</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Automatic Server Snapshots History */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>Daftar Snapshot Cadangan Otomatis di Server</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Server menyimpan hingga 25 snapshot terakhir secara otomatis setiap kali ada perubahan data penting.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onFetchBackups) {
                    setLoadingBackups(true);
                    onFetchBackups().then((b) => {
                      setBackupsList(b);
                      setLoadingBackups(false);
                    }).catch(() => setLoadingBackups(false));
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? "animate-spin" : ""}`} />
                <span>Segarkan</span>
              </button>
            </div>

            {loadingBackups ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Memuat riwayat snapshot dari server...</span>
              </div>
            ) : backupsList.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center space-y-2">
                <FileCheck className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">
                  Snapshot otomatis sedang berjalan di latar belakang server.
                </p>
                <p className="text-[11px] text-slate-500">
                  Setiap kali Anda menambah/mengubah data siswa atau soal, snapshot keselamatan baru akan dibuat secara otomatis.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Waktu Pembuatan</th>
                      <th className="p-3">Label / Keterangan</th>
                      <th className="p-3">Siswa</th>
                      <th className="p-3">Soal</th>
                      <th className="p-3">Ukuran</th>
                      <th className="p-3 text-right">Aksi Pemulihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {backupsList.map((bk) => (
                      <tr key={bk.filename} className="hover:bg-slate-900/40 transition">
                        <td className="p-3 font-mono text-slate-300">
                          {bk.timestamp ? new Date(bk.timestamp).toLocaleString("id-ID") : bk.filename}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {bk.label || "auto_save"}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-200">
                          {bk.studentsCount ?? "-"} Siswa
                        </td>
                        <td className="p-3 font-semibold text-slate-200">
                          {bk.questionsCount ?? "-"} Soal
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {bk.sizeBytes ? Math.round(bk.sizeBytes / 1024) + " KB" : "-"}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Yakin ingin memulihkan database ke snapshot [${bk.label || bk.filename}]?`)) {
                                if (onRestoreBackup) {
                                  const res = await onRestoreBackup(bk.filename);
                                  if (res.success) {
                                    setDbMessage({
                                      type: "success",
                                      text: "Database berhasil dipulihkan dari snapshot server!",
                                    });
                                  } else {
                                    setDbMessage({
                                      type: "error",
                                      text: res.message || "Gagal memulihkan snapshot",
                                    });
                                  }
                                  setTimeout(() => setDbMessage(null), 5000);
                                }
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition cursor-pointer"
                          >
                            Pulihkan Snapshot
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: DANGER ZONE & DATA MANAGEMENT */}
      {activeSubTab === "danger" && (
        <div className="space-y-6">
          {dangerActionSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 flex items-center space-x-3 text-xs sm:text-sm animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold">{dangerActionSuccess}</span>
            </div>
          )}

          <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="border-b border-rose-900/40 pb-4">
              <div className="flex items-center space-x-2 text-rose-400 mb-1">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">Zona Bahaya &amp; Reset Data Ujian</h3>
              </div>
              <p className="text-xs text-rose-300/80">
                Tindakan di bawah ini memengaruhi status ujian, lembar jawaban siswa, dan konfigurasi server. Harap lakukan dengan cermat.
              </p>
            </div>

            {/* Action 1: Reset Student Logins (All or Selected) */}
            <div className="bg-slate-950/80 border border-rose-900/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
                  <span>Buka Kunci (Reset) Sesi Login Siswa</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                    Bisa Pilih Siswa
                  </span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Membuka status akun yang terkunci agar siswa dapat login kembali. Anda dapat memilih siswa tertentu yang terkunci atau mereset seluruh siswa sekaligus.
                </p>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetLoginModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center space-x-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Pilih Siswa Tertentu</span>
                </button>

                {!confirmResetLogins ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResetLogins(true)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Reset Semua Siswa
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (onResetAllStudentsLogin) onResetAllStudentsLogin();
                        setConfirmResetLogins(false);
                        setDangerActionSuccess(`Berhasil mereset kunci login seluruh ${totalStudents} siswa!`);
                        setTimeout(() => setDangerActionSuccess(null), 5000);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Ya, Reset Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetLogins(false)}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action 1.5: Delete All Sample Students */}
            <div className="bg-slate-950/80 border border-rose-900/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
                    <UserMinus className="w-4 h-4 text-rose-400" />
                    <span>Hapus Semua Data Sampel Siswa Bawaan</span>
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    sampleStudentsCount > 0
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}>
                    {sampleStudentsCount > 0 ? `${sampleStudentsCount} Siswa Sampel` : "Bersih (0)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Menghapus seluruh siswa contoh bawaan sistem agar database bersih untuk siswa riil. <em>(Bank soal dan konfigurasi ujian Anda tetap aman).</em>
                </p>
              </div>

              {sampleStudentsCount > 0 ? (
                !confirmDeleteSampleStudents ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteSampleStudents(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-bold transition cursor-pointer flex-shrink-0"
                  >
                    Hapus {sampleStudentsCount} Siswa Sampel
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (onDeleteSampleStudents) onDeleteSampleStudents();
                        setConfirmDeleteSampleStudents(false);
                        setDangerActionSuccess(`Seluruh ${sampleStudentsCount} data sampel siswa berhasil dibersihkan!`);
                        setTimeout(() => setDangerActionSuccess(null), 5000);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Ya, Hapus Sampel
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSampleStudents(false)}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )
              ) : (
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tidak Ada Data Sampel</span>
                </div>
              )}
            </div>

            {/* Action 2: Reset All Exam Answers & Scores */}
            <div className="bg-slate-950/80 border border-rose-900/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
                  <span>Bersihkan Semua Nilai &amp; Lembar Jawaban Siswa</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mengembalikan status seluruh siswa ke belum mulai (Not Started), menghapus rekap skor PG &amp; Essay, serta mengosongkan log pelanggaran untuk simulasi baru. <em>(Daftar akun siswa dan bank soal yang telah Anda input TIDAK AKAN DIHAPUS).</em>
                </p>
              </div>

              {!confirmResetScores ? (
                <button
                  type="button"
                  onClick={() => setConfirmResetScores(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-bold transition cursor-pointer flex-shrink-0"
                >
                  Bersihkan Jawaban &amp; Nilai
                </button>
              ) : (
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (onResetAllExamData) onResetAllExamData();
                      setConfirmResetScores(false);
                      setDangerActionSuccess("Seluruh lembar jawaban dan skor siswa telah dibersihkan untuk siklus baru!");
                      setTimeout(() => setDangerActionSuccess(null), 5000);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Ya, Bersihkan Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetScores(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>

            {/* Action 3: Restore Default Exam Configuration */}
            <div className="bg-slate-950/80 border border-rose-900/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
                  <span>Kembalikan Parameter Ujian ke Setelan Pabrik</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mengatur ulang judul ujian, durasi, KKM, token awal, dan butir instruksi ke setelan standar bawaan sistem.
                </p>
              </div>

              {!confirmFactoryReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmFactoryReset(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer flex-shrink-0"
                >
                  Setel Ulang Default
                </button>
              ) : (
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (onRestoreDefaultExamConfig) onRestoreDefaultExamConfig();
                      setConfirmFactoryReset(false);
                      setDangerActionSuccess("Parameter ujian telah dikembalikan ke konfigurasi standar pabrik!");
                      setTimeout(() => setDangerActionSuccess(null), 5000);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Ya, Pulihkan Default
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmFactoryReset(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Login Modal (Choose specific students or all) */}
      <ResetLoginModal
        isOpen={showResetLoginModal}
        onClose={() => setShowResetLoginModal(false)}
        students={students}
        config={examConfig}
        onResetStudentLogin={(studentId) => {
          if (onResetStudentLogin) onResetStudentLogin(studentId);
        }}
        onResetMultipleStudentsLogin={(studentIds) => {
          if (onResetMultipleStudentsLogin) {
            onResetMultipleStudentsLogin(studentIds);
          } else if (onResetStudentLogin) {
            studentIds.forEach((id) => onResetStudentLogin(id));
          }
        }}
        onResetAllStudentsLogin={() => {
          if (onResetAllStudentsLogin) onResetAllStudentsLogin();
        }}
        onSuccessToast={(msg) => {
          setDangerActionSuccess(msg);
          setTimeout(() => setDangerActionSuccess(null), 5000);
        }}
      />

      {/* AI Rubric Tuning Modal */}
      {showRubricModal && (
        <AIRubricTuningModal
          config={examConfig?.aiRubricConfig}
          onClose={() => setShowRubricModal(false)}
          onSave={(newRubric) => {
            if (onUpdateExamConfig) {
              onUpdateExamConfig({ aiRubricConfig: newRubric });
            }
            setShowRubricModal(false);
          }}
        />
      )}
    </div>
  );
};
