export type Role = "admin" | "guru" | "siswa";

export type ExamStatus = "not_started" | "in_progress" | "submitted" | "disqualified";

export interface Student {
  id: string;
  nisn: string;
  username: string;
  password?: string;
  name: string;
  className: string;
  role: Role;
  loginCount: number;
  isLocked: boolean; // Locked after 1st login until reset by admin
  examStatus: ExamStatus;
  startBarcodeToken: string;
  mcqScore: number;
  essayScore: number;
  totalScore: number;
  violationsCount: number;
  violationsLog: ViolationRecord[];
  startedAt?: string;
  submittedAt?: string;
  avatarColor?: string;
  answers: Record<string, any>; // string | number | boolean | number[] | Record<string, string>
  isSample?: boolean;
  essayEvaluations?: Record<string, {
    score: number;
    feedback: string;
    keyConceptsFound?: string[];
    maxScore?: number;
  }>;
}

export function isSampleStudent(s: Student): boolean {
  // If explicitly designated as real student (isSample === false), definitely NOT a sample
  if (s.isSample === false) return false;
  // If explicitly flagged as sample
  if (s.isSample === true) return true;
  if (!s.id) return false;
  // Only simulation-generated test accounts
  if (s.id.startsWith("std-sim-") || s.id.startsWith("sim-")) return true;
  return false;
}

export interface TeacherOrAdmin {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: "admin" | "guru";
  email: string;
}

export type QuestionType =
  | "mcq"           // Pilihan Ganda (Single Choice: A, B, C, D, E)
  | "true_false"    // Benar / Salah (True / False)
  | "matching"      // Menjodohkan / Memasangkan Pernyataan
  | "multi_choice"  // Pilihan Ganda Kompleks (Centang beberapa yang benar)
  | "short_answer"  // Isian Singkat
  | "essay";        // Uraian / Essay

export interface MatchingPair {
  id?: string;
  left: string;   // Pernyataan / Konsep di kolom kiri
  right: string;  // Pasangan jawaban benar di kolom kanan
}

export interface QuestionRevision {
  id: string;
  timestamp: string;
  modifiedBy: string;
  role?: "admin" | "guru";
  changeType:
    | "CREATE"
    | "UPDATE_TEXT"
    | "UPDATE_KEY"
    | "UPDATE_RUBRIC"
    | "UPDATE_POINTS"
    | "UPDATE_MEDIA"
    | "UPDATE_OPTIONS"
    | "GENERAL_UPDATE";
  summary: string;
  previousState?: {
    question?: string;
    type?: QuestionType;
    correctAnswer?: number;
    correctAnswers?: number[];
    correctBool?: boolean;
    keyAnswer?: string;
    points?: number;
    options?: string[];
  };
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // for mcq & multi_choice
  correctAnswer?: number; // index 0-4 for single mcq
  correctAnswers?: number[]; // indices for multi_choice (e.g. [0, 2])
  correctBool?: boolean; // for true/false (true = Benar, false = Salah)
  matchingPairs?: MatchingPair[]; // for matching questions
  keyAnswer?: string; // model answer or key concepts for essay & short_answer
  points: number;
  subject?: string;
  explanation?: string; // Pembahasan soal (opsional)

  // Media support (Gambar, Audio Listening, Video Singkat)
  mediaType?: "none" | "image" | "audio" | "video";
  mediaUrl?: string; // Direct link or Base64 data URL
  mediaCaption?: string; // Keterangan gambar/audio/video
  audioPlayLimit?: number; // Batas berapa kali audio boleh diputar (e.g. 1x / 2x, 0 = tanpa batas)

  // Riwayat Revisi & Pemantau Perubahan
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  revisionHistory?: QuestionRevision[];
}

export interface ViolationRecord {
  id: string;
  timestamp: string;
  type: "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "COPY_PASTE" | "SPLIT_SCREEN" | "SCREENSHOT" | "AI_PROCTOR_SUSPECT" | "NOTIFICATION_PANEL";
  title: string;
  description: string;
  snapshot?: string; // base64 camera image if available
}

export type AIRubricStrictnessMode = "strict_keyword" | "balanced" | "flexible_semantic";
export type AIRubricTypoTolerance = "low" | "medium" | "high";

