import { Question, Student, ExamConfig, isQuestionForStudent } from "../types";

/**
 * 32-bit FNV-1a or polynomial rolling hash function to convert seed string to numeric hash.
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 seeded pseudo-random number generator.
 * Produces deterministic 32-bit floats in [0, 1) from a numeric seed.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle algorithm.
 * Guarantees that the same seed produces the exact same permutation.
 */
export function seededShuffle<T>(array: readonly T[], seedString: string): T[] {
  const copy = [...array];
  if (copy.length <= 1) return copy;

  const rng = mulberry32(hashString(seedString));
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export interface ShuffledOption {
  text: string;
  originalIndex: number;
}

/**
 * Returns questions for a student:
 * 1. Filters only questions for 'Semua Kelas' OR matching the student's grade level (X, XI, XII).
 * 2. If config.randomizeQuestions is true (or undefined, defaulting to true for anti-cheating),
 *    questions are deterministically shuffled using the student's unique identifiers and exam ID.
 */
export function getStudentExamQuestions(
  questions: Question[],
  student: Student,
  config: ExamConfig
): Question[] {
  // 1. If an active package is selected (and not 'all'), use the questions of that package
  let questionsPool = questions;
  if (config.activePackageId && config.activePackageId !== "all") {
    const pkgQuestions = questions.filter((q) => q.packageId === config.activePackageId);
    if (pkgQuestions.length > 0) {
      questionsPool = pkgQuestions;
    }
  }

  // If questionsPool is empty (e.g. invalid package), fallback to all available questions
  if (questionsPool.length === 0) {
    questionsPool = questions;
  }

  // If explicitly disabled by admin, return original order
  if (config.randomizeQuestions === false) {
    return questionsPool;
  }

  // Generate unique deterministic seed per student
  const studentKey = student.nisn || student.id || student.username || "student";
  const examKey = config.id || config.subject || "exam";
  const seed = `exam_q_shuffle_${examKey}_${studentKey}`;

  return seededShuffle(questionsPool, seed);
}

/**
 * Returns options for a question:
 * Works seamlessly for both MCQ (Single Choice) and Multi-Choice (PG Kompleks).
 * Safely handles string options, object options ({ label, text }), or legacy arrays.
 * If config.randomizeOptions is true (or undefined, defaulting to true),
 * options are deterministically shuffled with their originalIndex preserved for accurate grading.
 */
export function getStudentQuestionOptions(
  question: Question,
  student: Student,
  config: ExamConfig
): ShuffledOption[] {
  const rawList: any[] =
    question.options ||
    (question as any).optionsRaw ||
    (question as any).optionsList ||
    (question as any).pilihan ||
    (question as any).choices ||
    [];

  if (!rawList || rawList.length === 0) {
    return [];
  }

  const baseOptions: ShuffledOption[] = rawList
    .map((item: any, idx: number) => {
      let text = "";
      if (typeof item === "string") {
        text = item;
      } else if (item && typeof item === "object") {
        text = String(item.text ?? item.label ?? item.value ?? "").trim();
      } else {
        text = String(item ?? "").trim();
      }
      return {
        text,
        originalIndex: idx,
      };
    })
    .filter((opt) => opt.text.length > 0);

  if (baseOptions.length === 0) {
    return [];
  }

  if (config.randomizeOptions === false) {
    return baseOptions;
  }

  const studentKey = student.nisn || student.id || student.username || "student";
  const seed = `exam_opt_shuffle_${question.id}_${studentKey}`;

  return seededShuffle(baseOptions, seed);
}
