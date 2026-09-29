/**
 * Centralized Class Utilities & Canonical Database Mappings
 * Ensures 100% consistent class naming, prevents duplicate classes,
 * and maintains exact alignment with the master database.
 */

// Official database class names (11 canonical classes)
export const DATABASE_CLASSES = [
  "X A",
  "X B",
  "X C",
  "X D",
  "X E",
  "X F",
  "X G",
  "XII PSP 2",
  "XII PSP 7",
  "XII RPL 1",
  "XII RPL 2",
] as const;

export type DatabaseClass = typeof DATABASE_CLASSES[number];

/**
 * Normalized key generator for comparison:
 * e.g. "Kelas X A", "X-A", "X.A", " X A " -> "x a"
 */
export function normalizeClassKey(cls?: string): string {
  if (!cls) return "";
  return String(cls)
    .toLowerCase()
    .replace(/^(kelas|kls)\s+/i, "")
    .replace(/[-._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pre-computed lookup map for lightning-fast canonical resolution
const CANONICAL_MAP = new Map<string, string>();

DATABASE_CLASSES.forEach((c) => {
  const key = normalizeClassKey(c);
  CANONICAL_MAP.set(key, c);
  // Also index without any spaces: "xa" -> "X A", "xiipsp2" -> "XII PSP 2"
  CANONICAL_MAP.set(key.replace(/\s+/g, ""), c);
  // Also index with zero padding or common variants: "xii psp 02" -> "XII PSP 2"
  const zeroPadded = key.replace(/\b(\d)\b/g, "0$1");
  CANONICAL_MAP.set(zeroPadded, c);
  CANONICAL_MAP.set(zeroPadded.replace(/\s+/g, ""), c);
});

/**
 * Canonicalizes any class name to the exact database standard.
 * If the class matches one of the 11 database classes (regardless of casing,
 * "Kelas " prefix, dashes, dots, or spacing), returns the official database name.
 * If it's a custom class, cleans and standardizes the formatting.
 */
export function canonicalizeClassName(raw?: string): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";

  const key = normalizeClassKey(trimmed);
  if (CANONICAL_MAP.has(key)) {
    return CANONICAL_MAP.get(key)!;
  }

  const noSpace = key.replace(/\s+/g, "");
  if (CANONICAL_MAP.has(noSpace)) {
    return CANONICAL_MAP.get(noSpace)!;
  }

  // Handle zero-padded variations like "XII PSP 07" -> "XII PSP 7"
  const unpaddedKey = key.replace(/\b0+(\d+)\b/g, "$1");
  if (CANONICAL_MAP.has(unpaddedKey)) {
    return CANONICAL_MAP.get(unpaddedKey)!;
  }
  if (CANONICAL_MAP.has(unpaddedKey.replace(/\s+/g, ""))) {
    return CANONICAL_MAP.get(unpaddedKey.replace(/\s+/g, ""))!;
  }

  // For custom classes, clean up formatting:
  // 1. Remove leading "Kelas" / "Kls"
  let clean = trimmed.replace(/^(kelas|kls)\s+/i, "").replace(/[-._]/g, " ").replace(/\s+/g, " ").trim();
  
  // 2. Standardize roman numeral grades (X, XI, XII) or number grades
  clean = clean.replace(/^(x|xi|xii|ix|viii|vii|\d+)\b/i, (m) => m.toUpperCase());
  
  // 3. Capitalize common vocational/track acronyms (RPL, TKJ, PSP, AKL, OTKP, BDP, TBSM, TKRO, etc.)
  clean = clean.replace(/\b(rpl|tkj|psp|akl|otkp|bdp|tbsm|tkro|mipa|ips|ipa|mm|dkv)\b/gi, (m) => m.toUpperCase());

  return clean;
}

/**
 * Checks if two class names refer to the same class (case and format insensitive).
 */
export function isSameClass(a?: string, b?: string): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const canA = canonicalizeClassName(a);
  const canB = canonicalizeClassName(b);
  if (canA && canB && canA === canB) return true;
  return normalizeClassKey(a) === normalizeClassKey(b);
}

/**
 * Calculates grade weight for natural educational sorting:
 * X (Grade 10) -> 10
 * XI (Grade 11) -> 11
 * XII (Grade 12) -> 12
 */
function getGradeWeight(cls: string): number {
  const upper = cls.toUpperCase().trim();
  if (/^(X\b|10\b|X\s)/i.test(upper)) return 10;
  if (/^(XI\b|11\b|XI\s)/i.test(upper)) return 11;
  if (/^(XII\b|12\b|XII\s)/i.test(upper)) return 12;
  return 99;
}

/**
 * Sorts class names in logical school order:
 * Grade 10 (X A ... X G), then Grade 11, then Grade 12 (XII PSP 2, XII PSP 7, XII RPL 1, XII RPL 2).
 */
export function sortClassNames(classes: string[]): string[] {
  return [...classes].sort((a, b) => {
    // If both are in DATABASE_CLASSES, respect exact canonical database order
    const idxA = (DATABASE_CLASSES as readonly string[]).indexOf(a);
    const idxB = (DATABASE_CLASSES as readonly string[]).indexOf(b);
    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    // Otherwise sort by Grade Level followed by natural alphanumeric
    const wA = getGradeWeight(a);
    const wB = getGradeWeight(b);
    if (wA !== wB) return wA - wB;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

/**
 * Deduplicates any array of class names:
 * - Canonicalizes every name to database standard
 * - Eliminates duplicates case-insensitively and whitespace-insensitively
 * - Sorts them in logical school order
 */
export function deduplicateClasses(
  classList: (string | undefined | null)[]
): string[] {
  if (!Array.isArray(classList) || classList.length === 0) {
    return [];
  }

  const seenKeys = new Map<string, string>();

  for (const raw of classList) {
    if (!raw) continue;
    const canonical = canonicalizeClassName(raw);
    if (!canonical) continue;
    const key = normalizeClassKey(canonical);
    if (!seenKeys.has(key)) {
      seenKeys.set(key, canonical);
    }
  }

  return sortClassNames(Array.from(seenKeys.values()));
}

/**
 * Ensures all students in an array have their className canonicalized
 * to the exact database class name.
 */
export function sanitizeStudentClasses<T extends { className?: string }>(
  students: T[]
): T[] {
  if (!Array.isArray(students)) return [];
  return students.map((s) => {
    if (!s) return s;
    const canonical = canonicalizeClassName(s.className);
    if (s.className !== canonical) {
      return {
        ...s,
        className: canonical,
      };
    }
    return s;
  });
}
