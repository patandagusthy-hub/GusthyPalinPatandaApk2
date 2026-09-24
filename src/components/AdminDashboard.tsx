import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  Users,
  FileSpreadsheet,
  FileText,
  Trash2,
  Edit,
  Edit3,
  Pencil,
  Plus,
  RotateCcw,
  Download,
  Upload,
  QrCode,
  Award,
  ShieldAlert,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  Printer,
  RefreshCw,
  Cpu,
  Eye,
  EyeOff,
  Settings,
  UserMinus,
  GraduationCap,
  FolderPlus,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Shuffle,
  UserCheck,
  Music,
  Video,
  Image as ImageIcon,
  History,
  BarChart3,
  Cloud,
  ShieldCheck,
  Volume2,
  VolumeX,
  Maximize2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Student, Question, ExamConfig, TeacherOrAdmin, isSampleStudent, isExamClassActive } from "../types";
import { exportResultsToExcel, exportResultsToPDF } from "../utils/exportUtils";
import { DuckRaceLive } from "./DuckRaceLive";
import { generateQRCode, generateUniqueStudentToken, auditStudentTokens, ensureUniqueStudentTokens } from "../utils/barcodeUtils";
import { WordQuestionUploadModal } from "./WordQuestionUploadModal";
import { downloadWordTemplate } from "../utils/wordQuestionParser";
import { downloadExcelQuestionTemplate, parseExcelQuestions } from "../utils/excelQuestionParser";
import { deduplicateStudents } from "../utils/studentDeduplicator";
import { QuestionEditorModal } from "./QuestionEditorModal";
import { ExportQuestionsModal } from "./ExportQuestionsModal";
import { QuestionRevisionHistoryModal } from "./QuestionRevisionHistoryModal";
import { MathRenderer } from "./MathRenderer";
import { AdminSettingsView } from "./AdminSettingsView";
import { StudentQrCard } from "./StudentQrCard";
import { QrCodeZoomModal } from "./QrCodeZoomModal";
import { LoginPortalQrModal } from "./LoginPortalQrModal";
import { AddStudentsByClassModal } from "./AddStudentsByClassModal";
import { AddClassModal } from "./AddClassModal";
import { ClassExamActivationModal } from "./ClassExamActivationModal";
import { ResetLoginModal } from "./ResetLoginModal";
import { BulkEditStudentsModal } from "./BulkEditStudentsModal";
import { ItemAnalysisView } from "./ItemAnalysisView";
import { AIRubricTuningModal } from "./AIRubricTuningModal";
import { GoogleDriveModal } from "./GoogleDriveModal";
import { ErrorBoundary } from "./ErrorBoundary";

