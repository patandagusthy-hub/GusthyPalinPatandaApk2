import fs from "fs";
import path from "path";
import { Student, TeacherOrAdmin, Question, ExamConfig } from "../src/types";
import {
  INITIAL_ADMINS,
  INITIAL_STUDENTS,
  INITIAL_QUESTIONS,
  INITIAL_EXAM_CONFIG,
} from "../src/data/initialData";

export interface PersistentDatabase {
  version: number;
  lastUpdated: string;
  hasAdminCustomData: boolean;
  students: Student[];
  questions: Question[];
  examConfig: ExamConfig;
  staffUsers: TeacherOrAdmin[];
}

export interface BackupFileInfo {
  filename: string;
  timestamp: string;
  sizeBytes: number;
  studentsCount: number;
  questionsCount: number;
  label?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const DB_FILE = path.join(DATA_DIR, "cbt_database.json");
const CURRENT_SCHEMA_VERSION = 3;

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Migrate and fill in defaults for schema extensions.
 * Guarantees that any new features/fields added to the app will NEVER
 * overwrite or drop admin-created questions, students, or configs.
 */
function migrateSchema(data: any): PersistentDatabase {
  const students: Student[] = Array.isArray(data.students)
    ? data.students.map((s: any, idx: number) => ({
        id: s.id || `std-migrated-${idx + 1}`,
        nisn: s.nisn || `000000000${idx + 1}`,
        username: s.username || `siswa_${idx + 1}`,
        password: s.password || "siswa123",
        name: s.name || `Siswa ${idx + 1}`,
        className: s.className || "XII",
        role: "siswa" as const,
        loginCount: typeof s.loginCount === "number" ? s.loginCount : 0,
        isLocked: Boolean(s.isLocked),
        examStatus: s.examStatus || "not_started",
        startBarcodeToken: s.startBarcodeToken || `TOKEN-STD-${idx + 1}`,
        mcqScore: typeof s.mcqScore === "number" ? s.mcqScore : 0,
        essayScore: typeof s.essayScore === "number" ? s.essayScore : 0,
        totalScore: typeof s.totalScore === "number" ? s.totalScore : 0,
        violationsCount: typeof s.violationsCount === "number" ? s.violationsCount : 0,
        violationsLog: Array.isArray(s.violationsLog) ? s.violationsLog : [],
        avatarColor: s.avatarColor || "#3b82f6",
        answers: s.answers || {},
        essayEvaluations: s.essayEvaluations || {},
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
        ...s, // Preserve all custom admin attributes!
      }))
    : INITIAL_STUDENTS;

  const questions: Question[] = Array.isArray(data.questions)
    ? data.questions.map((q: any, idx: number) => ({
        id: q.id || `q-migrated-${idx + 1}`,
        type: q.type === "essay" ? "essay" : "mcq",
        question: q.question || "Pertanyaan belum diisi",
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
        keyAnswer: q.keyAnswer || "",
        points: typeof q.points === "number" ? q.points : 10,
        subject: q.subject || "Umum",
        rubric: q.rubric,
        ...q, // Preserve all custom admin question attributes!
      }))
    : INITIAL_QUESTIONS;

  const examConfig: ExamConfig = {
    ...INITIAL_EXAM_CONFIG,
    ...(data.examConfig || {}),
    helpdeskPhone: data.examConfig?.helpdeskPhone || INITIAL_EXAM_CONFIG.helpdeskPhone || "085240195357",
    helpdeskName: data.examConfig?.helpdeskName || INITIAL_EXAM_CONFIG.helpdeskName || "Admin CBT (Gusthy Palin Patanda)",
  };

  const staffUsers: TeacherOrAdmin[] = Array.isArray(data.staffUsers) && data.staffUsers.length > 0
    ? data.staffUsers
    : INITIAL_ADMINS;

  return {
    version: CURRENT_SCHEMA_VERSION,
    lastUpdated: data.lastUpdated || new Date().toISOString(),
    hasAdminCustomData: Boolean(data.hasAdminCustomData),
    students,
    questions,
    examConfig,
    staffUsers,
  };
}

class ServerDatabase {
  private cache: PersistentDatabase | null = null;

  constructor() {
    ensureDirs();
    this.loadInitial();
  }

