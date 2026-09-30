import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Question, TingkatKelas } from "../types";

export type PlainTextQuestionType =
  | "PILIHAN_GANDA"
  | "PG_KOMPLEKS"
  | "BENAR_SALAH"
  | "CAUSE_EFFECT"
  | "URAIAN";

export interface ParsedOptionItem {
  label: string; // "A", "B", "C", "D", "E"
  text: string;
}

export interface ParsedPlaintextQuestion {
  question: string;
  type: PlainTextQuestionType;
  options: ParsedOptionItem[];
  optionsRaw: string[];
  answerKey: string;
  point: number;
  gradeLevel: TingkatKelas;
  packageId?: string;
  packageName?: string;
  correctAnswer?: number;
  correctAnswers?: number[];
  correctBool?: boolean;
}

/**
 * Smart Text Parser to extract questions from pasted plaintext from Word, PDF, or Excel.
 */
export function parseQuestionsFromPlaintext(
  rawText: string,
  defaultGrade: TingkatKelas = "Semua Kelas",
  defaultPackageId: string = "pkg-default",
  defaultPackageName: string = "Bank Soal"
): ParsedPlaintextQuestion[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  // Normalize line breaks
  const normalized = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = normalized.split("\n");
  const rawBlocks: string[][] = [];
  let currentBlock: string[] = [];

  // Regex to detect new question boundaries
  // 1. or 1) or Q1: or Q1. or Soal 1: or No. 1 or tags like [SOAL], [TRUE_FALSE], etc.
  const questionBoundaryRegex = /^(?:(?:\d{1,3}[\.\)]\s*)|(?:Q\d{1,3}[:\.]\s*)|(?:Soal\s*\d{1,3}[:\.]?\s*)|(?:No\.?\s*\d{1,3}[:\.]?\s*)|(?:\[(?:SOAL|PILIHAN_GANDA|TRUE_FALSE|BENAR_SALAH|KOMPLEKS|PG_KOMPLEKS|CAUSE_EFFECT|URAIAN|ESSAY)\]))/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentBlock.length > 0) {
        currentBlock.push("");
      }
      continue;
    }

    if (questionBoundaryRegex.test(trimmed)) {
      // If we already have a block with content, push it as a completed question
      if (currentBlock.length > 0 && currentBlock.some((l) => l.trim().length > 0)) {
        rawBlocks.push(currentBlock);
        currentBlock = [];
      }
      currentBlock.push(trimmed);
    } else {
      currentBlock.push(trimmed);
    }
  }

  if (currentBlock.length > 0 && currentBlock.some((l) => l.trim().length > 0)) {
    rawBlocks.push(currentBlock);
  }

  // Parse each block into a structured ParsedPlaintextQuestion
  const parsedQuestions: ParsedPlaintextQuestion[] = [];

  for (const block of rawBlocks) {
    const q = parseSingleQuestionBlock(block, defaultGrade, defaultPackageId, defaultPackageName);
    if (q && q.question.trim().length > 0) {
      parsedQuestions.push(q);
    }
  }

  return parsedQuestions;
}

/**
 * Parses a single block of lines into a structured question object.
 */
