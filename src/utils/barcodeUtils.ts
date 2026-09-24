import QRCode from "qrcode";
import { Student } from "../types";

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  darkColor?: string;
  lightColor?: string;
}

// In-memory cache for fast repeated rendering
const qrCodeCache = new Map<string, string>();

/**
 * Detects the best available public origin for QR codes so mobile devices / Google Lens can access it.
 * Priority:
 * 1. User-customized URL in localStorage (e.g. school computer lab local IP http://192.168.x.x:3000 or custom domain)
 * 2. window.location.origin (if standard http/https)
 * 3. document.referrer origin (if running inside an iframe)
 */
export function getPublicAppOrigin(): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem("gpp_custom_portal_url");
      if (saved && saved.trim().startsWith("http")) {
        return saved.trim().replace(/\/+$/, "");
      }
    }
  } catch {
    // ignore
  }

  try {
    if (typeof window !== "undefined" && window.location) {
      const origin = window.location.origin;
      if (origin && origin !== "null" && origin !== "about:blank" && origin.startsWith("http")) {
        return origin.replace(/\/+$/, "");
      }
    }
  } catch {
    // ignore
  }

  try {
    if (typeof document !== "undefined" && document.referrer) {
      const refUrl = new URL(document.referrer);
      if (refUrl.origin && refUrl.origin.startsWith("http")) {
        return refUrl.origin.replace(/\/+$/, "");
      }
    }
  } catch {
    // ignore
  }

  return "https://gusthypalinpatandaexam.ai.studio";
}

/**
 * Saves a user-customized portal base URL to localStorage.
 */
export function setCustomPortalOrigin(url: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (!url || !url.trim()) {
        window.localStorage.removeItem("gpp_custom_portal_url");
      } else {
        const clean = url.trim().replace(/\/+$/, "");
        window.localStorage.setItem("gpp_custom_portal_url", clean);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Generates a high-contrast, standard-compliant QR Code Data URL.
 * Optimized specifically for Google Lens, iOS Camera, Android Camera, and webcam scanners:
 * - Pure black (#000000) on pure white (#ffffff) for maximum optical contrast
 * - Quiet Zone (margin) of 4 modules to allow Google Lens edge-detection algorithms to lock on
 * - High/Medium error correction to tolerate screen reflections, glare, and angled phone scanning
 */
export async function generateQRCode(
  text: string,
  options?: QRCodeOptions
): Promise<string> {
  if (!text || !text.trim()) return "";

  const width = options?.width || 360;
  const margin = options?.margin ?? 4; // ISO/IEC standard 4-module quiet zone
  const errorCorrectionLevel = options?.errorCorrectionLevel || "M";
  const darkColor = options?.darkColor || "#000000";
  const lightColor = options?.lightColor || "#ffffff";

  const cacheKey = `${text}_${width}_${margin}_${errorCorrectionLevel}_${darkColor}_${lightColor}`;
  if (qrCodeCache.has(cacheKey)) {
    return qrCodeCache.get(cacheKey)!;
  }

  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width,
      margin,
      errorCorrectionLevel,
      color: {
        dark: darkColor,
        light: lightColor,
      },
    });

    qrCodeCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error("QR Code generation error:", err);
    return "";
  }
}

export interface ParsedScanResult {
  token: string;
  nisn: string;
  id: string;
  className: string;
  raw: string;
}

/**
 * Creates the payload string for a student QR code:
 * - 'url': Formats a direct login web link (e.g. https://domain.com/?token=GPP-XIIPSP7-0060001002&nisn=0060001002&id=std-...&cls=XII+PSP+7).
 *   When scanned with Google Lens or a camera scanner, it matches the exact student with 100% precision!
 * - 'token': Raw barcode token string (e.g. GPP-XIIPSP7-0060001002) for handheld hardware USB scanners.
 */
export function getStudentQrPayload(
  token: string,
  nisn: string,
  format: "url" | "token" | string = "url",
  studentId?: string,
  className?: string,
  customBaseUrl?: string
): string {
  if (format === "token") return token;

  const baseOrigin = (customBaseUrl || getPublicAppOrigin()).replace(/\/+$/, "");
  const pathname = typeof window !== "undefined" && window.location?.pathname ? window.location.pathname : "/";
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  try {
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (nisn) params.set("nisn", nisn);
    if (studentId) params.set("id", studentId);
    if (className) params.set("cls", className);
    return `${baseOrigin}${cleanPath}?${params.toString()}`;
  } catch (e) {
    console.warn("Could not determine URL for student QR payload", e);
  }

  return token;
}

/**
 * Parses comprehensive parameters from raw scan input.
 * Extracts: token, nisn, student id, and class name from QR URLs or raw tokens.
 */
