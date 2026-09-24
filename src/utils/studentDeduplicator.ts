import { Student } from "../types";

/**
 * Checks if a NISN is empty or a dummy placeholder.
 */
export function isPlaceholderNisn(nisn?: string): boolean {
  if (!nisn) return true;
  const cleaned = String(nisn).trim().toLowerCase();
  if (
    cleaned === "" ||
    cleaned === "-" ||
    cleaned === "--" ||
    cleaned === "0" ||
    cleaned === "none" ||
    cleaned === "null" ||
    cleaned === "n/a" ||
    cleaned === "na" ||
    /^0+$/.test(cleaned)
  ) {
    return true;
  }
  return false;
}

/**
 * Normalizes class name for comparison:
 * e.g. "Kelas X A", "X-A", "X.A", " X A " -> "x a"
 */
export function normalizeClassKey(cls?: string): string {
  if (!cls) return "";
  return cls
    .toLowerCase()
    .replace(/^(kelas|kls)\s+/i, "")
    .replace(/[-._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes student name for comparison:
 * e.g. "AHMAD FAUZY ", "Ahmad  Fauzy" -> "ahmad fauzy"
 */
export function normalizeNameKey(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/['`’.,_/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes NISN (removes non-digit chars if standard numeric, or trims)
 * Returns empty string if it's a dummy or placeholder NISN.
 */
export function normalizeNisn(nisn?: string): string {
  if (!nisn) return "";
  const cleaned = String(nisn).trim();
  if (isPlaceholderNisn(cleaned)) return "";
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 4) return digits;
  return cleaned.toLowerCase();
}

/**
 * Checks if a username is a generic sequence (e.g. peserta_01, siswa_1)
 * Generic usernames must NOT trigger cross-class deduplication.
 */
export function isGenericUsername(username?: string): boolean {
  if (!username) return true;
  const clean = username.trim().toLowerCase();
  const genericList = ["user", "siswa", "peserta", "student", "murid", "admin", "test"];
  if (genericList.includes(clean)) return true;
  if (/^(peserta|siswa|user|murid|student)[-_]?\d+$/.test(clean)) return true;
  return false;
}

/**
 * Evaluates whether student A has more exam progress than student B
 */
function scoreStudentProgress(s: Student): number {
  let score = 0;
  if (s.examStatus === "submitted") score += 100;
  if (s.examStatus === "in_progress") score += 50;
  if ((s.totalScore ?? 0) > 0) score += 30;
  if (s.answers && Object.keys(s.answers).length > 0) score += 20;
  if ((s.loginCount ?? 0) > 0) score += 10;
  // Canonical ID preference (e.g. std-xa-01 over std-import-...)
  if (s.id && !s.id.includes("import") && !s.id.includes("doc")) score += 5;
  return score;
}

export interface DeduplicateResult {
  unique: Student[];
  duplicates: Student[];
  duplicatesCount: number;
}

/**
 * Deduplicates an array of students safely.
 * Detects duplicates STRICTLY by:
 * 1. Exact document ID
 * 2. Matching valid non-placeholder NISN (at least 4 digits)
 * 3. Matching Class + Normalized Full Name
 * 4. Matching Class + Unique non-generic Username (strictly within the same class)
 * 
 * Will NEVER delete or overwrite a student from another class with a generic username or empty NISN!
 */
export function deduplicateStudents(students: Student[]): DeduplicateResult {
  if (!Array.isArray(students) || students.length === 0) {
    return { unique: [], duplicates: [], duplicatesCount: 0 };
  }

  const uniqueList: Student[] = [];
  const duplicatesList: Student[] = [];

  // Index maps pointing to index in uniqueList
  const idIndex = new Map<string, number>();
  const classNisnIndex = new Map<string, number>();
  const classNameIndex = new Map<string, number>();
  const classUsernameIndex = new Map<string, number>();

  for (const student of students) {
    if (!student || !student.name) continue;

    const sId = student.id ? student.id.trim() : "";
    const nisn = normalizeNisn(student.nisn);
    const rawUsername = (student.username || "").toLowerCase().trim();
    const classKey = normalizeClassKey(student.className);
    const nameKey = normalizeNameKey(student.name);
    const classAndNameKey = classKey && nameKey ? `${classKey}:::${nameKey}` : "";
    const classAndNisnKey = classKey && nisn ? `${classKey}:::${nisn}` : "";
    const classAndUsernameKey =
      classKey && rawUsername && !isGenericUsername(rawUsername)
        ? `${classKey}:::${rawUsername}`
        : "";

    // Check if duplicate exists (STRICT: only same doc ID or strictly same class!)
    let existingIdx: number | undefined = undefined;

    if (sId && idIndex.has(sId)) {
      existingIdx = idIndex.get(sId);
    } else if (classAndNameKey && classNameIndex.has(classAndNameKey)) {
      existingIdx = classNameIndex.get(classAndNameKey);
    } else if (classAndNisnKey && classNisnIndex.has(classAndNisnKey)) {
      existingIdx = classNisnIndex.get(classAndNisnKey);
    } else if (classAndUsernameKey && classUsernameIndex.has(classAndUsernameKey)) {
      existingIdx = classUsernameIndex.get(classAndUsernameKey);
    }

    if (existingIdx !== undefined && existingIdx >= 0 && existingIdx < uniqueList.length) {
      // Duplicate detected!
      const existing = uniqueList[existingIdx];
      const existingProgress = scoreStudentProgress(existing);
      const currentProgress = scoreStudentProgress(student);

      if (currentProgress > existingProgress) {
        // Current has more progress or better status
        const merged: Student = {
          ...student,
          answers:
            student.answers && Object.keys(student.answers).length > 0
              ? student.answers
              : existing.answers || {},
          startBarcodeToken: student.startBarcodeToken || existing.startBarcodeToken,
          avatarColor: student.avatarColor || existing.avatarColor,
        };
        uniqueList[existingIdx] = merged;
        duplicatesList.push(existing);
      } else {
        // Existing is preferred; merge missing fields from student into existing
        const merged: Student = {
          ...existing,
          answers:
            existing.answers && Object.keys(existing.answers).length > 0
              ? existing.answers
              : student.answers || {},
          startBarcodeToken: existing.startBarcodeToken || student.startBarcodeToken,
          avatarColor: existing.avatarColor || student.avatarColor,
        };
        uniqueList[existingIdx] = merged;
        duplicatesList.push(student);
      }
    } else {
      // New unique student
      const newIdx = uniqueList.length;
      uniqueList.push({ ...student });

      if (sId) idIndex.set(sId, newIdx);
      if (classAndNisnKey) classNisnIndex.set(classAndNisnKey, newIdx);
      if (classAndNameKey) classNameIndex.set(classAndNameKey, newIdx);
      if (classAndUsernameKey) classUsernameIndex.set(classAndUsernameKey, newIdx);
    }
  }

  return {
    unique: uniqueList,
    duplicates: duplicatesList,
    duplicatesCount: duplicatesList.length,
  };
}

/**
 * Merges newly imported or input students into the existing student collection safely.
 */
export function mergeImportedStudents(
  existingStudents: Student[],
  incomingStudents: Student[]
): {
  mergedStudents: Student[];
  newCount: number;
  updatedCount: number;
} {
  const { unique: cleanIncoming } = deduplicateStudents(incomingStudents);

  const result = [...existingStudents];
  let newCount = 0;
  let updatedCount = 0;

  cleanIncoming.forEach((incoming) => {
    const sId = incoming.id ? incoming.id.trim() : "";
    const nisn = normalizeNisn(incoming.nisn);
    const username = (incoming.username || "").toLowerCase().trim();
    const classKey = normalizeClassKey(incoming.className);
    const nameKey = normalizeNameKey(incoming.name);
    const classAndNameKey = classKey && nameKey ? `${classKey}:::${nameKey}` : "";

    const matchIdx = result.findIndex((existing) => {
      if (sId && existing.id === sId) return true;
      // Across different classes, different students MUST NEVER overwrite each other!
      if (classKey && normalizeClassKey(existing.className) === classKey) {
        if (nisn && normalizeNisn(existing.nisn) === nisn) return true;
        if (classAndNameKey) {
          const existKey = `${normalizeClassKey(existing.className)}:::${normalizeNameKey(existing.name)}`;
          if (existKey === classAndNameKey) return true;
        }
        if (
          username &&
          !isGenericUsername(username) &&
          (existing.username || "").toLowerCase().trim() === username
        ) {
          return true;
        }
      }
      return false;
    });

    if (matchIdx !== -1) {
      // Update existing record
      const existing = result[matchIdx];
      result[matchIdx] = {
        ...existing,
        name: incoming.name || existing.name,
        className: incoming.className || existing.className,
        nisn: incoming.nisn || existing.nisn,
        username: incoming.username || existing.username,
        password: incoming.password || existing.password,
        avatarColor: incoming.avatarColor || existing.avatarColor,
        startBarcodeToken: incoming.startBarcodeToken || existing.startBarcodeToken,
      };
      updatedCount++;
    } else {
      result.unshift(incoming);
      newCount++;
    }
  });

  return {
    mergedStudents: result,
    newCount,
    updatedCount,
  };
}