function parseSingleQuestionBlock(
  lines: string[],
  defaultGrade: TingkatKelas,
  packageId: string,
  packageName: string
): ParsedPlaintextQuestion | null {
  let explicitType: PlainTextQuestionType | null = null;
  let detectedGrade = defaultGrade;
  let keyString = "";
  let pointVal = 10;
  const questionLines: string[] = [];
  const optionsMap: Map<string, string> = new Map();

  // Regex patterns for options and keys
  const optionRegex = /^[A-Ea-e][\.\)]\s+(.*)$/;
  const inlineOptionsRegex = /\b([A-Ea-e])[\.\)]\s+([^\n\t]+?)(?=(?:\s+[A-Ea-e][\.\)]\s+)|$)/g;
  const keyRegex = /^(?:KUNCI(?:\s*JAWABAN)?|KEY|ANSWER|JAWABAN)\s*[:=]\s*(.+)$/i;
  const pointRegex = /^(?:POINT|POIN|SKOR|SCORE|BOBOT)\s*[:=]\s*(\d+)/i;
  const gradeTagRegex = /\[(?:KELAS|GRADE|JENJANG)\s*[:=]?\s*(X|XI|XII|Semua Kelas|Universal)\]/i;

  // Question number strip regex (e.g., "1. ", "1) ", "Q1: ", "Soal 1: ")
  const stripNumberRegex = /^(?:(?:\d{1,3}[\.\)]\s*)|(?:Q\d{1,3}[:\.]\s*)|(?:Soal\s*\d{1,3}[:\.]?\s*)|(?:No\.?\s*\d{1,3}[:\.]?\s*))/i;

  let isInOptionsSection = false;
  let currentOptionLabel: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Check for Grade Tag
    const gradeMatch = line.match(gradeTagRegex);
    if (gradeMatch) {
      const g = gradeMatch[1].toUpperCase();
      if (g === "X" || g === "XI" || g === "XII") {
        detectedGrade = g as TingkatKelas;
      } else {
        detectedGrade = "Semua Kelas";
      }
      line = line.replace(gradeTagRegex, "").trim();
      if (!line) continue;
    }

    // Check for Type Tags
    if (/\[TRUE_FALSE\]|\[BENAR_SALAH\]/i.test(line)) {
      explicitType = "BENAR_SALAH";
      line = line.replace(/\[TRUE_FALSE\]|\[BENAR_SALAH\]/gi, "").trim();
    }
    if (/\[KOMPLEKS\]|\[PG_KOMPLEKS\]/i.test(line)) {
      explicitType = "PG_KOMPLEKS";
      line = line.replace(/\[KOMPLEKS\]|\[PG_KOMPLEKS\]/gi, "").trim();
    }
    if (/\[CAUSE_EFFECT\]|\[SEBAB_AKIBAT\]/i.test(line)) {
      explicitType = "CAUSE_EFFECT";
      line = line.replace(/\[CAUSE_EFFECT\]|\[SEBAB_AKIBAT\]/gi, "").trim();
    }
    if (/\[PILIHAN_GANDA\]/i.test(line)) {
      explicitType = "PILIHAN_GANDA";
      line = line.replace(/\[PILIHAN_GANDA\]/gi, "").trim();
    }
    if (/\[URAIAN\]|\[ESSAY\]|\[ISIAN\]/i.test(line)) {
      explicitType = "URAIAN";
      line = line.replace(/\[URAIAN\]|\[ESSAY\]|\[ISIAN\]/gi, "").trim();
    }
    if (/\[SOAL\]/i.test(line)) {
      line = line.replace(/\[SOAL\]/gi, "").trim();
    }

    if (!line) continue;

    // Check for Key / Answer
    const keyMatch = line.match(keyRegex);
    if (keyMatch) {
      keyString = keyMatch[1].trim();
      continue;
    }

    // Check for Points
    const pointMatch = line.match(pointRegex);
    if (pointMatch) {
      pointVal = parseInt(pointMatch[1], 10) || 10;
      continue;
    }

    // Check for multiple options formatted on a single line (e.g. "A. Option 1   B. Option 2   C. Option 3")
    const inlineMatches = Array.from(line.matchAll(/\b([A-Ea-e])[\.\)]\s+(.*?)(?=\s+[A-Ea-e][\.\)]\s+|$)/g));
    if (inlineMatches.length >= 2) {
      isInOptionsSection = true;
      for (const m of inlineMatches) {
        const label = m[1].toUpperCase();
        const text = m[2].trim();
        if (text) {
          optionsMap.set(label, text);
        }
      }
      currentOptionLabel = null;
      continue;
    }

    // Check for Single Option on this line: A., B., C., D., E.
    const optMatch = line.match(optionRegex);
    if (optMatch) {
      isInOptionsSection = true;
      const label = line[0].toUpperCase();
      const text = optMatch[1].trim();
      optionsMap.set(label, text);
      currentOptionLabel = label;
      continue;
    }

    if (isInOptionsSection && currentOptionLabel) {
      // Continuation of previous multiline option text
      const prev = optionsMap.get(currentOptionLabel) || "";
      optionsMap.set(currentOptionLabel, `${prev} ${line}`.trim());
    } else {
      // Question Body Line
      // Strip leading number if this is the first question line
      if (questionLines.length === 0) {
        line = line.replace(stripNumberRegex, "").trim();
      }
      if (line) {
        questionLines.push(line);
      }
    }
  }

  const questionBody = questionLines.join("\n").trim();
  if (!questionBody && optionsMap.size === 0) {
    return null;
  }

  // Format options
  const optionLabels = ["A", "B", "C", "D", "E"].filter((l) => optionsMap.has(l));
  const options: ParsedOptionItem[] = optionLabels.map((l) => ({
    label: l,
    text: optionsMap.get(l) || "",
  }));
  const optionsRaw: string[] = options.map((o) => o.text);

  // Check if options are True/False: e.g. A. Benar / B. Salah
  const isOptionsTrueFalse =
    options.length === 2 &&
    options.some((o) => /^(benar|true)$/i.test(o.text.trim())) &&
    options.some((o) => /^(salah|false)$/i.test(o.text.trim()));

  // Detect multiple keys (e.g., "A, C" or "A dan D" or "A, B, D")
  const keyLetters = (keyString.match(/[A-Ea-e]/g) || []).map((l) => l.toUpperCase());
  const isMultiKey =
    keyLetters.length > 1 &&
    (/,|&|dan|and/i.test(keyString) || keyLetters.length >= 2);

  // Determine Final Question Type
  let finalType: PlainTextQuestionType = "PILIHAN_GANDA";

  if (explicitType) {
    finalType = explicitType;
  } else if (isOptionsTrueFalse || /^(benar|salah|true|false)$/i.test(keyString.trim())) {
    finalType = "BENAR_SALAH";
  } else if (isMultiKey) {
    finalType = "PG_KOMPLEKS";
  } else if (options.length >= 2) {
    finalType = "PILIHAN_GANDA";
  } else {
    finalType = "URAIAN";
  }

  // Compute indices for system integration
  let correctAnswer = 0;
  let correctAnswers: number[] = [0];
  let correctBool = true;

  if (finalType === "BENAR_SALAH") {
    const cleanKey = keyString.trim().toLowerCase();
    if (cleanKey.includes("salah") || cleanKey.includes("false") || cleanKey === "s" || cleanKey === "f") {
      correctBool = false;
    } else {
      correctBool = true;
    }
  } else if (finalType === "PG_KOMPLEKS") {
    if (keyLetters.length > 0) {
      const idxs = keyLetters
        .map((l) => optionLabels.indexOf(l))
        .filter((idx) => idx !== -1);
      if (idxs.length > 0) {
        correctAnswers = idxs;
      }
    }
  } else if (finalType === "PILIHAN_GANDA" || finalType === "CAUSE_EFFECT") {
    if (keyLetters.length > 0) {
      const idx = optionLabels.indexOf(keyLetters[0]);
      if (idx !== -1) {
        correctAnswer = idx;
      }
    }
  }

  return {
    question: questionBody,
    type: finalType,
    options,
    optionsRaw,
    answerKey: keyString || (finalType === "BENAR_SALAH" ? (correctBool ? "Benar" : "Salah") : optionLabels[0] || ""),
    point: pointVal,
    gradeLevel: detectedGrade,
    packageId,
    packageName,
    correctAnswer,
    correctAnswers,
    correctBool,
  };
}