interface AdminDashboardProps {
  currentUser: TeacherOrAdmin;
  students: Student[];
  questions: Question[];
  config: ExamConfig;
  customClasses?: string[];
  onAddClasses?: (newClasses: string[], openStudentModalForClass?: string) => void;
  onDeleteClass?: (className: string, deleteStudentsInClass?: boolean) => void;
  onDeleteCustomClass?: (className: string) => void;
  onEmptyClass?: (className: string) => void;
  firebaseStatus?: "connected" | "connecting" | "error";
  onResetStudentLogin: (studentId: string) => void;
  onResetMultipleStudentsLogin?: (studentIds: string[]) => void;
  onResetAllStudentsLogin: () => void;
  onAddStudent: (student: Omit<Student, "id">) => void;
  onEditStudent: (id: string, updates: Partial<Student>) => void;
  onBulkUpdateStudents?: (updates: Array<{ id: string } & Partial<Student>>) => void | Promise<void>;
  onDeleteStudent: (id: string) => void;
  onBulkDeleteStudents: (ids: string[]) => void;
  onBulkAddStudents: (newStudents: Student[]) => void;
  onCleanupDuplicateStudents?: () => Promise<{ totalCleaned: number; remainingCount: number }>;
  onDeleteSampleStudents?: () => void;
  onAddQuestion: (q: Omit<Question, "id">) => void;
  onUpdateQuestion?: (id: string, updates: Partial<Question>) => void;
  onRestoreQuestionRevision?: (questionId: string, revisionId: string) => void;
  onBulkAddQuestions?: (newQuestions: Omit<Question, "id">[]) => void;
  onDeleteQuestion: (id: string) => void;
  onOpenDuckRace?: () => void;
  onUpdateAdminProfile?: (
    staffId: string,
    updates: { name?: string; username?: string; email?: string; password?: string }
  ) => { success: boolean; message?: string };
  onUpdateExamConfig?: (updates: Partial<ExamConfig>) => void;
  onResetAllExamData?: () => void;
  onRestoreDefaultExamConfig?: () => void;
  onGenerate1000Students?: (count?: number) => void;
  onRestoreInitialStudents?: () => void;
  hasAdminCustomData?: boolean;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
  onExportDatabase?: () => boolean;
  onImportDatabase?: (jsonContent: string) => Promise<{ success: boolean; message: string }>;
  onFetchBackups?: () => Promise<any[]>;
  onRestoreBackup?: (filename: string) => Promise<{ success: boolean; message: string }>;
  onCreateManualBackup?: (label?: string) => Promise<boolean>;
  onRefreshAllData?: () => Promise<number>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  students,
  questions,
  config,
  customClasses: customClassesProp,
  onAddClasses: onAddClassesProp,
  onDeleteClass: onDeleteClassProp,
  onDeleteCustomClass: onDeleteCustomClassProp,
  onEmptyClass: onEmptyClassProp,
  firebaseStatus = "connected",
  onResetStudentLogin,
  onResetMultipleStudentsLogin,
  onResetAllStudentsLogin,
  onAddStudent,
  onEditStudent,
  onBulkUpdateStudents,
  onDeleteStudent,
  onBulkDeleteStudents,
  onBulkAddStudents,
  onCleanupDuplicateStudents,
  onDeleteSampleStudents,
  onAddQuestion,
  onUpdateQuestion,
  onRestoreQuestionRevision,
  onBulkAddQuestions,
  onDeleteQuestion,
  onUpdateAdminProfile,
  onUpdateExamConfig,
  onResetAllExamData,
  onRestoreDefaultExamConfig,
  onGenerate1000Students,
  onRestoreInitialStudents,
  hasAdminCustomData,
  lastSyncTime,
  isSyncing,
  onExportDatabase,
  onImportDatabase,
  onFetchBackups,
  onRestoreBackup,
  onCreateManualBackup,
  onRefreshAllData,
}) => {
  const [activeTab, setActiveTab] = useState<
    "students" | "results" | "questions" | "barcodes" | "duckrace" | "violations" | "settings" | "item_analysis"
  >("students");

  const [showRubricTuningModal, setShowRubricTuningModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Student Form Modal state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showAddByClassModal, setShowAddByClassModal] = useState(false);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showClassActivationModal, setShowClassActivationModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [selectedClassForNewStudents, setSelectedClassForNewStudents] = useState<string | undefined>(undefined);
  const [internalCustomClasses, setInternalCustomClasses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("gpp_registered_classes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const customClasses = customClassesProp !== undefined ? customClassesProp : internalCustomClasses;

  const [studentClassFilter, setStudentClassFilter] = useState("ALL");
  const [resultsClassFilter, setResultsClassFilter] = useState("ALL");
  const [showOnlyActiveExam, setShowOnlyActiveExam] = useState(false);
  const [studentSuccessToast, setStudentSuccessToast] = useState<string | null>(null);
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  // Reset Login Modal State
  const [showResetLoginModal, setShowResetLoginModal] = useState(false);
  const [resetModalInitialIds, setResetModalInitialIds] = useState<string[]>([]);

  // KKM Edit Modal State
  const [showKkmModal, setShowKkmModal] = useState(false);
  const [editingKkmValue, setEditingKkmValue] = useState<number>(config.passingScore);

  useEffect(() => {
    if (config.passingScore !== undefined) {
      setEditingKkmValue(config.passingScore);
    }
  }, [config.passingScore]);

  const handleApplyKKM = (newVal: number) => {
    const valid = Math.max(0, Math.min(100, Math.round(newVal)));
    if (onUpdateExamConfig) {
      onUpdateExamConfig({ passingScore: valid });
      setStudentSuccessToast(`Nilai KKM berhasil diperbarui menjadi ${valid}! Status kelulusan seluruh peserta diperbarui.`);
      setTimeout(() => setStudentSuccessToast(null), 5000);
    }
    setShowKkmModal(false);
  };

  // In-App Universal Confirmation Dialog state (for reliable modal prompts in iframes)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    nisn: "",
    username: "",
    className: "XII RPL 1",
    password: "siswa123",
  });

  // AI Question Generator state
  const [showAiGenModal, setShowAiGenModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("Keamanan Siber & Jaringan Komputer");
  const [aiCount, setAiCount] = useState(3);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenMessage, setAiGenMessage] = useState<string | null>(null);

  // Word Document Question Import state
  const [showWordUploadModal, setShowWordUploadModal] = useState(false);
  const [wordImportSuccessMsg, setWordImportSuccessMsg] = useState<string | null>(null);

  // Google Drive Modal state
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);

  // Barcode / QR Code Cards Tab state
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState("");
  const [barcodeClassFilter, setBarcodeClassFilter] = useState("ALL");
  const [barcodeQrFormat, setBarcodeQrFormat] = useState<"url" | "token">("url");
  const [barcodePage, setBarcodePage] = useState(1);
  const [barcodePageSize, setBarcodePageSize] = useState(12);
  const [showLoginPortalQrModal, setShowLoginPortalQrModal] = useState(false);
  const [selectedZoomStudent, setSelectedZoomStudent] = useState<{
    student: Student;
    qrDataUrl: string;
    payload: string;
  } | null>(null);

  const availableClasses = useMemo(() => {
    const set = new Set([
      ...students.map((s) => (s?.className || "").trim()).filter(Boolean),
      ...(customClasses || []).map((c) => (c || "").trim()).filter(Boolean),
    ]);
    return Array.from(set).sort();
  }, [students, customClasses]);

  // Jika filter kelas terpilih dinonaktifkan dari ujian saat showOnlyActiveExam aktif, kembalikan ke "ALL"
  useEffect(() => {
    if (
      showOnlyActiveExam &&
      studentClassFilter !== "ALL" &&
      studentClassFilter !== "__ADD_CLASS__" &&
      !isExamClassActive(config, studentClassFilter)
    ) {
      setStudentClassFilter("ALL");
    }
  }, [showOnlyActiveExam, config, studentClassFilter]);

  const handleAddClasses = (newClasses: string[], openStudentModalForClass?: string) => {
    if (onAddClassesProp) {
      onAddClassesProp(newClasses, openStudentModalForClass);
    } else {
      const updated = Array.from(new Set([...customClasses, ...newClasses]));
      setInternalCustomClasses(updated);
      try {
        localStorage.setItem("gpp_registered_classes", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
    setStudentSuccessToast(`Berhasil mendaftarkan ${newClasses.length} kelas baru (${newClasses.join(", ")}) ke Firebase Firestore!`);
    setTimeout(() => setStudentSuccessToast(null), 6000);

    if (openStudentModalForClass) {
      setShowAddClassModal(false);
      setSelectedClassForNewStudents(openStudentModalForClass);
      setShowAddByClassModal(true);
    }
  };

  const handleDeleteClass = (className: string, deleteStudentsInClass = true) => {
    const trimmedTarget = (className || "").trim();
    const normalized = trimmedTarget.toLowerCase();

    if (onDeleteClassProp) {
      onDeleteClassProp(className, deleteStudentsInClass);
    } else {
      // 1. Delete students in this class if requested
      if (deleteStudentsInClass) {
        const studentIdsToDelete = students
          .filter((s) => (s?.className || "").trim().toLowerCase() === normalized)
          .map((s) => s.id);
        if (studentIdsToDelete.length > 0) {
          onBulkDeleteStudents(studentIdsToDelete);
        }
      }

      // 2. Remove from customClasses list
      const updatedCustom = (customClasses || []).filter(
        (c) => (c || "").trim().toLowerCase() !== normalized
      );
      setInternalCustomClasses(updatedCustom);
      try {
        localStorage.setItem("gpp_registered_classes", JSON.stringify(updatedCustom));
      } catch (e) {
        console.error(e);
      }
    }

    // 3. Remove from config.activeClasses if present
    if (
      config.activeClasses &&
      config.activeClasses.some((c) => (c || "").trim().toLowerCase() === normalized)
    ) {
      onUpdateExamConfig({
        ...config,
        activeClasses: config.activeClasses.filter(
          (c) => (c || "").trim().toLowerCase() !== normalized
        ),
      });
    }

    // 4. Reset filters if currently viewing this class
    if ((studentClassFilter || "").trim().toLowerCase() === normalized) {
      setStudentClassFilter("ALL");
    }
    if ((barcodeClassFilter || "").trim().toLowerCase() === normalized) {
      setBarcodeClassFilter("ALL");
    }
    if ((resultsClassFilter || "").trim().toLowerCase() === normalized) {
      setResultsClassFilter("ALL");
    }

    setStudentSuccessToast(
      `Kelas "${trimmedTarget}" ${
        deleteStudentsInClass ? "beserta seluruh siswanya" : ""
      } berhasil dihapus dari Firebase Firestore.`
    );
    setTimeout(() => setStudentSuccessToast(null), 5000);
  };

  const handleEmptyClass = (className: string) => {
    const trimmedTarget = (className || "").trim();
    const normalized = trimmedTarget.toLowerCase();

    if (onEmptyClassProp) {
      onEmptyClassProp(className);
    } else {
      const studentIdsToDelete = students
        .filter((s) => (s?.className || "").trim().toLowerCase() === normalized)
        .map((s) => s.id);

      if (studentIdsToDelete.length > 0) {
        onBulkDeleteStudents(studentIdsToDelete);
      }

      // Keep class in customClasses so the class name remains available for fresh enrollment
      if (!(customClasses || []).some((c) => (c || "").trim().toLowerCase() === normalized)) {
        const updated = [...customClasses, trimmedTarget];
        setInternalCustomClasses(updated);
        try {
          localStorage.setItem("gpp_registered_classes", JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
      }
    }

    setStudentSuccessToast(
      `Seluruh siswa kelas "${trimmedTarget}" berhasil dikosongkan dari database cloud Firebase.`
    );
    setTimeout(() => setStudentSuccessToast(null), 5000);
  };

  const handleDeleteCustomClass = (className: string) => {
    handleDeleteClass(className, false);
  };

  // Komputasi siswa yang aktif ujian berdasarkan config.activeClasses
  const activeExamStudents = useMemo(() => {
    return students.filter((s) => isExamClassActive(config, s.className));
  }, [students, config]);

  const inactiveExamStudentsCount = students.length - activeExamStudents.length;

  const filteredBarcodeStudents = useMemo(() => {
    const term = (barcodeSearchTerm || "").trim().toLowerCase();
    const filterClass = (barcodeClassFilter || "").trim().toLowerCase();

    return students.filter((s) => {
      if (showOnlyActiveExam && !isExamClassActive(config, s.className)) {
        return false;
      }
      const sName = (s.name || "").toLowerCase();
      const sNisn = s.nisn || "";
      const sToken = (s.startBarcodeToken || "").toLowerCase();
      const sClass = (s?.className || "").trim().toLowerCase();

      const matchesSearch =
        !term ||
        sName.includes(term) ||
        sNisn.includes(term) ||
        sToken.includes(term);
      const matchesClass = filterClass === "all" || sClass === filterClass;
      return matchesSearch && matchesClass;
    });
  }, [students, barcodeSearchTerm, barcodeClassFilter, config, showOnlyActiveExam]);

  const totalBarcodePages = Math.ceil(filteredBarcodeStudents.length / barcodePageSize) || 1;
  const paginatedBarcodeStudents = filteredBarcodeStudents.slice(
    (barcodePage - 1) * barcodePageSize,
    barcodePage * barcodePageSize
  );

  // Real-time audit of student barcode tokens for 100% uniqueness and zero collisions
  const tokenAudit = useMemo(() => {
    return auditStudentTokens(students);
  }, [students]);

  const [isFixingTokens, setIsFixingTokens] = useState(false);

  const handleFixDuplicateTokens = async () => {
    if (!onBulkUpdateStudents) return;
    setIsFixingTokens(true);
    try {
      const { students: fixedList, fixedCount } = ensureUniqueStudentTokens(students);
      if (fixedCount > 0) {
        const updates = fixedList.map((st) => ({
          id: st.id,
          startBarcodeToken: st.startBarcodeToken,
        }));
        await onBulkUpdateStudents(updates);
        setStudentSuccessToast(`Berhasil! ${fixedCount} barcode siswa telah diperbaiki dan dijamin 100% unik.`);
        setTimeout(() => setStudentSuccessToast(null), 5000);
      } else {
        setStudentSuccessToast("Seluruh barcode siswa sudah 100% unik tanpa duplikat.");
        setTimeout(() => setStudentSuccessToast(null), 3000);
      }
    } catch (e) {
      console.error("Failed to fix tokens:", e);
    } finally {
      setIsFixingTokens(false);
    }
  };

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showQuestionEditor, setShowQuestionEditor] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
  const [selectedRevisionQuestion, setSelectedRevisionQuestion] = useState<Question | null>(null);
  const excelQuestionFileInputRef = useRef<HTMLInputElement>(null);

  const handleExcelQuestionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseExcelQuestions(buffer);
      if (parsed.length === 0) {
        alert("Tidak ada butir soal valid yang ditemukan dalam file Excel tersebut. Silakan gunakan template resmi.");
        return;
      }
      if (onBulkAddQuestions) {
        onBulkAddQuestions(parsed);
      } else {
        parsed.forEach((q) => onAddQuestion(q));
      }
      setWordImportSuccessMsg(`Berhasil mengimpor ${parsed.length} butir soal dari dokumen Excel ke Bank Soal!`);
      setTimeout(() => setWordImportSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error("Gagal membaca file Excel:", err);
      alert("Gagal membaca file Excel: " + (err.message || "Format tidak valid"));
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleImportFromWord = (newQuestions: Omit<Question, "id">[]) => {
    if (onBulkAddQuestions) {
      onBulkAddQuestions(newQuestions);
    } else {
      newQuestions.forEach((q) => onAddQuestion(q));
    }
    setWordImportSuccessMsg(`Berhasil mengimpor ${newQuestions.length} butir soal dari dokumen Word ke Bank Soal!`);
    setTimeout(() => setWordImportSuccessMsg(null), 6000);
  };

  // Filter students (Kelola Siswa Massal)
  const filteredStudents = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    const filterClass = (studentClassFilter || "").trim().replace(/\s+/g, " ").toLowerCase();

    return students.filter((s) => {
      // Sesuai permintaan: jangan tampilkan siswa yang non aktif ujian, hanya tampilkan yang kelas/siswa yang diaktifkan
      if (showOnlyActiveExam && !isExamClassActive(config, s.className)) {
        return false;
      }

      const sName = (s.name || "").toLowerCase();
      const sNisn = s.nisn || "";
      const sUsername = (s.username || "").toLowerCase();
      const sClass = (s?.className || "").trim().replace(/\s+/g, " ").toLowerCase();

      const matchesSearch =
        !term ||
        sName.includes(term) ||
        sNisn.includes(term) ||
        sUsername.includes(term) ||
        sClass.includes(term);

      const matchesClass = filterClass === "all" || sClass === filterClass;
      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, studentClassFilter, config, showOnlyActiveExam]);

  // Filter results
  const filteredResultsStudents = useMemo(() => {
    let list = students;
    if (showOnlyActiveExam) {
      list = list.filter((s) => isExamClassActive(config, s.className));
    }
    if ((resultsClassFilter || "").toUpperCase() === "ALL") return list;
    const filterClass = (resultsClassFilter || "").trim().toLowerCase();
    return list.filter(
      (s) => (s?.className || "").trim().toLowerCase() === filterClass
    );
  }, [students, resultsClassFilter, config, showOnlyActiveExam]);

  const sampleStudentsCount = students.filter(isSampleStudent).length;

  const duplicateStudentsCount = useMemo(() => {
    const { duplicatesCount } = deduplicateStudents(students);
    return duplicatesCount;
  }, [students]);

  // Select all handler
  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkResetLogins = () => {
    if (selectedStudentIds.length === 0) return;
    const count = selectedStudentIds.length;
    setConfirmDialog({
      isOpen: true,
      title: "Reset Login Siswa Terpilih",
      message: `Buka kunci login untuk ${count} siswa yang Anda centang?`,
      detail: "Siswa-siswa ini akan dapat login kembali ke aplikasi ujian menggunakan barcode/NISN mereka. Riwayat pengerjaan tidak akan hilang.",
      confirmLabel: `Reset Login ${count} Siswa`,
      variant: "warning",
      onConfirm: () => {
        if (onResetMultipleStudentsLogin) {
          onResetMultipleStudentsLogin(selectedStudentIds);
        } else {
          selectedStudentIds.forEach((id) => onResetStudentLogin(id));
        }
        setSelectedStudentIds([]);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setStudentSuccessToast(`Berhasil mereset status login ${count} siswa terpilih.`);
        setTimeout(() => setStudentSuccessToast(null), 4000);
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedStudentIds.length === 0) return;
    const count = selectedStudentIds.length;
    setConfirmDialog({
      isOpen: true,
      title: "Hapus Siswa Terpilih",
      message: `Apakah Anda yakin ingin menghapus ${count} data siswa terpilih secara massal?`,
      detail: "Data nilai, hasil ujian, dan token barcode siswa terpilih akan dihapus permanen dari sistem.",
      confirmLabel: `Ya, Hapus ${count} Siswa`,
      variant: "danger",
      onConfirm: () => {
        onBulkDeleteStudents(selectedStudentIds);
        setSelectedStudentIds([]);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setStudentSuccessToast(`Berhasil menghapus ${count} data siswa.`);
        setTimeout(() => setStudentSuccessToast(null), 4000);
      },
    });
  };

  // Open Edit Modal
  const handleOpenEdit = (s: Student) => {
    setEditingStudentId(s.id);
    setFormData({
      name: s.name,
      nisn: s.nisn,
      username: s.username,
      className: s.className,
      password: s.password || "siswa123",
    });
    setShowStudentPassword(false);
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = (formData.name || "").trim();
    if (!cleanName) {
      return;
    }
    const targetClass = (formData.className || "").trim() || "XII RPL 1";
    const cleanNisn = formData.nisn ? String(formData.nisn).trim() : "";
    let cleanUsername = formData.username ? String(formData.username).trim() : "";
    if (!cleanUsername) {
      const clsPart = targetClass.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      const namePart = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
      cleanUsername = cleanNisn ? `s_${cleanNisn.slice(-6)}` : `${clsPart || "user"}_${namePart || Date.now().toString().slice(-4)}`;
    }

    if (editingStudentId) {
      await onEditStudent(editingStudentId, {
        ...formData,
        name: cleanName,
        className: targetClass,
        nisn: cleanNisn,
        username: cleanUsername,
      });
      setStudentSuccessToast(`Data induk siswa "${cleanName}" (${targetClass}) berhasil diperbarui!`);
    } else {
      await onAddStudent({
        ...formData,
        name: cleanName,
        className: targetClass,
        nisn: cleanNisn,
        username: cleanUsername,
        password: formData.password || "siswa123",
        role: "siswa",
        loginCount: 0,
        isLocked: false,
        examStatus: "not_started",
        mcqScore: 0,
        essayScore: 0,
        totalScore: 0,
        violationsCount: 0,
        violationsLog: [],
        answers: {},
        startBarcodeToken: generateUniqueStudentToken(
          targetClass,
          cleanNisn,
          "",
          new Set(students.map((s) => (s.startBarcodeToken || "").toLowerCase()))
        ),
      });
      setStudentSuccessToast(`Data induk siswa "${cleanName}" (${targetClass}) berhasil disimpan ke database!`);
    }
    setTimeout(() => setStudentSuccessToast(null), 5000);

    // If targetClass is not in availableClasses, register it
    const isClassKnown = availableClasses.some((c) => (c || "").trim().toLowerCase() === targetClass.toLowerCase());
    if (!isClassKnown) {
      handleAddClasses([targetClass]);
    }

    // Set filter to the student's class so the admin immediately sees the saved student in the table
    setStudentClassFilter(targetClass);

    setShowStudentModal(false);
    setEditingStudentId(null);
  };

  // Upload Excel / Doc file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
      reader.onload = (evt) => {
        try {
          const binaryStr = evt.target?.result;
          const workbook = XLSX.read(binaryStr, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

          const parsedStudents: Student[] = jsonData.map((row: any, idx: number) => {
            const nisn = String(row.NISN || row.nisn || `005${Date.now().toString().slice(-7)}` + idx);
            const name = String(row.Nama || row.nama || row.Name || `Siswa Baru ${idx + 1}`);
            const className = String(row.Kelas || row.kelas || "XII RPL 1");
            const username = String(row.Username || row.username || `siswa_${nisn.slice(-4)}`);

            return {
              id: "std-import-" + Date.now() + "-" + idx,
              name,
              nisn,
              className,
              username,
              password: String(row.Password || row.password || "siswa123"),
              role: "siswa",
              loginCount: 0,
              isLocked: false,
              examStatus: "not_started",
              startBarcodeToken: generateUniqueStudentToken(className, nisn, `std-import-${idx}`),
              mcqScore: 0,
              essayScore: 0,
              totalScore: 0,
              violationsCount: 0,
              violationsLog: [],
              answers: {},
              avatarColor: ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"][idx % 5],
              isSample: false,
            };
          });

          if (parsedStudents.length > 0) {
            onBulkAddStudents(parsedStudents);
            alert(`Berhasil mengimpor ${parsedStudents.length} siswa dari file Excel!`);
          } else {
            alert("File kosong atau format kolom tidak sesuai.");
          }
        } catch (err) {
          console.error("Excel parse error:", err);
          alert("Gagal membaca file Excel. Pastikan format kolom: NISN, Nama, Kelas, Username.");
        }
      };
      reader.readAsBinaryString(file);
    } else {
      // Plain text or doc parsing
      reader.onload = (evt) => {
        try {
          const text = String(evt.target?.result || "");
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          const parsed: Student[] = [];

          lines.forEach((line, i) => {
            const parts = line.split(/[,\t|;]/);
            if (parts.length >= 2) {
              const nisn = parts[0].trim();
              const name = parts[1].trim();
              const className = parts[2]?.trim() || "XII RPL 1";
              parsed.push({
                id: "std-doc-" + Date.now() + "-" + i,
                name,
                nisn,
                className,
                username: `siswa_${nisn.slice(-4)}`,
                password: "siswa123",
                role: "siswa",
                loginCount: 0,
                isLocked: false,
                examStatus: "not_started",
                startBarcodeToken: generateUniqueStudentToken(className, nisn, `std-doc-${i}`),
                mcqScore: 0,
                essayScore: 0,
                totalScore: 0,
                violationsCount: 0,
                violationsLog: [],
                answers: {},
                isSample: false,
              });
            }
          });

          if (parsed.length > 0) {
            onBulkAddStudents(parsed);
            alert(`Berhasil mengimpor ${parsed.length} siswa dari file dokumen!`);
          } else {
            alert("Format baris dokumen tidak dikenali. Gunakan: NISN, Nama, Kelas");
          }
        } catch (err) {
          alert("Gagal memproses file dokumen.");
        }
      };
      reader.readAsText(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Download Sample Excel Template
  const handleDownloadSample = () => {
    const sample = [
      { NISN: "005999001", Nama: "Dimas Anggara", Kelas: "XII RPL 1", Username: "dimas01", Password: "siswa123" },
      { NISN: "005999002", Nama: "Nadia Safitri", Kelas: "XII RPL 1", Username: "nadia02", Password: "siswa123" },
      { NISN: "005999003", Nama: "Rizky Ramadhan", Kelas: "XII TKJ 2", Username: "rizky03", Password: "siswa123" },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa_GusthyPalinPatandaExam.xlsx");
  };

  // AI Question Generator Handler
  const handleGenerateAiQuestions = async () => {
    setAiLoading(true);
    setAiGenMessage(null);
    try {
      const res = await fetch("/api/gemini/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          gradeLevel: config.gradeLevel,
          count: aiCount,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions)) {
          data.questions.forEach((q: any) => {
            onAddQuestion({
              type: q.type === "essay" ? "essay" : "mcq",
              question: q.question,
              options: q.options || ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
              correctAnswer: q.correctAnswer ?? 0,
              keyAnswer: q.keyAnswer || "Kunci jawaban standar materi.",
              points: q.points || (q.type === "essay" ? 20 : 10),
              subject: aiTopic,
            });
          });
          setAiGenMessage(`Berhasil membuat ${data.questions.length} butir soal dengan Gemini 3.8 Flash!`);
          setTimeout(() => setShowAiGenModal(false), 1500);
        }
      } else {
        const err = await res.json();
        setAiGenMessage(err.error || "Gagal membuat soal dengan AI.");
      }
    } catch (e: any) {
      setAiGenMessage("Koneksi ke Gemini API gagal.");
    } finally {
      setAiLoading(false);
    }
  };

  // =========================================================================
  // REAL-TIME SECURITY AUDIT VIOLATIONS MONITORING (SSE + BroadcastChannel + Polling)
  // =========================================================================
  const initialViolations = useMemo(() => {
    return students.flatMap((s) =>
      (s.violationsLog || []).map((v) => ({ ...v, studentName: s.name, className: s.className, nisn: s.nisn }))
    );
  }, [students]);

  const [liveViolations, setLiveViolations] = useState<Array<any>>([]);
  const [violationSearchTerm, setViolationSearchTerm] = useState("");
  const [violationClassFilter, setViolationClassFilter] = useState("ALL");
  const [violationTypeFilter, setViolationTypeFilter] = useState("ALL");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    snapshot: string;
    studentName: string;
    className: string;
    title: string;
    timestamp: string;
    description: string;
  } | null>(null);
  const [newViolationToast, setNewViolationToast] = useState<string | null>(null);
  const [isClearingViolations, setIsClearingViolations] = useState(false);

  // Synthesized Web Audio chime for proctors
  const playProctorChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Autoplay fallback
    }
  }, [soundEnabled]);

  // Sync initial student state into live violations
  useEffect(() => {
    setLiveViolations((prev) => {
      const map = new Map(prev.map((v) => [v.id, v]));
      let hasChanges = false;
      initialViolations.forEach((v) => {
        if (!map.has(v.id)) {
          map.set(v.id, v);
          hasChanges = true;
        }
      });
      if (!hasChanges && prev.length > 0) return prev;
      return Array.from(map.values()).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    });
  }, [initialViolations]);

  // Real-Time Listeners: SSE stream + BroadcastChannel + Periodic poll fallback
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/violations/stream");
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "NEW_VIOLATION" && data.violation) {
            setLiveViolations((prev) => {
              if (prev.some((v) => v.id === data.violation.id)) return prev;
              playProctorChime();
              setNewViolationToast(`⚠️ ${data.violation.studentName} (${data.violation.title})`);
              setTimeout(() => setNewViolationToast(null), 4000);
              return [data.violation, ...prev];
            });
          } else if (data.type === "VIOLATIONS_CLEARED") {
            setLiveViolations([]);
          }
        } catch {
          // Parse notice
        }
      };
    } catch (err) {
      console.warn("[AdminDashboard] SSE stream unavailable:", err);
    }

    // Zero-latency local BroadcastChannel sync
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("gpp_cbt_violations_channel");
        bc.onmessage = (event) => {
          if (event.data?.type === "NEW_VIOLATION" && event.data.violation) {
            setLiveViolations((prev) => {
              if (prev.some((v) => v.id === event.data.violation.id)) return prev;
              playProctorChime();
              setNewViolationToast(`⚠️ ${event.data.violation.studentName} (${event.data.violation.title})`);
              setTimeout(() => setNewViolationToast(null), 4000);
              return [event.data.violation, ...prev];
            });
          }
        };
      }
    } catch {}

    // Fallback polling every 3.5s for cross-network devices
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/violations");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.violations)) {
            setLiveViolations((prev) => {
              const map = new Map(prev.map((v) => [v.id, v]));
              let hasNew = false;
              data.violations.forEach((v: any) => {
                if (!map.has(v.id)) {
                  map.set(v.id, v);
                  hasNew = true;
                }
              });
              if (!hasNew) return prev;
              return Array.from(map.values()).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
            });
          }
        }
      } catch {}
    }, 3500);

    return () => {
      if (es) es.close();
      if (bc) bc.close();
      clearInterval(pollInterval);
    };
  }, [playProctorChime]);

  // Filtered live violations list for the audit table
  const filteredViolations = useMemo(() => {
    const term = violationSearchTerm.trim().toLowerCase();
    return liveViolations.filter((v) => {
      const matchesSearch =
        !term ||
        (v.studentName || "").toLowerCase().includes(term) ||
        (v.nisn || "").toLowerCase().includes(term) ||
        (v.description || "").toLowerCase().includes(term) ||
        (v.title || "").toLowerCase().includes(term);

      const matchesClass =
        violationClassFilter === "ALL" || (v.className || "").toLowerCase() === violationClassFilter.toLowerCase();

      const matchesType =
        violationTypeFilter === "ALL" || (v.type || "") === violationTypeFilter;

      return matchesSearch && matchesClass && matchesType;
    });
  }, [liveViolations, violationSearchTerm, violationClassFilter, violationTypeFilter]);

  // Clear violations handler
  const handleClearViolations = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus seluruh rekaman log pelanggaran keamanan?")) {
      return;
    }
    setIsClearingViolations(true);
    try {
      await fetch("/api/violations", { method: "DELETE" });
      setLiveViolations([]);
      if (onBulkUpdateStudents) {
        const updates = students
          .filter((s) => (s.violationsLog?.length || 0) > 0)
          .map((s) => ({
            id: s.id,
            violationsCount: 0,
            violationsLog: [],
          }));
        if (updates.length > 0) {
          await onBulkUpdateStudents(updates);
        }
      }
      setStudentSuccessToast("Seluruh log pelanggaran keamanan telah dibersihkan.");
      setTimeout(() => setStudentSuccessToast(null), 3000);
    } catch (err) {
      console.error("Failed to clear violations:", err);
    } finally {
      setIsClearingViolations(false);
    }
  };

  // Export violations to Excel/CSV
  const handleExportViolations = () => {
    if (liveViolations.length === 0) {
      alert("Tidak ada data pelanggaran untuk diekspor.");
      return;
    }
    const rows = liveViolations.map((v, idx) => ({
      No: idx + 1,
      Waktu: v.timestamp,
      NISN: v.nisn || "-",
      "Nama Siswa": v.studentName || "-",
      Kelas: v.className || "-",
      "Tipe Pelanggaran": v.type || "-",
      "Judul Insiden": v.title || "-",
      "Keterangan Lengkap": v.description || "-",
      "Memiliki Snapshot Foto": v.snapshot ? "Ya" : "Tidak",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log_Pelanggaran_Keamanan");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Rekap_Pelanggaran_CBT_${dateStr}.xlsx`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Dashboard Manajemen Ujian
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                {currentUser.role === "admin" ? "Super Admin" : "Guru Pengawas"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              GusthyPalinPatandaExam &bull; {config.title} &bull; Token:{" "}
              <strong className="text-cyan-400 font-mono">{config.gateToken}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Firebase Firestore Cloud Status Pill */}
            <div className="flex items-center space-x-2.5 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-xs shadow-inner">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  firebaseStatus === "connected"
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                    : firebaseStatus === "connecting"
                    ? "bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                    : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"
                }`}
              />
              <div>
                <p className="text-slate-300 font-bold flex items-center space-x-1.5">
                  <span>Firebase Firestore</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase ${
                      firebaseStatus === "connected"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : firebaseStatus === "connecting"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {firebaseStatus === "connected"
                      ? "Cloud Live"
                      : firebaseStatus === "connecting"
                      ? "Menghubungkan..."
                      : "Offline"}
                  </span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {lastSyncTime ? `Sinkron: ${lastSyncTime}` : "Tersambung Permanen"}
                </p>
              </div>
            </div>

            {/* Quick Engine Status Pill */}
            <div className="flex items-center space-x-2 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-xs">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-slate-300 font-bold">Gemini Engine AI</p>
                <p className="text-[10px] text-slate-500">v3.8 Flash (Primer) + Flash-Latest (Cadangan)</p>
              </div>
            </div>

            {/* Google Drive Integration Button */}
            <button
              type="button"
              onClick={() => setShowGoogleDriveModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-600/20 via-amber-500/15 to-amber-600/20 hover:from-amber-600/35 hover:to-amber-500/35 text-amber-300 border border-amber-500/40 px-3.5 py-2 rounded-2xl text-xs font-bold transition shadow-md shadow-amber-500/10 cursor-pointer"
              title="Kelola Cadangan & Berkas Google Drive"
            >
              <Cloud className="w-4 h-4 text-amber-400" />
              <span>Google Drive</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("students")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "students"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kelola Siswa Massal ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("results")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "results"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Rekap Nilai &amp; Export</span>
          </button>

          <button
            onClick={() => setActiveTab("duckrace")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "duckrace"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Duck Race Live</span>
          </button>

          <button
            onClick={() => setActiveTab("barcodes")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "barcodes"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Kartu Barcode Siswa</span>
          </button>

          <button
            onClick={() => setActiveTab("questions")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "questions"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Bank Soal ({questions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("item_analysis")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "item_analysis"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analisis Butir Soal &amp; Rubrik AI</span>
          </button>

          <button
            onClick={() => setActiveTab("violations")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "violations"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="flex items-center gap-1.5">
              <span>Log Audit Keamanan ({liveViolations.length})</span>
              {liveViolations.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              )}
            </span>
          </button>

          {currentUser.role === "admin" && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === "settings"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Pengaturan Admin</span>
            </button>
          )}
        </div>

        {/* TAB 1: KELOLA SISWA MASSAL */}
        {activeTab === "students" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search & Class Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari nama, NISN, atau kelas..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Filter Kelas & Quick Add Class */}
                <div className="flex items-center space-x-1.5 w-full sm:w-auto">
                  <select
                    value={studentClassFilter}
                    onChange={(e) => {
                      if (e.target.value === "__ADD_CLASS__") {
                        setShowAddClassModal(true);
                      } else {
                        setStudentClassFilter(e.target.value);
                      }
                    }}
                    className="w-full sm:w-48 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    title="Filter tabel siswa berdasarkan kelas"
                  >
                    <option value="ALL">
                      {showOnlyActiveExam
                        ? `Semua Kelas Aktif (${activeExamStudents.length})`
                        : `Semua Kelas (${students.length})`}
                    </option>
                    {availableClasses.map((cls) => {
                      const count = students.filter((s) => s.className === cls).length;
                      const isActive = isExamClassActive(config, cls);
                      if (showOnlyActiveExam && !isActive) {
                        return null;
                      }
                      return (
                        <option key={cls} value={cls}>
                          {cls} ({count}) {showOnlyActiveExam ? "" : isActive ? "— ✓ Aktif" : "— ✗ Nonaktif"}
                        </option>
                      );
                    })}
                    <option value="__ADD_CLASS__" className="text-violet-400 font-bold bg-slate-900">
                      + Tambah Kelas Baru...
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowAddClassModal(true)}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/50 text-slate-400 hover:text-violet-300 transition cursor-pointer shrink-0"
                    title="Buat Rombel / Kelas Baru"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </div>

                {/* Toggle Filter: Hanya Tampilkan Kelas/Siswa Aktif Ujian */}
                <button
                  type="button"
                  onClick={() => setShowOnlyActiveExam((prev) => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition cursor-pointer shrink-0 ${
                    showOnlyActiveExam
                      ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/60 shadow-sm"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                  title={
                    showOnlyActiveExam
                      ? "Sedang menampilkan siswa dari kelas aktif ujian saja. Klik untuk melihat semua."
                      : "Klik untuk menyembunyikan siswa dari kelas yang non-aktif ujian."
                  }
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      showOnlyActiveExam ? "text-emerald-400" : "text-slate-500"
                    }`}
                  />
                  <span>
                    {showOnlyActiveExam ? "Hanya Kelas Aktif Ujian" : "Semua Siswa"}
                  </span>
                  {inactiveExamStudentsCount > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        showOnlyActiveExam
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {showOnlyActiveExam
                        ? `${inactiveExamStudentsCount} Nonaktif Disembunyikan`
                        : `${inactiveExamStudentsCount} Nonaktif`}
                    </span>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStudentId(null);
                    setFormData({
                      name: "",
                      nisn: "",
                      username: "",
                      className: studentClassFilter !== "ALL" && studentClassFilter !== "__ADD_CLASS__" ? studentClassFilter : (availableClasses[0] || "XII RPL 1"),
                      password: "siswa123",
                    });
                    setShowStudentPassword(false);
                    setShowStudentModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Siswa</span>
                </button>

                {/* Tambah Siswa Per Kelas Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClassForNewStudents(undefined);
                    setShowAddByClassModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  title="Tambah siswa massal untuk rombongan belajar / kelas tertentu"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Tambah Siswa Per Kelas</span>
                </button>

                {/* Tambah Kelas Baru Button */}
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-violet-600/20 transition cursor-pointer"
                  title="Daftarkan rombel atau kelas baru untuk sekolah"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Tambah Kelas Baru</span>
                </button>

                {/* Aktivasi Kelas Ujian Button */}
                <button
                  type="button"
                  onClick={() => setShowClassActivationModal(true)}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-md transition cursor-pointer ${
                    config.allClassesActive ?? true
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                      : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
                  }`}
                  title="Atur rombel/kelas mana saja yang diaktifkan atau dinonaktifkan untuk ujian"
                >
                  <Layers className="w-4 h-4" />
                  <span>Aktivasi Kelas Ujian</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[10px] font-mono">
                    {config.allClassesActive ?? true
                      ? `${availableClasses.length}/${availableClasses.length}`
                      : `${(config.activeClasses || []).filter((c) => availableClasses.includes(c)).length}/${availableClasses.length}`}
                  </span>
                </button>

                {/* Kelola Massal Siswa & Kelas Button */}
                <button
                  type="button"
                  id="open-bulk-edit-modal-btn"
                  onClick={() => setShowBulkEditModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-600/20 transition cursor-pointer"
                  title="Edit massal, tambah siswa baru, pindah kelas serentak, dan hapus data siswa massal"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Kelola / Edit Massal Siswa</span>
                </button>

                {/* Upload Excel / Doc file */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls,.csv,.doc,.txt,.docx"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  title="Upload Excel (.xlsx/.csv) atau File Dokumen (.doc/.txt)"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File Excel / Doc</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center space-x-1.5 border border-slate-700 transition"
                  title="Unduh format template Excel untuk impor siswa"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template Excel</span>
                </button>

                {/* Reset Login Siswa (Pilih Tertentu atau Semua) */}
                <button
                  type="button"
                  onClick={() => {
                    setResetModalInitialIds(selectedStudentIds);
                    setShowResetLoginModal(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Fitur Reset Login: Pilih siswa tertentu atau reset semua peserta ujian"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Login Siswa</span>
                  <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded font-bold hidden lg:inline">
                    Pilih / Semua
                  </span>
                </button>

                {/* Bersihkan Data Siswa Ganda / Duplikat */}
                <button
                  type="button"
                  onClick={async () => {
                    if (onCleanupDuplicateStudents) {
                      const res = await onCleanupDuplicateStudents();
                      if (res.totalCleaned > 0) {
                        setStudentSuccessToast(`Berhasil membersihkan ${res.totalCleaned} data siswa ganda! Data siswa kini unik dan tersinkronisasi.`);
                      } else {
                        setStudentSuccessToast("Seluruh data siswa sudah unik dan rapi. Tidak ditemukan data ganda.");
                      }
                      setTimeout(() => setStudentSuccessToast(null), 4500);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer ${
                    duplicateStudentsCount > 0
                      ? "bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500 animate-pulse"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  }`}
                  title="Deteksi dan bersihkan data siswa ganda/duplikat secara otomatis"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bersihkan Data Ganda</span>
                  {duplicateStudentsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                      {duplicateStudentsCount}
                    </span>
                  )}
                </button>

                {/* Segarkan / Tampilkan Semua Siswa dari Database */}
                <button
                  type="button"
                  disabled={isRefreshingData}
                  onClick={async () => {
                    setIsRefreshingData(true);
                    try {
                      // 1. Matikan filter kelas aktif ujian agar seluruh data siswa langsung ditampilkan
                      setShowOnlyActiveExam(false);
                      // 2. Reset filter kelas ke "ALL" (Semua Kelas)
                      setStudentClassFilter("ALL");
                      // 3. Bersihkan pencarian nama/nisn
                      setSearchTerm("");
                      // 4. Reset filter di tab cetak kartu barcode / QR dan hasil ujian
                      setBarcodeClassFilter("ALL");
                      setBarcodeSearchTerm("");
                      setResultsClassFilter("ALL");

                      if (onRefreshAllData) {
                        const count = await onRefreshAllData();
                        setStudentSuccessToast(`Sinkronisasi berhasil! Seluruh ${count} data siswa dari database Cloud Firebase & Server berhasil dimuat dan ditampilkan.`);
                        setTimeout(() => setStudentSuccessToast(null), 5000);
                      }
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsRefreshingData(false);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Muat ulang dan tampilkan seluruh data siswa dari database cloud Firestore & server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingData ? "animate-spin text-cyan-400" : "text-cyan-400"}`} />
                  <span>{isRefreshingData ? "Menyinkronkan..." : "Sinkron / Tampilkan Semua Siswa"}</span>
                </button>

                {/* Hapus Data Sampel Siswa */}
                {sampleStudentsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: "Hapus Data Sampel Siswa",
                        message: `Apakah Anda yakin ingin menghapus seluruh ${sampleStudentsCount} data sampel siswa bawaan sistem?`,
                        detail: "Tindakan ini akan mengosongkan data siswa contoh agar sistem bersih dan siap diisi data siswa riil sekolah Anda.",
                        confirmLabel: `Hapus ${sampleStudentsCount} Data Sampel`,
                        variant: "danger",
                        onConfirm: () => {
                          onDeleteSampleStudents?.();
                          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                          setStudentSuccessToast("Seluruh data sampel siswa bawaan berhasil dibersihkan.");
                          setTimeout(() => setStudentSuccessToast(null), 4000);
                        },
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                    title="Hapus semua data siswa contoh/sampel bawaan aplikasi"
                  >
                    <UserMinus className="w-4 h-4 text-rose-400" />
                    <span>Hapus Data Sampel ({sampleStudentsCount})</span>
                  </button>
                )}

                {/* Bulk Edit Students for Selected Students */}
                {selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    id="bulk-edit-selected-btn"
                    onClick={() => setShowBulkEditModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-600/20 transition cursor-pointer"
                    title="Edit massal nama siswa dan kelas untuk siswa terpilih"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Massal Terpilih ({selectedStudentIds.length})</span>
                  </button>
                )}

                {/* Bulk Reset Login for Selected Students */}
                {selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkResetLogins}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
                    title="Reset izin login hanya untuk siswa-siswa yang dicentang"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset Login Terpilih ({selectedStudentIds.length})</span>
                  </button>
                )}

                {/* Bulk Delete */}
                {selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-rose-600/20 transition animate-pulse cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Terpilih ({selectedStudentIds.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notification Toast for Student Operations */}
            {studentSuccessToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="font-semibold">{studentSuccessToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStudentSuccessToast(null)}
                  className="text-emerald-400 hover:text-emerald-200 text-xs font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Active Mode Status Banner */}
            {showOnlyActiveExam && inactiveExamStudentsCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-xs text-emerald-300 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-200">
                    Menampilkan {filteredStudents.length} siswa dari kelas yang diaktifkan untuk ujian.
                  </span>
                  <span className="text-slate-400">
                    ({inactiveExamStudentsCount} siswa dari kelas non-aktif tidak ditampilkan).
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowClassActivationModal(true)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-semibold text-[11px] transition cursor-pointer"
                  >
                    Atur Kelas Ujian ({config.allClassesActive ?? true ? availableClasses.length : (config.activeClasses || []).filter((c) => availableClasses.includes(c)).length}/{availableClasses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnlyActiveExam(false);
                      setStudentClassFilter("ALL");
                      setSearchTerm("");
                    }}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition cursor-pointer"
                    title="Tampilkan semua siswa termasuk yang berstatus Nonaktif Ujian"
                  >
                    Tampilkan Semua
                  </button>
                </div>
              </div>
            )}

            {/* Quick Active Class Filter Chips (Directly switch between active classes like X C, XII PSP 7, etc.) */}
            {showOnlyActiveExam && (
              <div className="flex items-center space-x-2 overflow-x-auto py-1 px-1 text-xs">
                <span className="text-slate-400 font-semibold text-[11px] shrink-0">
                  Rombel Aktif:
                </span>
                <button
                  type="button"
                  onClick={() => setStudentClassFilter("ALL")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                    studentClassFilter === "ALL"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  <span>Semua Kelas Aktif</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[10px] font-mono">
                    {activeExamStudents.length}
                  </span>
                </button>
                {availableClasses
                  .filter((cls) => isExamClassActive(config, cls))
                  .map((cls) => {
                    const count = students.filter(
                      (s) =>
                        (s?.className || "").trim().replace(/\s+/g, " ").toLowerCase() ===
                        (cls || "").trim().replace(/\s+/g, " ").toLowerCase()
                    ).length;
                    const isSelected =
                      (studentClassFilter || "").trim().replace(/\s+/g, " ").toLowerCase() ===
                      (cls || "").trim().replace(/\s+/g, " ").toLowerCase();
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setStudentClassFilter(cls)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                            : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                        }`}
                      >
                        <span>{cls}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[10px] font-mono">
                          {count}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}

            {!showOnlyActiveExam && inactiveExamStudentsCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-amber-950/40 border border-amber-800/60 rounded-2xl text-xs text-amber-300 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-200">
                    Menampilkan semua siswa ({inactiveExamStudentsCount} siswa berstatus Nonaktif Ujian).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnlyActiveExam(true)}
                  className="px-2.5 py-1 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 font-semibold text-[11px] transition cursor-pointer shrink-0"
                >
                  Sembunyikan Siswa Nonaktif Ujian
                </button>
              </div>
            )}

            {/* Active Class Filter Banner with Class Management & Deletion Actions */}
            {studentClassFilter !== "ALL" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-indigo-950/45 border border-indigo-800/60 rounded-2xl text-xs text-indigo-300 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">Filter Aktif:</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
                    Kelas {studentClassFilter}
                  </span>
                  <span className="text-slate-300 font-medium">
                    ({filteredStudents.length} Siswa {showOnlyActiveExam ? "Aktif Ujian" : "Terdaftar"})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Kosongkan Siswa di Kelas Ini */}
                  {filteredStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetCls = studentClassFilter;
                        const count = filteredStudents.length;
                        setConfirmDialog({
                          isOpen: true,
                          title: `Kosongkan Siswa Kelas ${targetCls}`,
                          message: `Apakah Anda yakin ingin menghapus seluruh ${count} data siswa di Kelas "${targetCls}"?`,
                          detail: "Nama kelas tetap terdaftar, tetapi seluruh akun siswa, barcode token, dan nilai ujian di dalamnya akan dihapus.",
                          confirmLabel: `Kosongkan ${count} Siswa`,
                          variant: "danger",
                          onConfirm: () => {
                            handleEmptyClass(targetCls);
                            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                          },
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 border border-amber-800/60 font-semibold text-[11px] flex items-center space-x-1.5 transition cursor-pointer"
                      title="Hapus semua siswa di kelas ini tanpa menghapus kelas"
                    >
                      <UserMinus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kosongkan Siswa ({filteredStudents.length})</span>
                    </button>
                  )}

                  {/* Hapus Kelas Ini (Beserta Siswanya) */}
                  <button
                    type="button"
                    onClick={() => {
                      const targetCls = studentClassFilter;
                      const count = filteredStudents.length;
                      setConfirmDialog({
                        isOpen: true,
                        title: `Hapus Kelas "${targetCls}"`,
                        message:
                          count > 0
                            ? `Apakah Anda yakin ingin menghapus Kelas "${targetCls}" beserta seluruh ${count} siswa di dalamnya?`
                            : `Apakah Anda yakin ingin menghapus Kelas "${targetCls}" dari daftar kelas?`,
                        detail:
                          count > 0
                            ? "Kelas ini dan seluruh data akun siswa, barcode login, dan nilainya akan dihapus permanen dari sistem ujian."
                            : "Kelas ini belum memiliki siswa dan akan segera dihapus dari daftar rombel.",
                        confirmLabel: count > 0 ? `Ya, Hapus Kelas & ${count} Siswa` : "Ya, Hapus Kelas",
                        variant: "danger",
                        onConfirm: () => {
                          handleDeleteClass(targetCls, true);
                          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                        },
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/70 font-semibold text-[11px] flex items-center space-x-1.5 transition cursor-pointer"
                    title="Hapus kelas ini dari sistem"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Hapus Kelas Ini</span>
                  </button>

                  {filteredStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowBulkEditModal(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-800/70 font-semibold text-[11px] flex items-center space-x-1.5 transition cursor-pointer"
                      title={`Edit massal data siswa dan nama kelas untuk rombel ${studentClassFilter}`}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Edit Massal Kelas Ini ({filteredStudents.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setStudentClassFilter("ALL")}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer"
                  >
                    ✕ Semua Kelas
                  </button>
                </div>
              </div>
            )}

            {/* Students Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-slate-400 hover:text-white"
                      >
                        {selectedStudentIds.length === filteredStudents.length &&
                        filteredStudents.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">NISN &amp; Nama Siswa</th>
                    <th className="p-3.5">Kelas</th>
                    <th className="p-3.5">Token Barcode</th>
                    <th className="p-3.5">Status Login</th>
                    <th className="p-3.5">Status Ujian</th>
                    <th className="p-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        {showOnlyActiveExam && inactiveExamStudentsCount > 0 ? (
                          <div className="space-y-2 py-4">
                            <p className="text-slate-300 font-semibold">
                              Tidak ada siswa dari kelas yang aktif untuk ujian pada filter ini.
                            </p>
                            <p className="text-xs text-slate-500">
                              ({inactiveExamStudentsCount} siswa terdaftar di kelas yang saat ini berstatus Nonaktif Ujian).
                            </p>
                            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setShowClassActivationModal(true)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                              >
                                Buka Pengaturan Aktivasi Kelas
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowOnlyActiveExam(false);
                                  setStudentClassFilter("ALL");
                                  setSearchTerm("");
                                }}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                              >
                                Tampilkan Semua Siswa
                              </button>
                            </div>
                          </div>
                        ) : (
                          "Tidak ada siswa yang ditemukan."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st) => {
                      const isSelected = selectedStudentIds.includes(st.id);
                      return (
                        <tr
                          key={st.id}
                          className={`hover:bg-slate-800/40 transition ${
                            isSelected ? "bg-blue-950/20" : ""
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(st.id)}
                              className="text-slate-400 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center space-x-2">
                              <p className="font-bold text-slate-200">{st.name}</p>
                              {isSampleStudent(st) && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Sampel
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">
                              NISN: {st.nisn} &bull; User: {st.username}
                            </p>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-slate-300 font-semibold">{st.className}</span>
                              {!isExamClassActive(config, st.className) && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  title="Kelas ini dinonaktifkan dari sesi ujian oleh Guru/Admin"
                                >
                                  Nonaktif Ujian
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono text-[11px] text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/20">
                              {st.startBarcodeToken}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {st.isLocked || st.loginCount >= 1 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                <Lock className="w-3 h-3" />
                                <span>Terkunci ({st.loginCount}x login)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <Unlock className="w-3 h-3" />
                                <span>Siap Login (0x)</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                st.examStatus === "submitted"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : st.examStatus === "disqualified"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : st.examStatus === "in_progress"
                                  ? "bg-blue-500/20 text-blue-400 animate-pulse"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {st.examStatus === "submitted"
                                ? `Selesai (${st.totalScore})`
                                : st.examStatus === "disqualified"
                                ? "Didiskualifikasi"
                                : st.examStatus === "in_progress"
                                ? "Mengerjakan"
                                : "Belum Mulai"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              {/* Reset login status button */}
                              <button
                                type="button"
                                onClick={() => {
                                  onResetStudentLogin(st.id);
                                  setStudentSuccessToast(`Status login siswa "${st.name}" (${st.className}) berhasil direset.`);
                                  setTimeout(() => setStudentSuccessToast(null), 4000);
                                }}
                                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition"
                                title={`Reset status login "${st.name}" agar bisa login kembali`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(st)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                title="Edit Siswa"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: "Hapus Data Siswa",
                                    message: `Apakah Anda yakin ingin menghapus data siswa "${st.name}"?`,
                                    detail: `NISN: ${st.nisn} • Kelas: ${st.className}. Seluruh riwayat ujian dan barcode login siswa ini akan dihapus permanen.`,
                                    confirmLabel: "Hapus Siswa",
                                    variant: "danger",
                                    onConfirm: () => {
                                      onDeleteStudent(st.id);
                                      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                                      setStudentSuccessToast(`Data siswa "${st.name}" berhasil dihapus.`);
                                      setTimeout(() => setStudentSuccessToast(null), 4000);
                                    },
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition cursor-pointer"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REKAP NILAI & EXPORT PDF/EXCEL */}
        {activeTab === "results" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white">
                  Rekapitulasi Nilai &amp; Export Berkas
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Export laporan nilai terverifikasi dalam format resmi PDF dan Spreadsheet Excel
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filter Kelas Rekap */}
                <select
                  value={resultsClassFilter}
                  onChange={(e) => setResultsClassFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  title="Filter rekap nilai berdasarkan kelas"
                >
                  <option value="ALL">Semua Kelas ({students.length})</option>
                  {availableClasses.map((cls) => {
                    const count = students.filter(
                      (s) => (s?.className || "").trim().toLowerCase() === (cls || "").trim().toLowerCase()
                    ).length;
                    return (
                      <option key={cls} value={cls}>
                        {cls} ({count})
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => exportResultsToExcel(filteredResultsStudents, config.subject, config)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export ke Excel ({filteredResultsStudents.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportResultsToPDF(filteredResultsStudents, config.subject, config)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-rose-600/20 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Export ke PDF ({filteredResultsStudents.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGoogleDriveModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-amber-600/20 transition cursor-pointer"
                  title="Simpan rekap nilai siswa langsung ke Google Drive"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Simpan ke Drive</span>
                </button>
              </div>
            </div>

            {/* KKM & Kelulusan Quick Stats & Edit Bar */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                {/* Current KKM Badge */}
                <div className="flex items-center space-x-2.5 bg-amber-950/40 border border-amber-500/40 px-3.5 py-2 rounded-xl">
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-amber-300/80 uppercase font-bold block">KKM Ujian</span>
                    <span className="text-base font-black text-amber-300 font-mono leading-none">
                      {config.passingScore} <span className="text-[11px] font-normal text-amber-400/80">Poin</span>
                    </span>
                  </div>
                  {onUpdateExamConfig && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKkmValue(config.passingScore);
                        setShowKkmModal(true);
                      }}
                      className="ml-2 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center space-x-1 transition cursor-pointer"
                      title="Ubah nilai KKM ujian ini"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Ubah KKM</span>
                    </button>
                  )}
                </div>

                {/* Quick KKM Presets */}
                {onUpdateExamConfig && (
                  <div className="hidden lg:flex items-center space-x-1 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-semibold mr-1">Preset:</span>
                    {[60, 65, 70, 75, 80, 85].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleApplyKKM(val)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                          config.passingScore === val
                            ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                        title={`Set KKM langsung ke ${val}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}

                {/* Live Graduation Stats */}
                <div className="flex items-center space-x-4 border-l border-slate-800 pl-4">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-medium">Lulus (≥ {config.passingScore})</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {filteredResultsStudents.filter((s) => s.examStatus !== "disqualified" && s.totalScore >= config.passingScore).length}
                      <span className="text-[11px] text-slate-500 font-normal ml-1">
                        ({filteredResultsStudents.length > 0 ? Math.round((filteredResultsStudents.filter((s) => s.examStatus !== "disqualified" && s.totalScore >= config.passingScore).length / filteredResultsStudents.length) * 100) : 0}%)
                      </span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block font-medium">Belum Tuntas (&lt; {config.passingScore})</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">
                      {filteredResultsStudents.filter((s) => s.examStatus !== "disqualified" && s.totalScore < config.passingScore).length}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block font-medium">Rata-Rata</span>
                    <span className="text-sm font-bold text-blue-400 font-mono">
                      {filteredResultsStudents.length > 0 ? Math.round(filteredResultsStudents.reduce((a, b) => a + b.totalScore, 0) / filteredResultsStudents.length) : 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Note */}
              <p className="text-[11px] text-slate-500 italic">
                * Nilai KKM menentukan kelulusan di Duck Race, cetak PDF &amp; Excel.
              </p>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Nama &amp; NISN</th>
                    <th className="p-3.5">Kelas</th>
                    <th className="p-3.5">Skor PG</th>
                    <th className="p-3.5">Skor Essay</th>
                    <th className="p-3.5">Total Nilai</th>
                    <th className="p-3.5">Pelanggaran</th>
                    <th className="p-3.5">
                      <div className="flex items-center space-x-1.5">
                        <span>Kelulusan (KKM: {config.passingScore})</span>
                        {onUpdateExamConfig && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingKkmValue(config.passingScore);
                              setShowKkmModal(true);
                            }}
                            className="p-1 hover:bg-slate-800 rounded text-amber-400 hover:text-amber-300 transition cursor-pointer"
                            title="Klik untuk ubah KKM"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredResultsStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Tidak ada data hasil ujian untuk kelas ini.
                      </td>
                    </tr>
                  ) : (
                    filteredResultsStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <p className="font-bold text-slate-200">{st.name}</p>
                        <p className="text-[11px] text-slate-500">{st.nisn}</p>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-300">{st.className}</td>
                      <td className="p-3.5 font-mono text-blue-400 font-bold">{st.mcqScore}</td>
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">{st.essayScore}</td>
                      <td className="p-3.5 font-mono text-sm font-extrabold text-white">
                        {st.totalScore}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                            st.violationsCount > 0
                              ? "bg-rose-500/20 text-rose-400"
                              : "text-slate-400"
                          }`}
                        >
                          {st.violationsCount}x
                        </span>
                      </td>
                      <td className="p-3.5">
                        {st.examStatus === "disqualified" ? (
                          <span className="text-rose-400 font-extrabold">DIDISKUALIFIKASI</span>
                        ) : st.totalScore >= config.passingScore ? (
                          <span className="text-emerald-400 font-extrabold">LULUS</span>
                        ) : (
                          <span className="text-amber-400 font-extrabold">BELUM TUNTAS</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DUCK RACE LIVE */}
        {activeTab === "duckrace" && (
          <DuckRaceLive
            students={students}
            config={config}
            questions={questions}
            onUpdateExamConfig={onUpdateExamConfig}
          />
        )}

        {/* TAB 4: KARTU BARCODE SISWA (Sajikan Barcode per Siswa) */}
        {activeTab === "barcodes" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center space-x-2">
                    <QrCode className="w-5 h-5 text-blue-400" />
                    <span>Kartu Barcode &amp; QR Code Ujian Siswa</span>
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase">
                    Google Lens Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  QR Code resmi HD berstandar internasional &mdash; 100% terbaca jelas oleh Google Lens, kamera smartphone, dan scanner barcode USB.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLoginPortalQrModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  title="Buka QR Code untuk akses menu laman login siswa (Google Lens / Proyektor)"
                >
                  <QrCode className="w-4 h-4 text-indigo-200" />
                  <span>QR Akses Laman Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
                  title="Cetak kartu peserta dalam tata letak siap cetak"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Kartu Peserta</span>
                </button>
              </div>
            </div>

            {/* Audit Status & Purpose Banner (Unik & Bebas Duplikat) */}
            <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg ${
              tokenAudit.isValid
                ? "bg-gradient-to-r from-emerald-950/50 via-slate-900 to-teal-950/40 border-emerald-500/30"
                : "bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/40 border-rose-500/50"
            }`}>
              <div className="flex items-start space-x-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                  tokenAudit.isValid
                    ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-600/20 text-rose-400 border-rose-500/30 animate-pulse"
                }`}>
                  {tokenAudit.isValid ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h4 className="text-sm font-bold text-white">
                      {tokenAudit.isValid
                        ? "Validasi Barcode Siswa: 100% Unik & Bebas Duplikat"
                        : `Peringatan: Ditemukan ${tokenAudit.duplicateCount} Barcode Duplikat`}
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      tokenAudit.isValid
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    }`}>
                      {tokenAudit.isValid ? "0 Duplikat" : `${tokenAudit.duplicateCount} Duplikat`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    <strong>Peruntukan Barcode Siswa:</strong> Digunakan untuk kartu peserta, login otomatis, dan absensi peserta di ruang ujian.
                    Total <strong>{tokenAudit.totalStudents} siswa</strong> terdaftar memiliki <strong>{tokenAudit.uniqueCount} token barcode unik</strong>.
                    {!tokenAudit.isValid && " Segera perbaiki token yang bertabrakan agar tidak terjadi konflik akun."}
                  </p>
                </div>
              </div>

              {!tokenAudit.isValid && onBulkUpdateStudents && (
                <button
                  type="button"
                  disabled={isFixingTokens}
                  onClick={handleFixDuplicateTokens}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-rose-600/25 transition cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isFixingTokens ? "animate-spin" : ""}`} />
                  <span>{isFixingTokens ? "Memperbaiki..." : "Perbaiki Semua Duplikat"}</span>
                </button>
              )}
            </div>

            {/* Featured Classroom Banner: QR Akses Laman Login Siswa */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-white">
                      Barcode Akses Masuk Menu Laman Login Siswa
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold uppercase">
                      Google Lens Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
                    Siswa tidak perlu mengetik alamat URL portal yang panjang. Cukup pindai barcode ini dengan <strong>Google Lens</strong> atau kamera smartphone untuk langsung membuka laman login ujian di HP mereka.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setShowLoginPortalQrModal(true)}
                  className="w-full md:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/25 transition cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Tampilkan &amp; Proyeksikan QR</span>
                </button>
              </div>
            </div>

            {/* Google Lens Guide & QR Format Mode Selector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="lg:col-span-7 flex items-start space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <h4 className="font-bold text-slate-200">
                    Optimalisasi Google Lens &amp; Kamera HP Siswa
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Siswa cukup mengarahkan <strong>Google Lens</strong> ke QR code. Mode <strong>&ldquo;Tautan Langsung Web&rdquo;</strong> akan langsung memunculkan tombol chip <em>Buka Situs</em> dan membawa siswa otomatis masuk ke akun ujiannya tanpa input NISN manual.
                  </p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="lg:col-span-5 flex flex-col justify-center space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">
                  Format Isi Data QR Code:
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setBarcodeQrFormat("url")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                      barcodeQrFormat === "url"
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>Tautan Web (Google Lens)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarcodeQrFormat("token")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                      barcodeQrFormat === "token"
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>Hanya Kode Token</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={barcodeSearchTerm}
                  onChange={(e) => {
                    setBarcodeSearchTerm(e.target.value);
                    setBarcodePage(1);
                  }}
                  placeholder="Cari nama, NISN, atau token..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <select
                  value={barcodeClassFilter}
                  onChange={(e) => {
                    setBarcodeClassFilter(e.target.value);
                    setBarcodePage(1);
                  }}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls}
                    </option>
                  ))}
                </select>

                <span className="text-xs text-slate-400 whitespace-nowrap">
                  Menampilkan <strong>{filteredBarcodeStudents.length}</strong> kartu
                </span>
              </div>
            </div>

            {/* Grid of Student Cards with Real QR Code */}
            {filteredBarcodeStudents.length === 0 ? (
              <div className="p-12 text-center bg-slate-950/40 border border-slate-800 rounded-2xl">
                <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="font-bold text-sm text-slate-300">Tidak ada kartu peserta yang sesuai</h4>
                <p className="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter kelas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedBarcodeStudents.map((st) => (
                  <StudentQrCard
                    key={st.id}
                    student={st}
                    qrFormat={barcodeQrFormat}
                    institutionName="SMK / SMA Ujian Berstandar Nasional"
                    academicYear="2025/2026"
                    onOpenZoom={(student, qrDataUrl, payload) =>
                      setSelectedZoomStudent({ student, qrDataUrl, payload })
                    }
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalBarcodePages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
                <div className="text-slate-400">
                  Halaman <strong>{barcodePage}</strong> dari <strong>{totalBarcodePages}</strong> (Total {filteredBarcodeStudents.length} siswa)
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    disabled={barcodePage === 1}
                    onClick={() => setBarcodePage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  {Array.from({ length: Math.min(5, totalBarcodePages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalBarcodePages > 5) {
                      if (barcodePage > 3) {
                        pageNum = barcodePage - 2 + i;
                      }
                      if (pageNum > totalBarcodePages) {
                        pageNum = totalBarcodePages - 4 + i;
                      }
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setBarcodePage(pageNum)}
                        className={`w-8 h-8 rounded-lg font-bold transition cursor-pointer ${
                          barcodePage === pageNum
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={barcodePage === totalBarcodePages}
                    onClick={() => setBarcodePage((p) => Math.min(totalBarcodePages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold cursor-pointer"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: BANK SOAL */}
        {activeTab === "questions" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white">
                  Bank Soal (Pilihan Ganda, Benar/Salah, Menjodohkan, PG Kompleks, Isian &amp; Essay)
                </h2>
                <p className="text-xs text-slate-400">
                  Total {questions.length} butir soal aktif &bull; Dukungan Media (Gambar/Audio/Video), LaTeX Math KaTeX, dan Penilaian Otomatis
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Direct Add Question Button */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setShowQuestionEditor(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-blue-600/25 transition cursor-pointer"
                  title="Tambah butir soal baru langsung di aplikasi"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Soal Baru</span>
                </button>

                {/* 1b. Ekspor Bank Soal Button (PDF, Word, Excel, JSON) */}
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-600/25 transition cursor-pointer"
                  title="Ekspor Bank Soal ke format PDF (Cetak A4), Word (.doc), Excel (.xlsx), atau JSON Backup Fisik"
                >
                  <Download className="w-3.5 h-3.5 text-blue-200" />
                  <span>Ekspor Soal</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono font-extrabold">PDF / Word / Excel</span>
                </button>

                {/* 1c. Google Drive Question Bank Backup */}
                <button
                  type="button"
                  onClick={() => setShowGoogleDriveModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Simpan paket Bank Soal ke Google Drive"
                >
                  <Cloud className="w-3.5 h-3.5 text-amber-400" />
                  <span>Simpan ke Drive</span>
                </button>

                {/* 2. Download Word Template Button */}
                <button
                  type="button"
                  onClick={downloadWordTemplate}
                  className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Unduh template naskah soal lengkap dalam format Microsoft Word (.doc)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Template Word</span>
                </button>

                {/* 3. Upload Word Document Button */}
                <button
                  type="button"
                  onClick={() => setShowWordUploadModal(true)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Upload naskah soal dari berkas Word .doc atau .docx"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Upload Word</span>
                </button>

                {/* 4. Download Excel Template Button */}
                <button
                  type="button"
                  onClick={downloadExcelQuestionTemplate}
                  className="px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Unduh template tabel bank soal dalam format Microsoft Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Template Excel</span>
                </button>

                {/* 5. Upload Excel File Button */}
                <button
                  type="button"
                  onClick={() => excelQuestionFileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  title="Upload naskah soal dari berkas Excel .xlsx"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload Excel</span>
                </button>

                <input
                  type="file"
                  ref={excelQuestionFileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleExcelQuestionUpload}
                  className="hidden"
                />

                {/* 6. AI Question Generator Button */}
                <button
                  type="button"
                  onClick={() => setShowAiGenModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate AI</span>
                </button>

                {/* 7. Randomize Questions Quick Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = config.randomizeQuestions === false ? true : false;
                    onUpdateExamConfig({ randomizeQuestions: nextVal });
                    setStudentSuccessToast(
                      nextVal
                        ? "Pengacakan soal DIAKTIFKAN: Setiap siswa menerima nomor soal yang teracak unik otomatis."
                        : "Pengacakan soal DINONAKTIFKAN: Soal akan berurutan sesuai nomor asli."
                    );
                    setTimeout(() => setStudentSuccessToast(null), 5000);
                  }}
                  className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer ${
                    config.randomizeQuestions !== false
                      ? "bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40 shadow-sm"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                  }`}
                  title="Klik untuk mengubah status pengacakan urutan soal"
                >
                  <Shuffle className={`w-3.5 h-3.5 ${config.randomizeQuestions !== false ? "text-purple-400" : "text-slate-500"}`} />
                  <span>Acak Soal: {config.randomizeQuestions !== false ? "AKTIF" : "NONAKTIF"}</span>
                </button>
              </div>
            </div>

            {/* Anti-Cheating Banner (Informative) */}
            <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
              config.randomizeQuestions !== false
                ? "bg-purple-950/40 border-purple-500/30 text-purple-200"
                : "bg-slate-950/60 border-slate-800 text-slate-400"
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  config.randomizeQuestions !== false
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                    : "bg-slate-800 text-slate-500"
                }`}>
                  <Shuffle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center space-x-2">
                    <span className={config.randomizeQuestions !== false ? "text-purple-100" : "text-slate-300"}>
                      Proteksi Anti-Nyontek Siswa (Acak Urutan Soal &amp; Pilihan):
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      config.randomizeQuestions !== false
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {config.randomizeQuestions !== false ? "Aktif Otomatis" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {config.randomizeQuestions !== false
                      ? "Setiap siswa login menerima urutan soal unik berbasis seed NISN & ID Ujian. Siswa bersebelahan memiliki soal berbeda di setiap nomor."
                      : "Semua siswa akan menerima susunan nomor soal yang sama persis secara berurutan (risiko saling contek antar siswa)."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = config.randomizeQuestions === false ? true : false;
                  onUpdateExamConfig({ randomizeQuestions: nextVal });
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer self-start sm:self-auto shrink-0 ${
                  config.randomizeQuestions !== false
                    ? "bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border-purple-500/30"
                    : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500"
                }`}
              >
                {config.randomizeQuestions !== false ? "Ubah Pengaturan" : "Aktifkan Acak Soal"}
              </button>
            </div>

            {/* Word/Excel Import Success Notification */}
            {wordImportSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 flex items-center justify-between text-xs animate-in fade-in duration-200">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</span>
                  <span className="font-semibold">{wordImportSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWordImportSuccessMsg(null)}
                  className="text-emerald-400 hover:text-emerald-200 text-xs ml-3 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const typeLabel =
                  q.type === "mcq"
                    ? "Pilihan Ganda"
                    : q.type === "true_false"
                    ? "Benar / Salah"
                    : q.type === "matching"
                    ? "Menjodohkan"
                    : q.type === "multi_choice"
                    ? "PG Kompleks"
                    : q.type === "short_answer"
                    ? "Isian Singkat"
                    : "Uraian / Essay";

                const typeBadgeClass =
                  q.type === "mcq"
                    ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                    : q.type === "true_false"
                    ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-300"
                    : q.type === "matching"
                    ? "bg-purple-600/20 border-purple-500/30 text-purple-300"
                    : q.type === "multi_choice"
                    ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-300"
                    : q.type === "short_answer"
                    ? "bg-amber-600/20 border-amber-500/30 text-amber-300"
                    : "bg-teal-600/20 border-teal-500/30 text-teal-300";

                return (
                  <div
                    key={q.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${typeBadgeClass}`}>
                          {typeLabel}
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          {q.points} Poin
                        </span>

                        {/* Media Indicator Badges */}
                        {q.mediaType && q.mediaType !== "none" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 flex items-center space-x-1">
                            {q.mediaType === "image" && (
                              <>
                                <ImageIcon className="w-3 h-3 text-sky-400" />
                                <span>Gambar</span>
                              </>
                            )}
                            {q.mediaType === "audio" && (
                              <>
                                <Music className="w-3 h-3 text-violet-400" />
                                <span>Audio Listening ({q.audioPlayLimit || 2}x)</span>
                              </>
                            )}
                            {q.mediaType === "video" && (
                              <>
                                <Video className="w-3 h-3 text-rose-400" />
                                <span>Video</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {/* Direct Edit Question Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(q);
                            setShowQuestionEditor(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-blue-300 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                          title="Edit Butir Soal Langsung di Aplikasi"
                        >
                          <Pencil className="w-3.5 h-3.5 text-blue-400" />
                          <span>Edit</span>
                        </button>

                        {/* Delete Question Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus butir soal #${idx + 1}?`)) {
                              onDeleteQuestion(q.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Hapus Soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Text with KaTeX Formula */}
                    <div className="text-sm text-slate-100 font-medium leading-relaxed">
                      <MathRenderer text={q.question} />
                    </div>

                    {/* Media Preview if attached */}
                    {q.mediaType && q.mediaType !== "none" && q.mediaUrl && (
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                        <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-300">
                          <span className="capitalize">{q.mediaType}:</span>
                          <span className="truncate max-w-xs text-blue-400">{q.mediaUrl}</span>
                        </div>
                        {q.mediaCaption && (
                          <div className="text-[11px] italic text-slate-400">"{q.mediaCaption}"</div>
                        )}
                      </div>
                    )}

                    {/* 1. MCQ Options */}
                    {q.type === "mcq" && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-2.5 rounded-xl border text-xs flex items-start space-x-2 ${
                              oIdx === q.correctAnswer
                                ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300 font-bold"
                                : "bg-slate-900/60 border-slate-800/80 text-slate-400"
                            }`}
                          >
                            <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                            <div className="pt-0.5">
                              <MathRenderer text={opt} inline={true} />
                            </div>
                            {oIdx === q.correctAnswer && (
                              <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold shrink-0">
                                Kunci
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. True / False */}
                    {q.type === "true_false" && (
                      <div className="flex items-center space-x-2 pt-1">
                        <span className="text-xs text-slate-400">Kunci Jawaban:</span>
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${
                            q.correctBool === true
                              ? "bg-emerald-950/70 border-emerald-500 text-emerald-200"
                              : "bg-rose-950/70 border-rose-500 text-rose-200"
                          }`}
                        >
                          {q.correctBool === true ? "BENAR (TRUE)" : "SALAH (FALSE)"}
                        </span>
                      </div>
                    )}

                    {/* 3. Matching Pairs */}
                    {q.type === "matching" && q.matchingPairs && q.matchingPairs.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <span className="text-xs font-semibold text-slate-400">Pasangan Pernyataan &amp; Jawaban:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.matchingPairs.map((pair, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-2.5 rounded-xl bg-slate-900/80 border border-purple-500/30 text-xs flex items-center justify-between space-x-2"
                            >
                              <span className="text-slate-200 font-medium">{pair.left}</span>
                              <span className="text-purple-400 font-bold">&harr;</span>
                              <span className="text-purple-300 font-semibold">{pair.right}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Multi-Choice (PG Kompleks) */}
                    {q.type === "multi_choice" && q.options && (
                      <div className="space-y-1 pt-1">
                        <span className="text-xs font-semibold text-slate-400">Pilihan (Jawaban Lebih dari Satu):</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = q.correctAnswers?.includes(oIdx);
                            return (
                              <div
                                key={oIdx}
                                className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2 ${
                                  isCorrect
                                    ? "bg-indigo-950/40 border-indigo-500/50 text-indigo-200 font-bold"
                                    : "bg-slate-900/60 border-slate-800 text-slate-400"
                                }`}
                              >
                                <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                <span>{opt}</span>
                                {isCorrect && (
                                  <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold shrink-0">
                                    Benar
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 5. Short Answer */}
                    {q.type === "short_answer" && (
                      <div className="flex items-center space-x-2 pt-1 text-xs">
                        <span className="text-slate-400">Kunci Jawaban Singkat:</span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold">
                          {q.keyAnswer}
                        </span>
                      </div>
                    )}

                    {/* Key answer preview / Rubrik for Essay or Others */}
                    {q.type === "essay" && q.keyAnswer && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                        <strong className="text-slate-300">Rubrik / Sampel Jawaban:</strong> {q.keyAnswer}
                      </div>
                    )}

                    {/* Revision History & Last Modified Footer */}
                    <div className="pt-2.5 mt-2 border-t border-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center gap-1 text-slate-500">
                          <History className="w-3.5 h-3.5 text-slate-500" />
                          <span>Terakhir diubah:</span>
                        </span>
                        <span className="font-semibold text-slate-300">
                          {q.lastModifiedBy || "Admin"}
                        </span>
                        {q.lastModifiedAt && (
                          <span className="text-slate-500">
                            &bull; {new Date(q.lastModifiedAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRevisionQuestion(q);
                          setShowRevisionModal(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold flex items-center space-x-1.5 transition cursor-pointer self-start sm:self-auto"
                        title="Lihat riwayat revisi dan log perubahan butir soal ini"
                      >
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        <span>Riwayat Revisi {q.revisionHistory?.length ? `(${q.revisionHistory.length})` : ""}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: ANALISIS BUTIR SOAL & VALIDASI AI */}
        {activeTab === "item_analysis" && (
          <ErrorBoundary fallbackTitle="Analisis Butir Soal & Rubrik AI">
            <ItemAnalysisView
              questions={questions}
              students={students}
              config={config}
              rubricConfig={config.aiRubricConfig}
              onOpenRubricTuning={() => setShowRubricTuningModal(true)}
              onSelectQuestionForEdit={(q) => {
                setEditingQuestion(q);
                setShowQuestionEditor(true);
              }}
            />
          </ErrorBoundary>
        )}

        {/* TAB 6: LOG AUDIT KEAMANAN REAL-TIME */}
        {activeTab === "violations" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5">
            {/* Header with Live Sync Status & Control Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">
                    Log Audit Pelanggaran Keamanan Real-Time
                  </h2>
                  <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Real-Time Stream Aktif</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Mencatat seketika (sub-detik) perpindahan tab, kehilangan fokus jendela, keluar layar penuh, percobaan copy-paste, dan AI proctoring webcam.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Audio Alert Toggle */}
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                    soundEnabled
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                  title={soundEnabled ? "Bunyi alarm aktif saat pelanggaran baru terdeteksi" : "Bunyi alarm dinonaktifkan"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
                  <span>{soundEnabled ? "Alarm Suara: ON" : "Alarm Suara: MUTE"}</span>
                </button>

                {/* Export Violations to Excel */}
                <button
                  type="button"
                  onClick={handleExportViolations}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow"
                  title="Unduh rekap bukti pelanggaran dalam format Excel"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Ekspor Excel</span>
                </button>

                {/* Clear / Reset Violations */}
                {currentUser.role === "admin" && (
                  <button
                    type="button"
                    disabled={isClearingViolations || liveViolations.length === 0}
                    onClick={handleClearViolations}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Hapus seluruh rekaman pelanggaran keamanan"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isClearingViolations ? "Membersihkan..." : "Bersihkan Log"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Real-time Toast Alert */}
            {newViolationToast && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-rose-950/80 to-slate-900 border border-rose-500/50 flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-2 text-xs text-rose-200 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Insiden Baru Diterima Secara Real-Time: {newViolationToast}</span>
                </div>
                <span className="text-[10px] text-rose-400/80 font-mono">Baru saja</span>
              </div>
            )}

            {/* Statistics Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Pelanggaran</span>
                <span className="text-xl font-black text-rose-400 mt-0.5">{liveViolations.length}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Siswa Terlibat</span>
                <span className="text-xl font-black text-amber-400 mt-0.5">
                  {new Set(liveViolations.map((v) => v.studentName)).size}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Terbanyak: Tab Switch</span>
                <span className="text-xl font-black text-blue-400 mt-0.5">
                  {liveViolations.filter((v) => v.type === "TAB_SWITCH").length}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">AI Proctor Terdeteksi</span>
                <span className="text-xl font-black text-purple-400 mt-0.5">
                  {liveViolations.filter((v) => v.type === "AI_PROCTOR_SUSPECT").length}
                </span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              {/* Search */}
              <div className="sm:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={violationSearchTerm}
                  onChange={(e) => setViolationSearchTerm(e.target.value)}
                  placeholder="Cari siswa, NISN, atau insiden..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Class Filter */}
              <div className="sm:col-span-4">
                <select
                  value={violationClassFilter}
                  onChange={(e) => setViolationClassFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="ALL">Semua Kelas ({liveViolations.length} Insiden)</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls} (
                      {liveViolations.filter((v) => (v.className || "").toLowerCase() === cls.toLowerCase()).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="sm:col-span-3">
                <select
                  value={violationTypeFilter}
                  onChange={(e) => setViolationTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="ALL">Semua Tipe Pelanggaran</option>
                  <option value="TAB_SWITCH">Perpindahan Tab Browser</option>
                  <option value="WINDOW_BLUR">Kehilangan Fokus Jendela</option>
                  <option value="FULLSCREEN_EXIT">Keluar Layar Penuh</option>
                  <option value="COPY_PASTE">Percobaan Copy / Paste</option>
                  <option value="RIGHT_CLICK">Klik Kanan / Menu</option>
                  <option value="AI_PROCTOR_SUSPECT">AI Proctor Webcam</option>
                  <option value="DEVTOOLS">Inspeksi Pengembang / F12</option>
                  <option value="SCREENSHOT">Percobaan Screenshot</option>
                </select>
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Waktu</th>
                    <th className="p-3.5">Siswa</th>
                    <th className="p-3.5">Tipe Pelanggaran</th>
                    <th className="p-3.5">Detail Insiden</th>
                    <th className="p-3.5 text-center">Foto Bukti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredViolations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {liveViolations.length === 0
                          ? "Belum ada insiden pelanggaran keamanan yang tercatat."
                          : "Tidak ada insiden yang cocok dengan filter pencarian."}
                      </td>
                    </tr>
                  ) : (
                    filteredViolations.map((v, i) => (
                      <tr key={v.id || i} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {v.timestamp}
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-slate-200">{v.studentName}</p>
                          <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                            <span>Kelas: {v.className}</span>
                            {v.nisn && <span>&bull; NISN: {v.nisn}</span>}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${
                              v.type === "AI_PROCTOR_SUSPECT"
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                : v.type === "TAB_SWITCH" || v.type === "FULLSCREEN_EXIT"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {v.title}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300 leading-relaxed max-w-sm">
                          {v.description}
                        </td>
                        <td className="p-3.5 text-center">
                          {v.snapshot ? (
                            <button
                              type="button"
                              onClick={() => setSelectedSnapshot(v)}
                              className="group relative inline-block rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 transition cursor-pointer"
                              title="Klik untuk melihat foto bukti dalam ukuran penuh"
                            >
                              <img
                                src={v.snapshot}
                                alt="Bukti Snapshot"
                                className="w-16 h-12 object-cover transition group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <Maximize2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Lightbox Modal for Snapshot Inspection */}
            {selectedSnapshot && (
              <div
                className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setSelectedSnapshot(null)}
              >
                <div
                  className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Bukti Foto Snapshot Pelanggaran
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {selectedSnapshot.studentName} ({selectedSnapshot.className}) &bull; {selectedSnapshot.timestamp}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSnapshot(null)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
                    <img
                      src={selectedSnapshot.snapshot}
                      alt="Snapshot Bukti"
                      className="max-h-80 w-auto object-contain"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <p className="font-bold text-rose-300">{selectedSnapshot.title}</p>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {selectedSnapshot.description}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedSnapshot(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Tutup Pratinjau
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: PENGATURAN ADMIN & SISTEM */}
        {activeTab === "settings" && (
          <AdminSettingsView
            currentUser={currentUser}
            examConfig={config}
            totalStudents={students.length}
            totalQuestions={questions.length}
            sampleStudentsCount={sampleStudentsCount}
            onDeleteSampleStudents={onDeleteSampleStudents}
            onUpdateAdminProfile={onUpdateAdminProfile}
            onUpdateExamConfig={onUpdateExamConfig}
            onResetStudentLogin={onResetStudentLogin}
            onResetMultipleStudentsLogin={onResetMultipleStudentsLogin}
            onResetAllStudentsLogin={onResetAllStudentsLogin}
            onResetAllExamData={onResetAllExamData}
            onRestoreDefaultExamConfig={onRestoreDefaultExamConfig}
            onGenerate1000Students={onGenerate1000Students}
            onRestoreInitialStudents={onRestoreInitialStudents}
            hasAdminCustomData={hasAdminCustomData}
            lastSyncTime={lastSyncTime}
            isSyncing={isSyncing}
            onExportDatabase={onExportDatabase}
            onImportDatabase={onImportDatabase}
            onFetchBackups={onFetchBackups}
            onRestoreBackup={onRestoreBackup}
            onCreateManualBackup={onCreateManualBackup}
            availableClasses={availableClasses}
            students={students}
          />
        )}
      </div>

      {/* Student Form Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingStudentId ? "Edit Data Siswa" : "Tambah Siswa Baru"}
            </h3>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nama Siswa</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Muhammad Ilham"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">NISN (Nomor Induk)</label>
                <input
                  type="text"
                  required
                  value={formData.nisn}
                  onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                  placeholder="Contoh: 0051234999"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Kelas</label>
                <input
                  type="text"
                  required
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  placeholder="Contoh: XII RPL 1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Username Login</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Contoh: ilham01"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showStudentPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimal 6 karakter"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-9 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword(!showStudentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition focus:outline-none cursor-pointer"
                    aria-label={showStudentPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    title={showStudentPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showStudentPassword ? (
                      <EyeOff className="w-3.5 h-3.5 text-slate-300 hover:text-white" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Question Generator Modal */}
      {showAiGenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center space-x-2 text-cyan-400 mb-3">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-base font-extrabold text-white">
                Buat Soal Otomatis dengan Gemini 3.8 Flash
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Kecerdasan buatan akan merancang butir soal pilihan ganda dan essay lengkap dengan
              kunci jawaban dan rubrik penilaian otomatis.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Topik / Materi Ujian:
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Jumlah Soal yang Dibuat:
                </label>
                <select
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                >
                  <option value={2}>2 Butir Soal (1 PG + 1 Essay)</option>
                  <option value={3}>3 Butir Soal (2 PG + 1 Essay)</option>
                  <option value={5}>5 Butir Soal (3 PG + 2 Essay)</option>
                </select>
              </div>

              {aiGenMessage && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300">
                  {aiGenMessage}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => setShowAiGenModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleGenerateAiQuestions}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sedang Merancang Soal...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Question Editor & Creator Modal */}
      {showQuestionEditor && (
        <QuestionEditorModal
          initialQuestion={editingQuestion || undefined}
          onClose={() => {
            setShowQuestionEditor(false);
            setEditingQuestion(null);
          }}
          onOpenRevisionHistory={(q) => {
            setSelectedRevisionQuestion(q);
            setShowRevisionModal(true);
          }}
          onSave={(saved) => {
            if (editingQuestion && editingQuestion.id) {
              if (onUpdateQuestion) {
                onUpdateQuestion(editingQuestion.id, saved);
              }
              setStudentSuccessToast("Butir soal berhasil diperbarui!");
            } else {
              onAddQuestion(saved);
              setStudentSuccessToast("Butir soal baru berhasil ditambahkan ke Bank Soal!");
            }
            setTimeout(() => setStudentSuccessToast(null), 5000);
            setShowQuestionEditor(false);
            setEditingQuestion(null);
          }}
        />
      )}

      {/* Export Bank Soal Modal (PDF, Word, Excel, JSON) */}
      <ExportQuestionsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        questions={questions}
        config={config}
      />

      {/* Question Revision History (Audit Log & Rollback) Modal */}
      <QuestionRevisionHistoryModal
        isOpen={showRevisionModal}
        onClose={() => {
          setShowRevisionModal(false);
          setSelectedRevisionQuestion(null);
        }}
        question={
          selectedRevisionQuestion
            ? questions.find((q) => q.id === selectedRevisionQuestion.id) || selectedRevisionQuestion
            : null
        }
        onRestoreRevision={(questionId, revisionId) => {
          if (onRestoreQuestionRevision) {
            onRestoreQuestionRevision(questionId, revisionId);
          }
          const updated = questions.find((q) => q.id === questionId);
          if (updated) {
            setSelectedRevisionQuestion(updated);
          }
          setStudentSuccessToast("Versi revisi butir soal berhasil dipulihkan!");
          setTimeout(() => setStudentSuccessToast(null), 5000);
        }}
      />

      {/* Word Document Question Upload & Template Modal */}
      {showWordUploadModal && (
        <WordQuestionUploadModal
          onClose={() => setShowWordUploadModal(false)}
          onImportQuestions={handleImportFromWord}
        />
      )}

      {/* QR Code HD Zoom & Projection Modal */}
      {selectedZoomStudent && (
        <QrCodeZoomModal
          student={selectedZoomStudent.student}
          qrDataUrl={selectedZoomStudent.qrDataUrl}
          payload={selectedZoomStudent.payload}
          qrFormat={barcodeQrFormat}
          onClose={() => setSelectedZoomStudent(null)}
        />
      )}

      {/* Login Portal Barcode Modal for Google Lens / Smartphone Scanner */}
      <LoginPortalQrModal
        isOpen={showLoginPortalQrModal}
        onClose={() => setShowLoginPortalQrModal(false)}
      />

      {/* Tambah Siswa Per Kelas Modal */}
      <AddStudentsByClassModal
        isOpen={showAddByClassModal}
        onClose={() => {
          setShowAddByClassModal(false);
          setSelectedClassForNewStudents(undefined);
        }}
        existingStudents={students}
        customClasses={customClasses}
        initialSelectedClass={selectedClassForNewStudents}
        onSaveStudents={async (newStudents) => {
          await onBulkAddStudents(newStudents);
          const targetCls = newStudents[0]?.className || "Kelas";
          setStudentSuccessToast(
            `Berhasil mendaftarkan dan menyimpan ${newStudents.length} siswa baru ke kelas "${targetCls}"!`
          );
          setTimeout(() => setStudentSuccessToast(null), 6000);
        }}
      />

      {/* Tambah Kelas / Rombel Baru Modal */}
      <AddClassModal
        isOpen={showAddClassModal}
        onClose={() => setShowAddClassModal(false)}
        existingStudents={students}
        customClasses={customClasses}
        onAddClasses={handleAddClasses}
        onDeleteCustomClass={handleDeleteCustomClass}
        onDeleteClass={handleDeleteClass}
      />

      {/* Pengaturan Aktivasi Kelas Peserta Ujian Modal */}
      {showClassActivationModal && (
        <ClassExamActivationModal
          isOpen={showClassActivationModal}
          onClose={() => setShowClassActivationModal(false)}
          examConfig={config}
          availableClasses={availableClasses}
          students={students}
          onSaveConfig={(updates) => {
            onUpdateExamConfig(updates);
            setStudentClassFilter("ALL");
            setStudentSuccessToast("Pengaturan aktivasi kelas ujian berhasil disimpan & diterapkan!");
            setTimeout(() => setStudentSuccessToast(null), 5000);
          }}
        />
      )}

      {/* Google Drive Integration Modal */}
      {showGoogleDriveModal && (
        <GoogleDriveModal
          isOpen={showGoogleDriveModal}
          onClose={() => setShowGoogleDriveModal(false)}
          students={students}
          questions={questions}
          examConfig={config}
          staffUsers={[currentUser]}
          onRestoreFullDatabase={async (data) => {
            if (!onImportDatabase) return false;
            const content = typeof data === "string" ? data : JSON.stringify(data);
            const res = await onImportDatabase(content);
            if (res.success) {
              setStudentSuccessToast("Database berhasil dipulihkan dari Google Drive!");
              setTimeout(() => setStudentSuccessToast(null), 5000);
            }
            return res.success;
          }}
        />
      )}

      {/* Edit KKM Modal */}
      {showKkmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Ubah KKM (Kriteria Ketuntasan Minimal)
                </h3>
                <p className="text-xs text-slate-400">
                  Tentukan batas nilai minimal kelulusan untuk ujian ini
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nilai KKM (Skala 0 - 100)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingKkmValue}
                    onChange={(e) => setEditingKkmValue(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-3 text-2xl font-black font-mono text-amber-300 focus:outline-none transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    Poin
                  </span>
                </div>
              </div>

              {/* Preset buttons */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Pilihan Nilai KKM Standar Sekolah:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[55, 60, 65, 70, 75, 80, 85].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditingKkmValue(val)}
                      className={`py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer border ${
                        editingKkmValue === val
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Impact Preview */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
                <p className="text-[11px] font-bold text-slate-300">
                  Pratinjau Hasil dengan KKM {editingKkmValue}:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-2 text-center">
                    <span className="text-[10px] text-emerald-400 font-medium block">Siswa Lulus</span>
                    <span className="text-base font-black text-emerald-300 font-mono">
                      {students.filter((s) => s.examStatus !== "disqualified" && s.totalScore >= editingKkmValue).length} Siswa
                    </span>
                  </div>
                  <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-2 text-center">
                    <span className="text-[10px] text-amber-400 font-medium block">Belum Tuntas</span>
                    <span className="text-base font-black text-amber-300 font-mono">
                      {students.filter((s) => s.examStatus !== "disqualified" && s.totalScore < editingKkmValue).length} Siswa
                    </span>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKkmModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyKKM(editingKkmValue)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terapkan &amp; Simpan KKM</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal (safe in iframe without window.confirm blocking) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3.5">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  confirmDialog.variant === "warning"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {confirmDialog.message}
                </p>
                {confirmDialog.detail && (
                  <p className="text-[11px] text-slate-400 mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-850 font-mono">
                    {confirmDialog.detail}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() =>
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {confirmDialog.cancelLabel || "Batal"}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition shadow-lg cursor-pointer flex items-center space-x-1.5 ${
                  confirmDialog.variant === "warning"
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
                    : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDialog.confirmLabel || "Ya, Lanjutkan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Reset Login Modal (Select specific students or all) */}
      <ResetLoginModal
        isOpen={showResetLoginModal}
        onClose={() => setShowResetLoginModal(false)}
        students={students}
        config={config}
        initialSelectedIds={resetModalInitialIds}
        onResetStudentLogin={(studentId) => {
          onResetStudentLogin(studentId);
        }}
        onResetMultipleStudentsLogin={(studentIds) => {
          if (onResetMultipleStudentsLogin) {
            onResetMultipleStudentsLogin(studentIds);
          } else {
            studentIds.forEach((id) => onResetStudentLogin(id));
          }
        }}
        onResetAllStudentsLogin={() => {
          onResetAllStudentsLogin();
        }}
        onSuccessToast={(msg) => {
          setStudentSuccessToast(msg);
          setTimeout(() => setStudentSuccessToast(null), 5000);
        }}
      />

      {/* AI Rubric Tuning Modal */}
      {showRubricTuningModal && (
        <AIRubricTuningModal
          config={config?.aiRubricConfig}
          onClose={() => setShowRubricTuningModal(false)}
          onSave={(newRubric) => {
            onUpdateExamConfig?.({ aiRubricConfig: newRubric });
            setShowRubricTuningModal(false);
          }}
        />
      )}

      {/* Bulk Edit Students & Classes Modal */}
      {showBulkEditModal && (
        <BulkEditStudentsModal
          isOpen={showBulkEditModal}
          onClose={() => setShowBulkEditModal(false)}
          students={students}
          selectedStudentIds={selectedStudentIds}
          currentFilteredClass={studentClassFilter}
          availableClasses={availableClasses}
          onSave={async ({ updates, newStudents, deletedStudentIds }) => {
            // 1. Process Updates
            if (updates.length > 0) {
              if (onBulkUpdateStudents) {
                await onBulkUpdateStudents(updates);
              } else {
                updates.forEach((u) => {
                  const { id, ...data } = u;
                  onEditStudent(id, data);
                });
              }
            }

            // 2. Process Deletions
            if (deletedStudentIds.length > 0) {
              if (onBulkDeleteStudents) {
                await onBulkDeleteStudents(deletedStudentIds);
              } else {
                deletedStudentIds.forEach((id) => onDeleteStudent(id));
              }
            }

            // 3. Process New Student Additions
            if (newStudents.length > 0) {
              const studentsWithIds: Student[] = newStudents.map((ns, idx) => ({
                id: ns.id || `st_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
                name: ns.name,
                className: ns.className,
                nisn: ns.nisn || "",
                username: ns.username || ns.nisn || `user_${Date.now()}_${idx}`,
                password: ns.password || "123456",
                role: "siswa" as const,
                loginCount: 0,
                isLocked: false,
                examStatus: "not_started" as const,
                startBarcodeToken: ns.startBarcodeToken || generateUniqueStudentToken(ns.className, ns.nisn || "", `st_${Date.now()}_${idx}`),
                mcqScore: 0,
                essayScore: 0,
                totalScore: 0,
                violationsCount: 0,
                violationsLog: [],
                answers: {},
              }));

              if (onBulkAddStudents) {
                await onBulkAddStudents(studentsWithIds);
              } else {
                studentsWithIds.forEach((st) => onAddStudent(st));
              }
            }

            // 4. Auto-register any newly created classes
            const existingClassSet = new Set(
              availableClasses.map((c) => (c || "").trim().toLowerCase()).filter(Boolean)
            );
            const newlyCreatedClasses: string[] = [];
            const checkAndAddClass = (cls?: string) => {
              if (!cls) return;
              const trimmed = cls.trim();
              const lower = trimmed.toLowerCase();
              if (!existingClassSet.has(lower) && !newlyCreatedClasses.includes(trimmed)) {
                newlyCreatedClasses.push(trimmed);
                existingClassSet.add(lower);
              }
            };

            updates.forEach((u) => checkAndAddClass(u.className));
            newStudents.forEach((ns) => checkAndAddClass(ns.className));

            if (newlyCreatedClasses.length > 0) {
              handleAddClasses(newlyCreatedClasses);
            }

            const messages: string[] = [];
            if (updates.length > 0) messages.push(`${updates.length} diperbarui`);
            if (newStudents.length > 0) messages.push(`${newStudents.length} ditambahkan`);
            if (deletedStudentIds.length > 0) messages.push(`${deletedStudentIds.length} dihapus`);

            setStudentSuccessToast(
              `Berhasil memproses perubahan massal siswa: ${messages.join(", ")}.`
            );
            setTimeout(() => setStudentSuccessToast(null), 5000);
            setSelectedStudentIds([]);
          }}
        />
      )}
    </div>
  );
};