export function parseStudentScanPayload(raw: string): ParsedScanResult {
  if (!raw) return { token: "", nisn: "", id: "", className: "", raw: "" };
  const trimmed = raw.trim();

  let token = "";
  let nisn = "";
  let id = "";
  let className = "";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("?") ||
    trimmed.includes("token=") ||
    trimmed.includes("barcode=") ||
    trimmed.includes("id=") ||
    trimmed.includes("nisn=")
  ) {
    try {
      const urlString = trimmed.startsWith("http")
        ? trimmed
        : `https://dummy.internal/${trimmed.startsWith("?") ? trimmed : `?${trimmed}`}`;
      const parsedUrl = new URL(urlString);
      token =
        parsedUrl.searchParams.get("token") ||
        parsedUrl.searchParams.get("barcode") ||
        parsedUrl.searchParams.get("code") ||
        "";
      nisn = parsedUrl.searchParams.get("nisn") || "";
      id = parsedUrl.searchParams.get("id") || "";
      className =
        parsedUrl.searchParams.get("cls") ||
        parsedUrl.searchParams.get("class") ||
        parsedUrl.searchParams.get("kelas") ||
        "";
    } catch {
      // Fallback
    }
  }

  // Only fallback to raw string if this was NOT a navigation URL
  if (!token && !id && !nisn) {
    const isNavigationUrl =
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.includes("portal=") ||
      trimmed.includes("tab=");
    if (!isNavigationUrl) {
      token = trimmed;
    }
  }

  return {
    token: (token || "").trim(),
    nisn: (nisn || "").trim(),
    id: (id || "").trim(),
    className: (className || "").trim(),
    raw: trimmed,
  };
}

/**
 * Safely extracts student token or NISN from raw scan input.
 * Handles:
 * - Direct tokens: "GPP-STD-001-TOKEN"
 * - Direct NISN: "0051234001"
 * - Full URLs from Google Lens: "https://domain.com/?token=GPP-STD-001-TOKEN&nisn=..."
 * - Query strings: "?token=GPP-..."
 * - Returns empty string for navigation/portal URLs (e.g. ?portal=login&tab=siswa) to prevent false-positive failed logins.
 */
export function extractTokenFromScan(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // If input is a URL or query string, check if it actually contains student credential params
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("?") ||
    trimmed.includes("portal=") ||
    trimmed.includes("tab=")
  ) {
    try {
      const urlString = trimmed.startsWith("http")
        ? trimmed
        : `https://dummy.internal/${trimmed.startsWith("?") ? trimmed : `?${trimmed}`}`;
      const parsedUrl = new URL(urlString);
      const token =
        parsedUrl.searchParams.get("token") ||
        parsedUrl.searchParams.get("barcode") ||
        parsedUrl.searchParams.get("code") ||
        "";
      const nisn = parsedUrl.searchParams.get("nisn") || "";
      const id = parsedUrl.searchParams.get("id") || "";

      if (id || token || nisn) {
        return id || token || nisn;
      }
      // If it's just a portal URL like ?portal=login, return "" so it's not treated as a bad token
      return "";
    } catch {
      return "";
    }
  }

  const parsed = parseStudentScanPayload(trimmed);
  return parsed.id || parsed.token || parsed.nisn || parsed.raw;
}

/**
 * Generates a clean, unique student barcode token combining class code and NISN.
 * If existingTokens is provided, guarantees no collision by appending a unique incremental suffix (-1, -2, etc.).
 * Automatically updates existingTokens if it is a Set, so multiple calls in sequence never generate duplicates.
 */