export interface AIRubricConfig {
  strictnessMode: AIRubricStrictnessMode; // "strict_keyword" | "balanced" | "flexible_semantic"
  typoTolerance: AIRubricTypoTolerance;   // "low" | "medium" | "high"
  reasoningWeight: number;                // 0 - 100 (%) bobot penalaran vs fakta
  penalizeLengthDeviation: boolean;       // Berikan penalti jika jawaban terlalu singkat
  customDirectives?: string;              // Petunjuk tambahan spesifik dari guru/admin
  temperature?: number;                   // 0.1 - 0.5
  minKeywordCoveragePercent?: number;
}

export interface ExamConfig {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  durationMinutes: number;
  gateToken: string; // token needed to start
  maxAllowedViolations: number; // 2 violations = auto submit
  passingScore: number;
  instructions: string[];
  institutionName?: string;
  academicYear?: string;
  helpdeskPhone?: string; // e.g. "085240195357"
  helpdeskName?: string;
  enableSoundAlerts?: boolean;
  blockCopyPaste?: boolean;
  detectSplitScreen?: boolean;
  detectScreenshot?: boolean;
  enableWebcamProctoring?: boolean;
  randomizeQuestions?: boolean; // Acak urutan nomor soal per peserta (anti-nyontek)
  randomizeOptions?: boolean; // Acak urutan opsi jawaban A, B, C, D per peserta
  activeClasses?: string[]; // Daftar kelas yang diizinkan/diaktifkan untuk ujian
  allClassesActive?: boolean; // Jika true, semua kelas aktif; jika false, hanya activeClasses
  aiRubricConfig?: AIRubricConfig; // Parameter kelonggaran dan mode evaluasi AI untuk essay
}

export interface DistractorAnalysis {
  optionIndex: number;
  optionLabel: string; // "A", "B", "C", "D", "E"
  optionText: string;
  count: number;
  percentage: number;
  isCorrect: boolean;
  upperCount: number;
  lowerCount: number;
  isFunctional: boolean; // Efektif jika dipilih >= 5% dan lebih banyak dipilih kelompok bawah
}

export interface QuestionItemAnalysis {
  questionId: string;
  questionNumber: number;
  type: QuestionType;
  questionText: string;
  points: number;
  subject?: string;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  averageScore: number;

  // Indeks Kesukaran (Facility Value / Difficulty Index, P)
  difficultyIndex: number; // 0.00 - 1.00
  difficultyLabel: "Mudah" | "Sedang" | "Sukar" | "Belum Ada Data";
  difficultyBadgeColor: "emerald" | "amber" | "rose" | "slate";

  // Daya Pembeda (Discrimination Index, D)
  discriminationIndex: number; // -1.00 - 1.00
  discriminationLabel: "Sangat Baik" | "Baik" | "Cukup" | "Jelek" | "Negatif (Defektif)" | "Belum Ada Data";
  discriminationBadgeColor: "emerald" | "blue" | "amber" | "rose" | "purple" | "slate";
  upperGroupPassRate: number; // Proporsi lulus / rata-rata kelompok atas
  lowerGroupPassRate: number; // Proporsi lulus / rata-rata kelompok bawah

  // Analisis Pengecoh (Distractor Analysis khusus MCQ)
  distractors?: DistractorAnalysis[];

  // Rekomendasi Pedagogis / BSNP
  recommendation:
    | "Diterima (Sangat Baik)"
    | "Diterima dengan Revisi Kecil"
    | "Revisi Kunci Jawaban / Distraktor"
    | "Dibuang / Diganti Baru"
    | "Menunggu Data Jawaban";
  recommendationReason: string;
}

export function isExamClassActive(config?: ExamConfig, className?: string): boolean {
  if (!config) return true;
  if (!className) return true;
  if (config.allClassesActive === false) {
    if (!config.activeClasses || config.activeClasses.length === 0) {
      return false;
    }
    const target = (className || "").trim().replace(/\s+/g, " ").toLowerCase();
    return config.activeClasses.some(
      (ac) => (ac || "").trim().replace(/\s+/g, " ").toLowerCase() === target
    );
  }
  return true;
}

export interface BackupFileInfo {
  filename: string;
  timestamp: string;
  sizeBytes: number;
  studentsCount: number;
  questionsCount: number;
  label?: string;
}