  private loadInitial(): PersistentDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        this.cache = migrateSchema(parsed);
        return this.cache;
      }
    } catch (err) {
      console.error("[ServerDB] Error loading DB_FILE, attempting backup recovery:", err);
      // Attempt recovery from newest backup
      const backup = this.getLatestBackup();
      if (backup) {
        this.cache = backup;
        this.saveDirect(backup, false);
        return backup;
      }
    }

    // Seed default DB
    const initialDb: PersistentDatabase = {
      version: CURRENT_SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
      hasAdminCustomData: false,
      students: INITIAL_STUDENTS,
      questions: INITIAL_QUESTIONS,
      examConfig: INITIAL_EXAM_CONFIG,
      staffUsers: INITIAL_ADMINS,
    };
    this.cache = initialDb;
    this.saveDirect(initialDb, true);
    return initialDb;
  }

  public getDatabase(): PersistentDatabase {
    if (!this.cache) {
      return this.loadInitial();
    }
    return this.cache;
  }

  /**
   * Save database with anti-loss protection:
   * - Atomic tmp-write + rename
   * - Automatic snapshot backup creation
   * - Never allows saving an empty questions/students array if data previously existed
   */
  public saveDatabase(
    incoming: Partial<PersistentDatabase>,
    label: string = "auto_update"
  ): { success: boolean; message?: string; db: PersistentDatabase } {
    ensureDirs();
    const current = this.getDatabase();

    // Anti-loss guard: Do not allow accidental wiping of all questions if questions previously existed
    let newQuestions = incoming.questions ?? current.questions;
    if (current.questions.length > 0 && Array.isArray(incoming.questions) && incoming.questions.length === 0) {
      console.warn("[ServerDB] Rejected empty questions update to protect admin data!");
      newQuestions = current.questions;
    }

    // Anti-loss guard: Do not allow accidental wiping of all students unless explicitly requested (e.g. deleting sample students)
    let newStudents = incoming.students ?? current.students;
    const isExplicitStudentDelete =
      label.includes("delete") ||
      label.includes("sample") ||
      label.includes("restore") ||
      label.includes("import");

    if (
      !isExplicitStudentDelete &&
      current.students.length > 0 &&
      Array.isArray(incoming.students) &&
      incoming.students.length === 0 &&
      !incoming.hasAdminCustomData
    ) {
      console.warn("[ServerDB] Rejected empty students update to protect admin data!");
      newStudents = current.students;
    } else if (Array.isArray(incoming.students)) {
      newStudents = incoming.students;
    }

    const updated: PersistentDatabase = {
      version: CURRENT_SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
      hasAdminCustomData: true, // Marked as customized by admin
      students: newStudents,
      questions: newQuestions,
      examConfig: incoming.examConfig
        ? { ...current.examConfig, ...incoming.examConfig }
        : current.examConfig,
      staffUsers: incoming.staffUsers ?? current.staffUsers,
    };

    const saved = this.saveDirect(updated, true, label);
    if (saved) {
      this.cache = updated;
      return { success: true, db: updated };
    } else {
      return { success: false, message: "Gagal menyimpan ke penyimpanan server", db: current };
    }
  }

  private saveDirect(db: PersistentDatabase, createBackup: boolean = true, label: string = "snapshot"): boolean {
    try {
      ensureDirs();
      const content = JSON.stringify(db, null, 2);
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, content, "utf-8");
      fs.renameSync(tmpFile, DB_FILE);

      if (createBackup) {
        this.createBackupSnapshot(db, label);
      }
      return true;
    } catch (err) {
      console.error("[ServerDB] Failed to save DB file:", err);
      return false;
    }
  }

  private createBackupSnapshot(db: PersistentDatabase, label: string): void {
    try {
      ensureDirs();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
      const backupName = `backup_${timestamp}_${safeLabel}.json`;
      const backupPath = path.join(BACKUPS_DIR, backupName);
      fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), "utf-8");

      // Prune old backups, keep last 25
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith("backup_") && f.endsWith(".json"));
      if (files.length > 25) {
        files.sort().reverse();
        for (let i = 25; i < files.length; i++) {
          try {
            fs.unlinkSync(path.join(BACKUPS_DIR, files[i]));
          } catch {}
        }
      }
    } catch (err) {
      console.warn("[ServerDB] Backup creation non-fatal error:", err);
    }
  }

  private getLatestBackup(): PersistentDatabase | null {
    try {
      ensureDirs();
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith("backup_") && f.endsWith(".json"));
      if (files.length === 0) return null;
      files.sort().reverse();
      const latest = path.join(BACKUPS_DIR, files[0]);
      const raw = fs.readFileSync(latest, "utf-8");
      return migrateSchema(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  public listBackups(): BackupFileInfo[] {
    try {
      ensureDirs();
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith("backup_") && f.endsWith(".json"));
      files.sort().reverse();

      return files.map((filename) => {
        const fullPath = path.join(BACKUPS_DIR, filename);
        const stats = fs.statSync(fullPath);
        let studentsCount = 0;
        let questionsCount = 0;
        try {
          const raw = fs.readFileSync(fullPath, "utf-8");
          const parsed = JSON.parse(raw);
          studentsCount = Array.isArray(parsed.students) ? parsed.students.length : 0;
          questionsCount = Array.isArray(parsed.questions) ? parsed.questions.length : 0;
        } catch {}

        return {
          filename,
          timestamp: stats.mtime.toISOString(),
          sizeBytes: stats.size,
          studentsCount,
          questionsCount,
        };
      });
    } catch (err) {
      console.error("[ServerDB] Error listing backups:", err);
      return [];
    }
  }

  public restoreBackup(filename: string): { success: boolean; message: string; db?: PersistentDatabase } {
    try {
      ensureDirs();
      const safeName = path.basename(filename);
      const fullPath = path.join(BACKUPS_DIR, safeName);
      if (!fs.existsSync(fullPath)) {
        return { success: false, message: "Berkas cadangan tidak ditemukan" };
      }

      // Create pre-restore safety backup
      if (this.cache) {
        this.createBackupSnapshot(this.cache, "pre_restore_safety");
      }

      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(raw);
      const restored = migrateSchema(parsed);
      this.cache = restored;
      this.saveDirect(restored, false);

      return {
        success: true,
        message: `Berhasil memulihkan ${restored.questions.length} soal dan ${restored.students.length} siswa dari cadangan!`,
        db: restored,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal memulihkan cadangan: ${err.message}` };
    }
  }

  public importDatabase(jsonString: string): { success: boolean; message: string; db?: PersistentDatabase } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || (!parsed.students && !parsed.questions)) {
        return { success: false, message: "Format berkas JSON tidak valid untuk database CBT" };
      }

      // Pre-import safety snapshot
      if (this.cache) {
        this.createBackupSnapshot(this.cache, "pre_import_safety");
      }

      const imported = migrateSchema({
        ...parsed,
        hasAdminCustomData: true,
      });

      this.cache = imported;
      this.saveDirect(imported, true, "manual_import");
      return {
        success: true,
        message: `Berhasil mengimpor ${imported.questions.length} soal dan ${imported.students.length} data siswa!`,
        db: imported,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal mengimpor database: ${err.message}` };
    }
  }

  public recordStudentViolation(
    studentId: string,
    violation: {
      id?: string;
      timestamp?: string;
      type: string;
      title: string;
      description: string;
      snapshot?: string;
    }
  ) {
    const current = this.getDatabase();
    const student = current.students.find((s) => s.id === studentId);
    const newViolation = {
      id: violation.id || `viol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: violation.timestamp || new Date().toLocaleTimeString("id-ID"),
      type: violation.type as any,
      title: violation.title,
      description: violation.description,
      snapshot: violation.snapshot,
    };

    if (student) {
      const existingLog = Array.isArray(student.violationsLog) ? student.violationsLog : [];
      student.violationsLog = [newViolation, ...existingLog];
      student.violationsCount = student.violationsLog.length;
    }

    current.lastUpdated = new Date().toISOString();
    this.saveDirect(current, false, "record_violation");
    this.cache = current;
    return newViolation;
  }

  public clearAllViolations(): { success: boolean; message: string } {
    const current = this.getDatabase();
    current.students.forEach((s) => {
      s.violationsCount = 0;
      s.violationsLog = [];
    });
    current.lastUpdated = new Date().toISOString();
    this.saveDirect(current, true, "clear_violations");
    this.cache = current;
    return { success: true, message: "Seluruh catatan log pelanggaran keamanan telah dibersihkan." };
  }
}

export const serverDb = new ServerDatabase();