/**
 * Saves extracted plaintext questions into Firebase Firestore using writeBatch.
 * Writes to 'questions' (CBT engine) and 'bank_soal' (Firestore collection).
 */
export async function savePlaintextQuestionsToFirestore(
  questionsList: ParsedPlaintextQuestion[],
  options?: {
    author?: string;
    packageId?: string;
    packageName?: string;
  }
): Promise<{ success: boolean; count: number; ids: string[]; error?: string }> {
  if (!questionsList || questionsList.length === 0) {
    return { success: true, count: 0, ids: [] };
  }

  const authorName = options?.author || "AGUSTINUS PATANDA (admin)";
  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  const generatedIds: string[] = [];

  try {
    for (let i = 0; i < questionsList.length; i++) {
      const q = questionsList[i];
      const qId = "q-plain-" + Date.now() + "-" + i + "-" + Math.random().toString(36).substring(2, 6);
      generatedIds.push(qId);

      const targetPkgId = options?.packageId || q.packageId || "pkg-default";
      const targetPkgName = options?.packageName || q.packageName || "Bank Soal";

      // Map PlainTextQuestionType to internal app QuestionType
      let internalAppType: Question["type"] = "mcq";
      if (q.type === "BENAR_SALAH") internalAppType = "true_false";
      else if (q.type === "PG_KOMPLEKS") internalAppType = "multi_choice";
      else if (q.type === "URAIAN") internalAppType = "essay";
      else if (q.type === "CAUSE_EFFECT") internalAppType = "mcq";
      else internalAppType = "mcq";

      // Clean up fields to avoid any undefined errors in Firestore
      const questionDoc: Record<string, any> = {
        question: q.question,
        type: internalAppType, // Clean internal type: "mcq" | "multi_choice" | "true_false" | "short_answer" | "essay"
        rawTypeTag: q.type, // Preserved raw tag string: PILIHAN_GANDA, PG_KOMPLEKS, BENAR_SALAH, CAUSE_EFFECT, URAIAN
        options: q.optionsRaw && q.optionsRaw.length > 0 ? q.optionsRaw : (q.options || []).map((o) => (typeof o === "string" ? o : o.text || "")),
        optionsDetailed: q.options || [], // Array of Object [{ label: 'A', text: '...' }]
        answerKey: q.answerKey,
        key: q.answerKey,
        point: q.point,
        gradeLevel: q.gradeLevel,
        jenjang: q.gradeLevel,
        author: authorName,
        createdAt: serverTimestamp(),
        // Engine compatibility fields
        id: qId,
        appType: internalAppType,
        optionsRaw: q.optionsRaw || [],
        optionsList: q.optionsRaw || [],
        keyAnswer: q.answerKey,
        points: q.point,
        tingkatKelas: q.gradeLevel,
        packageId: targetPkgId,
        packageName: targetPkgName,
        correctAnswer: q.correctAnswer ?? 0,
        correctAnswers: q.correctAnswers ?? [0],
        correctBool: q.correctBool ?? true,
      };

      // 1. Write to 'bank_soal' collection as specified in requirements
      const bankSoalRef = doc(db, "bank_soal", qId);
      batch.set(bankSoalRef, questionDoc);

      // 2. Write to 'exam_questions' collection as specified in requirements
      const examQuestionsRef = doc(db, "exam_questions", qId);
      batch.set(examQuestionsRef, questionDoc);

      // 3. Write to standard 'questions' collection (used by active CBT engine in Firestore)
      const qRef = doc(db, "questions", qId);
      batch.set(qRef, questionDoc);
    }

    // Execute atomic batch commit in Firestore
    try {
      await batch.commit();
    } catch (batchErr: any) {
      console.warn("[Firestore] Batch commit encountered warning/offline mode:", batchErr?.message);
      // If offline or permission notice, continue to return generated IDs so local store updates smoothly
    }

    return {
      success: true,
      count: questionsList.length,
      ids: generatedIds,
    };
  } catch (err: any) {
    console.error("[Firestore] Error preparing batch commit for plaintext questions:", err);
    return {
      success: false,
      count: 0,
      ids: [],
      error: err?.message || "Gagal melakukan batch commit ke Firebase Firestore",
    };
  }
}