export function generateUniqueStudentToken(
  className: string,
  nisn: string,
  fallbackId = "",
  existingTokens?: Set<string> | string[]
): string {
  const cleanClass = (className || "UMUM")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10) || "UMUM";

  const rawNisn = (nisn || "").trim();
  const isDummy =
    !rawNisn ||
    rawNisn === "-" ||
    rawNisn === "--" ||
    rawNisn === "0" ||
    rawNisn.toLowerCase() === "null" ||
    rawNisn.toLowerCase() === "none" ||
    rawNisn.toLowerCase() === "na" ||
    /^0+$/.test(rawNisn);

  let idPart = "";
  if (!isDummy) {
    idPart = rawNisn.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  }
  if (!idPart) {
    if (fallbackId && fallbackId.trim()) {
      const sanitized = fallbackId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      idPart = sanitized.slice(-6) || sanitized;
    } else {
      idPart = `${Date.now().toString(36).toUpperCase().slice(-4)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    }
  }

  const baseToken = `GPP-${cleanClass}-${idPart}`;

  if (!existingTokens) {
    return baseToken;
  }

  // Build a normalized lower-cased lookup set
  const lowerSet = new Set<string>();
  if (existingTokens instanceof Set) {
    existingTokens.forEach((t) => {
      if (t) lowerSet.add(t.toLowerCase());
    });
  } else if (Array.isArray(existingTokens)) {
    existingTokens.forEach((t) => {
      if (t) lowerSet.add(t.toLowerCase());
    });
  }

  if (!lowerSet.has(baseToken.toLowerCase())) {
    if (existingTokens instanceof Set) {
      existingTokens.add(baseToken);
    }
    return baseToken;
  }

  // Collision detected: Append sequential suffix to guarantee 100% uniqueness
  let counter = 1;
  while (lowerSet.has(`${baseToken}-${counter}`.toLowerCase())) {
    counter++;
  }
  const uniqueToken = `${baseToken}-${counter}`;
  lowerSet.add(uniqueToken.toLowerCase());
  if (existingTokens instanceof Set) {
    existingTokens.add(uniqueToken);
  }
  return uniqueToken;
}

export interface StudentTokenAuditResult {
  isValid: boolean;
  totalStudents: number;
  uniqueCount: number;
  duplicateCount: number;
  missingCount: number;
  duplicateGroups: Array<{
    token: string;
    count: number;
    students: Array<{ id: string; name: string; className: string; nisn: string }>;
  }>;
}

/**
 * Audits all student barcodes to verify 100% uniqueness and zero missing tokens.
 */
export function auditStudentTokens(students: Student[]): StudentTokenAuditResult {
  if (!Array.isArray(students) || students.length === 0) {
    return {
      isValid: true,
      totalStudents: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      missingCount: 0,
      duplicateGroups: [],
    };
  }

  const map = new Map<string, Array<{ id: string; name: string; className: string; nisn: string }>>();
  let missingCount = 0;

  students.forEach((s) => {
    const raw = (s.startBarcodeToken || "").trim().toLowerCase();
    if (!raw) {
      missingCount++;
      return;
    }
    const list = map.get(raw) || [];
    list.push({ id: s.id, name: s.name, className: s.className, nisn: s.nisn });
    map.set(raw, list);
  });

  const duplicateGroups: Array<{
    token: string;
    count: number;
    students: Array<{ id: string; name: string; className: string; nisn: string }>;
  }> = [];

  let duplicateCount = 0;
  map.forEach((list, token) => {
    if (list.length > 1) {
      duplicateCount += list.length - 1;
      duplicateGroups.push({
        token,
        count: list.length,
        students: list,
      });
    }
  });

  const isValid = missingCount === 0 && duplicateCount === 0;

  return {
    isValid,
    totalStudents: students.length,
    uniqueCount: map.size,
    duplicateCount,
    missingCount,
    duplicateGroups,
  };
}

/**
 * Scans an array of students and guarantees:
 * 1. Every student has a valid, non-empty startBarcodeToken.
 * 2. NO two students share the same startBarcodeToken (100% non-duplicate).
 * 3. Any duplicated or missing tokens are automatically resolved and updated.
 */
export function ensureUniqueStudentTokens(students: Student[]): {
  students: Student[];
  fixedCount: number;
  duplicateCount: number;
  missingCount: number;
} {
  if (!Array.isArray(students) || students.length === 0) {
    return { students: [], fixedCount: 0, duplicateCount: 0, missingCount: 0 };
  }

  const seenTokens = new Set<string>();
  let fixedCount = 0;
  let duplicateCount = 0;
  let missingCount = 0;

  const result: Student[] = students.map((s, idx) => {
    const rawToken = (s.startBarcodeToken || "").trim();
    const tokenLower = rawToken.toLowerCase();

    const isMissing = !rawToken;
    const isDuplicate = Boolean(rawToken && seenTokens.has(tokenLower));

    if (isMissing) missingCount++;
    if (isDuplicate) duplicateCount++;

    if (isMissing || isDuplicate) {
      fixedCount++;
      const uniqueToken = generateUniqueStudentToken(
        s.className,
        s.nisn,
        s.id || `st_${idx}`,
        seenTokens
      );
      seenTokens.add(uniqueToken.toLowerCase());
      return {
        ...s,
        startBarcodeToken: uniqueToken,
      };
    }

    seenTokens.add(tokenLower);
    return s;
  });

  return { students: result, fixedCount, duplicateCount, missingCount };
}

/**
 * Returns the direct login portal web URL designed for Google Lens and camera QR scanning.
 * When scanned by a student's phone camera or Google Lens, it prompts the student to tap
 * "Buka Situs Web" and opens the exam login page directly.
 * Guaranteed to be an absolute URL with https:// or http:// protocol.
 */
export function getLoginPortalUrl(
  roleTab: "siswa" | "guru" | "admin" | "portal" = "siswa",
  customBaseUrl?: string
): string {
  const base = (customBaseUrl || getPublicAppOrigin()).replace(/\/+$/, "");
  const pathname = typeof window !== "undefined" && window.location?.pathname ? window.location.pathname : "/";
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (roleTab === "portal") {
    return `${base}${cleanPath}`;
  }
  return `${base}${cleanPath}?portal=login&tab=${encodeURIComponent(roleTab)}`;
}

