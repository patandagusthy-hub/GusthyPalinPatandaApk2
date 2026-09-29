import { Student } from "../types";
import { canonicalizeClassName, isSameClass } from "./classUtils";
import { generateUniqueStudentToken } from "./barcodeUtils";

export interface ParsedMasterStudent {
  rawLine?: string;
  name: string;
  className: string;
  isDuplicateInBatch?: boolean;
  isDuplicateInDatabase?: boolean;
  duplicateReason?: string;
  matchedExistingStudent?: Student;
}

export interface ParseBatchResult {
  validStudents: ParsedMasterStudent[];
  duplicatesInBatch: ParsedMasterStudent[];
  duplicatesInDatabase: ParsedMasterStudent[];
  invalidLines: { line: string; error: string }[];
  totalParsed: number;
}

/**
 * Normalizes student name for strict duplication matching
 */
export function normalizeMasterName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Generates a clean, unique student username
 */
export function generateMasterUsername(
  name: string,
  className: string,
  existingUsernames: Set<string>
): string {
  const cleanCls = className.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  // Split name parts
  const words = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  let base = "";
  if (words.length >= 2) {
    base = `${words[0].slice(0, 6)}_${words[1].slice(0, 4)}`;
  } else if (words.length === 1) {
    base = words[0].slice(0, 8);
  } else {
    base = "siswa";
  }

  let username = `${base}.${cleanCls}`.toLowerCase();
  let counter = 1;
  while (existingUsernames.has(username)) {
    username = `${base}${counter}.${cleanCls}`.toLowerCase();
    counter++;
  }
  existingUsernames.add(username);
  return username;
}

/**
 * Generates a clean 10-digit sequential or randomized NISN
 */
export function generateMasterNisn(existingNisns: Set<string>): string {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  let nisn = "";
  let attempts = 0;
  do {
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();
    nisn = `${currentYear}${randomSuffix}`;
    attempts++;
  } while (existingNisns.has(nisn) && attempts < 100);
  existingNisns.add(nisn);
  return nisn;
}

/**
 * Parses raw pasted lines or text into structured master students (ONLY Name and Class)
 * Supports:
 * 1. Default class mode: list of names (one per line) with a selected fallback class
 * 2. Comma or Tab separated: "Budi Santoso, X A" or "Budi Santoso\tX A"
 * 3. Semicolon separated: "Budi Santoso; X A"
 */
export function parseMasterStudentsInput(
  rawText: string,
  defaultClass: string,
  existingStudents: Student[]
): ParseBatchResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const validStudents: ParsedMasterStudent[] = [];
  const duplicatesInBatch: ParsedMasterStudent[] = [];
  const duplicatesInDatabase: ParsedMasterStudent[] = [];
  const invalidLines: { line: string; error: string }[] = [];

  // Track unique keys in this batch: key = `${normName}|${normClass}`
  const batchKeys = new Set<string>();

  // Prepare database lookup map
  const dbStudentMap = new Map<string, Student>();
  existingStudents.forEach((st) => {
    const normName = normalizeMasterName(st.name);
    const canClass = canonicalizeClassName(st.className);
    const key = `${normName}|${canClass.toLowerCase()}`;
    dbStudentMap.set(key, st);
  });

  lines.forEach((line) => {
    let name = "";
    let cls = "";

    // Check delimiters: Tab, Comma, Semicolon, Pipe
    if (line.includes("\t")) {
      const parts = line.split("\t").map((p) => p.trim());
      name = parts[0] || "";
      cls = parts[1] || defaultClass;
    } else if (line.includes(",")) {
      const parts = line.split(",").map((p) => p.trim());
      name = parts[0] || "";
      cls = parts[1] || defaultClass;
    } else if (line.includes(";")) {
      const parts = line.split(";").map((p) => p.trim());
      name = parts[0] || "";
      cls = parts[1] || defaultClass;
    } else if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      name = parts[0] || "";
      cls = parts[1] || defaultClass;
    } else {
      // Single column: whole line is student name, class is defaultClass
      name = line;
      cls = defaultClass;
    }

    // Clean name: remove leading numbers like "1.", "1)", "- "
    name = name.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim();

    if (!name || name.length < 2) {
      invalidLines.push({ line, error: "Nama siswa terlalu pendek atau kosong." });
      return;
    }

    const canonicalClass = canonicalizeClassName(cls) || canonicalizeClassName(defaultClass) || "X A";
    const normName = normalizeMasterName(name);
    const batchKey = `${normName}|${canonicalClass.toLowerCase()}`;

    // 1. Check duplicate in current batch
    if (batchKeys.has(batchKey)) {
      duplicatesInBatch.push({
        rawLine: line,
        name,
        className: canonicalClass,
        isDuplicateInBatch: true,
        duplicateReason: `Duplikat di baris input: Siswa dengan nama "${name}" di kelas "${canonicalClass}" muncul lebih dari 1 kali dalam daftar yang ditempel.`,
      });
      return;
    }
    batchKeys.add(batchKey);

    // 2. Check duplicate in existing database
    const matchedDb = dbStudentMap.get(batchKey);
    if (matchedDb) {
      duplicatesInDatabase.push({
        rawLine: line,
        name,
        className: canonicalClass,
        isDuplicateInDatabase: true,
        duplicateReason: `Sudah terdaftar di Database: Siswa "${matchedDb.name}" di kelas "${matchedDb.className}" (NISN: ${matchedDb.nisn || "-"}, ID: ${matchedDb.id}) sudah ada.`,
        matchedExistingStudent: matchedDb,
      });
      return;
    }

    // Valid unique student
    validStudents.push({
      rawLine: line,
      name,
      className: canonicalClass,
    });
  });

  return {
    validStudents,
    duplicatesInBatch,
    duplicatesInDatabase,
    invalidLines,
    totalParsed: lines.length,
  };
}

/**
 * Converts validated master students (ONLY Name and Class) into full Student records
 */
export function buildStudentsFromMasterInput(
  items: ParsedMasterStudent[],
  existingStudents: Student[]
): Student[] {
  const existingUsernames = new Set(
    existingStudents.map((s) => (s.username || "").trim().toLowerCase()).filter(Boolean)
  );
  const existingNisns = new Set(
    existingStudents.map((s) => (s.nisn || "").trim()).filter(Boolean)
  );
  const existingTokens = new Set(
    existingStudents.map((s) => (s.startBarcodeToken || "").trim().toLowerCase()).filter(Boolean)
  );

  return items.map((item, idx) => {
    const canonicalClass = canonicalizeClassName(item.className);
    const newId = `std-master-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    const nisn = generateMasterNisn(existingNisns);
    const username = generateMasterUsername(item.name, canonicalClass, existingUsernames);
    const token = generateUniqueStudentToken(canonicalClass, nisn, newId, existingTokens);

    const student: Student = {
      id: newId,
      name: item.name.trim(),
      className: canonicalClass,
      role: "siswa",
      nisn,
      username,
      password: "siswa123",
      loginCount: 0,
      isLocked: false,
      examStatus: "not_started",
      mcqScore: 0,
      essayScore: 0,
      totalScore: 0,
      violationsCount: 0,
      violationsLog: [],
      answers: {},
      startBarcodeToken: token,
      isSample: false,
    };

    return student;
  });
}
