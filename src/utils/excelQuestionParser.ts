import * as XLSX from "xlsx";
import { Question, QuestionType, MatchingPair, TingkatKelas, parseTingkatKelas } from "../types";

export function downloadExcelQuestionTemplate(): void {
  const rows = [
    {
      "No": 1,
      "Kelas": "Semua Kelas",
      "Tipe Soal": "PG",
      "Pertanyaan": "Manakah protokol jaringan yang bertugas menyediakan enkripsi saat browsing web?",
      "Opsi A": "HTTP",
      "Opsi B": "HTTPS",
      "Opsi C": "FTP",
      "Opsi D": "Telnet",
      "Opsi E": "SMTP",
      "Kunci Jawaban": "B",
      "Poin": 10,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
    {
      "No": 2,
      "Kelas": "X",
      "Tipe Soal": "PG",
      "Pertanyaan": "Tentukan akar dari persamaan kuadrat $x^2 - 5x + 6 = 0$:",
      "Opsi A": "$x = 1$ atau $x = 6$",
      "Opsi B": "$x = 2$ atau $x = 3$",
      "Opsi C": "$x = -2$ atau $x = -3$",
      "Opsi D": "$x = 5$ atau $x = 6$",
      "Opsi E": "$x = 0$",
      "Kunci Jawaban": "B",
      "Poin": 10,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
    {
      "No": 3,
      "Tipe Soal": "BENAR_SALAH",
      "Pertanyaan": "Bilangan prima terkecil yang merupakan bilangan genap adalah 2.",
      "Opsi A": "",
      "Opsi B": "",
      "Opsi C": "",
      "Opsi D": "",
      "Opsi E": "",
      "Kunci Jawaban": "BENAR",
      "Poin": 10,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
    {
      "No": 4,
      "Tipe Soal": "BENAR_SALAH",
      "Pertanyaan": "Kecepatan cahaya di ruang hampa adalah 300 kilometer per jam.",
      "Opsi A": "",
      "Opsi B": "",
      "Opsi C": "",
      "Opsi D": "",
      "Opsi E": "",
      "Kunci Jawaban": "SALAH",
      "Poin": 10,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
    {
      "No": 5,
      "Tipe Soal": "JODOHKAN",
      "Pertanyaan": "Pasangkan ibu kota negara dengan nama negaranya:",
      "Opsi A": "",
      "Opsi B": "",
      "Opsi C": "",
      "Opsi D": "",
      "Opsi E": "",
      "Kunci Jawaban": "Jakarta = Indonesia; Tokyo = Jepang; Seoul = Korea Selatan; Canberra = Australia",
      "Poin": 20,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
    {
      "No": 6,
      "Tipe Soal": "KOMPLEKS",
      "Pertanyaan": "Manakah komponen berikut yang termasuk ke dalam perangkat keras output (Output Device)?",
      "Opsi A": "Monitor",
      "Opsi B": "Keyboard",
      "Opsi C": "Printer",
      "Opsi D": "Scanner",
      "Opsi E": "Speaker",
      "Kunci Jawaban": "A, C, E",
      "Poin": 15,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
    {
      "No": 7,
      "Tipe Soal": "PG",
      "Pertanyaan": "Dengarkan audio berikut dengan saksama, topik percakapan adalah...",
      "Opsi A": "Liburan sekolah",
      "Opsi B": "Jadwal ujian semester",
      "Opsi C": "Tugas kelompok",
      "Opsi D": "Lomba kebersihan",
      "Opsi E": "Pembelian buku",
      "Kunci Jawaban": "B",
      "Poin": 15,
      "Tipe Media": "AUDIO",
      "URL Media": "https://actions.google.com/sounds/v1/speech/announcement_chime.ogg",
      "Batas Putar Audio": 2,
      "Keterangan Media": "Audio Percakapan Listening Section",
    },
    {
      "No": 8,
      "Tipe Soal": "ISIAN",
      "Pertanyaan": "Proses pembuatan makanan pada tumbuhan berklorofil dengan bantuan sinar matahari disebut...",
      "Opsi A": "",
      "Opsi B": "",
      "Opsi C": "",
      "Opsi D": "",
      "Opsi E": "",
      "Kunci Jawaban": "Fotosintesis",
      "Poin": 10,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
    {
      "No": 9,
      "Tipe Soal": "ESSAY",
      "Pertanyaan": "Jelaskan konsep Two-Factor Authentication (2FA) serta sebutkan minimal 2 contoh faktornya!",
      "Opsi A": "",
      "Opsi B": "",
      "Opsi C": "",
      "Opsi D": "",
      "Opsi E": "",
      "Kunci Jawaban": "Autentikasi ganda dua lapis verifikasi. Contoh: Password/PIN, OTP SMS/email, biometrik sidik jari.",
      "Poin": 20,
      "Tipe Media": "NONE",
      "URL Media": "",
      "Batas Putar Audio": "",
      "Keterangan Media": "",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
  XLSX.writeFile(wb, "Template_Soal_Ujian_Excel.xlsx");
}

/**
 * Normalizes header string to lowercase alphanumeric for reliable matching.
 */
function normalizeHeaderKey(key: string): string {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parses questions from an Excel buffer.
 * Supports multiple sheets, auto-detects header row position, and handles flexible column aliases.
 */
export function parseQuestionsFromExcel(buffer: ArrayBuffer): Omit<Question, "id">[] {
  const wb = XLSX.read(buffer, { type: "array" });
  let questions: Omit<Question, "id">[] = [];

  // Iterate sheets to find where questions actually reside
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rawRows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as any[][];

    if (!rawRows || rawRows.length === 0) continue;

    // Scan first 12 rows to find the actual header row
    let headerRowIdx = -1;
    let maxHeaderScore = 0;

    for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      let score = 0;
      for (const cell of row) {
        const norm = normalizeHeaderKey(String(cell));
        if (
          norm.includes("soal") ||
          norm.includes("pertanyaan") ||
          norm.includes("question") ||
          norm.includes("butir") ||
          norm.includes("item")
        ) {
          score += 5;
        }
        if (norm.includes("kunci") || norm.includes("jawaban") || norm.includes("answer") || norm.includes("key")) {
          score += 4;
        }
        if (norm.includes("opsi") || norm.includes("pilihan") || norm === "a" || norm === "b") {
          score += 3;
        }
        if (norm.includes("poin") || norm.includes("bobot") || norm.includes("skor") || norm.includes("score")) {
          score += 2;
        }
        if (norm.includes("kelas") || norm.includes("tingkat") || norm.includes("jenjang")) {
          score += 2;
        }
      }

      if (score > maxHeaderScore) {
        maxHeaderScore = score;
        headerRowIdx = r;
      }
    }

    // If no strong header row found, default to index 0
    if (headerRowIdx === -1 || maxHeaderScore < 3) {
      headerRowIdx = 0;
    }

    const headerRow = rawRows[headerRowIdx] || [];
    const colIndices: Record<string, number> = {};

    headerRow.forEach((cellVal, colIdx) => {
      const norm = normalizeHeaderKey(String(cellVal));
      if (!norm) return;

      // Question text aliases
      if (
        (norm.includes("pertanyaan") ||
          norm.includes("soal") ||
          norm.includes("question") ||
          norm.includes("item") ||
          norm.includes("butir")) &&
        !norm.includes("tipe") &&
        !norm.includes("jenis") &&
        !norm.includes("kunci")
      ) {
        if (colIndices.question === undefined) colIndices.question = colIdx;
      }

      // Type aliases
      if (
        norm.includes("tipe") ||
        norm.includes("jenis") ||
        norm.includes("bentuk") ||
        norm === "type" ||
        norm === "format"
      ) {
        if (colIndices.type === undefined) colIndices.type = colIdx;
      }

      // Options A-E aliases
      if (norm === "opsia" || norm === "pilihana" || norm === "jawabana" || norm === "a" || norm === "optiona") {
        colIndices.optA = colIdx;
      } else if (norm === "opsib" || norm === "pilihanb" || norm === "jawabanb" || norm === "b" || norm === "optionb") {
        colIndices.optB = colIdx;
      } else if (norm === "opsic" || norm === "pilihanc" || norm === "jawabanc" || norm === "c" || norm === "optionc") {
        colIndices.optC = colIdx;
      } else if (norm === "opsid" || norm === "pilihand" || norm === "jawaband" || norm === "d" || norm === "optiond") {
        colIndices.optD = colIdx;
      } else if (norm === "opsie" || norm === "pilihane" || norm === "jawabane" || norm === "e" || norm === "optione") {
        colIndices.optE = colIdx;
      }

      // Answer key aliases
      if (
        norm.includes("kunci") ||
        norm.includes("jawabanbenar") ||
        norm === "jawaban" ||
        norm === "key" ||
        norm === "answer" ||
        norm === "correct"
      ) {
        if (colIndices.key === undefined) colIndices.key = colIdx;
      }

      // Points aliases
      if (
        norm.includes("poin") ||
        norm.includes("bobot") ||
        norm.includes("skor") ||
        norm.includes("score") ||
        norm.includes("nilai")
      ) {
        if (colIndices.points === undefined) colIndices.points = colIdx;
      }

      // Class level aliases
      if (
        norm.includes("kelas") ||
        norm.includes("tingkat") ||
        norm.includes("jenjang") ||
        norm.includes("grade") ||
        norm.includes("target")
      ) {
        if (colIndices.kelas === undefined) colIndices.kelas = colIdx;
      }

      // Media aliases
      if (norm.includes("tipemedia") || norm === "media") {
        colIndices.mediaType = colIdx;
      }
      if (norm.includes("url") || norm.includes("link") || norm.includes("gambar")) {
        colIndices.mediaUrl = colIdx;
      }
      if (norm.includes("keterangan") || norm.includes("caption")) {
        colIndices.mediaCaption = colIdx;
      }
      if (norm.includes("putar") || norm.includes("limit")) {
        colIndices.audioLimit = colIdx;
      }
    });

    // If question column wasn't clearly identified, try column 1 or 2 as fallback
    if (colIndices.question === undefined) {
      if (headerRow.length > 1) colIndices.question = 1;
      else if (headerRow.length > 0) colIndices.question = 0;
    }

    const sheetQuestions: Omit<Question, "id">[] = [];

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const qText = String(row[colIndices.question] || "").trim();
      if (!qText) continue;

      const rawType = String(
        (colIndices.type !== undefined ? row[colIndices.type] : "") || "PG"
      ).trim().toUpperCase();

      let qType: QuestionType = "mcq";
      if (
        rawType.includes("BENAR") ||
        rawType.includes("SALAH") ||
        rawType === "TF" ||
        rawType === "BS"
      ) {
        qType = "true_false";
      } else if (rawType.includes("JODOH") || rawType.includes("MATCH")) {
        qType = "matching";
      } else if (rawType.includes("KOMPLEKS") || rawType.includes("MULTI")) {
        qType = "multi_choice";
      } else if (rawType.includes("ISIAN") || rawType.includes("SHORT")) {
        qType = "short_answer";
      } else if (rawType.includes("ESSAY") || rawType.includes("URAIAN")) {
        qType = "essay";
      }

      const rawKey = String(
        (colIndices.key !== undefined ? row[colIndices.key] : "") || ""
      ).trim();

      const points =
        parseInt(
          String(
            (colIndices.points !== undefined ? row[colIndices.points] : "") || "10"
          ),
          10
        ) || (qType === "essay" ? 20 : 10);

      const rawMediaType = String(
        (colIndices.mediaType !== undefined ? row[colIndices.mediaType] : "") || ""
      ).trim().toUpperCase();

      let mediaType: "none" | "image" | "audio" | "video" = "none";
      if (rawMediaType.includes("GAMBAR") || rawMediaType.includes("IMAGE")) mediaType = "image";
      else if (rawMediaType.includes("AUDIO") || rawMediaType.includes("SOUND")) mediaType = "audio";
      else if (rawMediaType.includes("VIDEO")) mediaType = "video";

      const mediaUrl =
        String(
          (colIndices.mediaUrl !== undefined ? row[colIndices.mediaUrl] : "") || ""
        ).trim() || undefined;

      const mediaCaption =
        String(
          (colIndices.mediaCaption !== undefined ? row[colIndices.mediaCaption] : "") || ""
        ).trim() || undefined;

      const audioPlayLimit =
        parseInt(
          String(
            (colIndices.audioLimit !== undefined ? row[colIndices.audioLimit] : "") || "0"
          ),
          10
        ) || undefined;

      // Collect options
      const optA = String(colIndices.optA !== undefined ? row[colIndices.optA] : "").trim();
      const optB = String(colIndices.optB !== undefined ? row[colIndices.optB] : "").trim();
      const optC = String(colIndices.optC !== undefined ? row[colIndices.optC] : "").trim();
      const optD = String(colIndices.optD !== undefined ? row[colIndices.optD] : "").trim();
      const optE = String(colIndices.optE !== undefined ? row[colIndices.optE] : "").trim();
      const options = [optA, optB, optC, optD, optE].filter(Boolean);

      // Parse target class
      const rawKelas = String(
        colIndices.kelas !== undefined ? row[colIndices.kelas] : ""
      ).trim();
      let tingkatKelas: TingkatKelas = "Semua Kelas";
      if (rawKelas) {
        const parsedTingkat = parseTingkatKelas(rawKelas);
        if (parsedTingkat) {
          tingkatKelas = parsedTingkat;
        }
      }

      const questionItem: Omit<Question, "id"> = {
        type: qType,
        question: qText,
        tingkatKelas,
        points,
        mediaType,
        mediaUrl,
        mediaCaption,
        audioPlayLimit,
      };

      if (qType === "mcq") {
        questionItem.options =
          options.length >= 2 ? options : ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"];
        // Extract letter B from "B", "B.", "B. HTTPS", etc.
        const letterMatch = rawKey.match(/^[\[\(]?([A-Ea-e])[\]\)]?(?:[-.\:\s]+.*|$)/);
        if (letterMatch) {
          const letter = letterMatch[1].toUpperCase();
          questionItem.correctAnswer = letter.charCodeAt(0) - 65;
        } else {
          questionItem.correctAnswer = 0;
        }
      } else if (qType === "true_false") {
        const upper = rawKey.toUpperCase();
        questionItem.correctBool =
          upper === "BENAR" || upper === "B" || upper === "TRUE" || upper === "1";
        questionItem.keyAnswer = questionItem.correctBool ? "Benar" : "Salah";
      } else if (qType === "matching") {
        const pairTokens = rawKey.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
        const matchingPairs: MatchingPair[] = [];
        pairTokens.forEach((pt) => {
          const parts = pt.split(/[:=->]+/).map((s) => s.trim());
          if (parts.length >= 2) {
            matchingPairs.push({ left: parts[0], right: parts[1] });
          }
        });
        questionItem.matchingPairs =
          matchingPairs.length >= 2
            ? matchingPairs
            : [
                { left: "Konsep 1", right: "Pasangan 1" },
                { left: "Konsep 2", right: "Pasangan 2" },
              ];
      } else if (qType === "multi_choice") {
        questionItem.options =
          options.length >= 2 ? options : ["Pilihan 1", "Pilihan 2", "Pilihan 3"];
        const letters = rawKey.split(/[,;\s]+/).map((s) => s.trim().toUpperCase());
        const correctIndices = letters
          .filter((l) => /^[A-E]$/.test(l))
          .map((l) => l.charCodeAt(0) - 65);
        questionItem.correctAnswers = correctIndices.length > 0 ? correctIndices : [0];
      } else if (qType === "short_answer" || qType === "essay") {
        questionItem.keyAnswer = rawKey;
      }

      sheetQuestions.push(questionItem);
    }

    if (sheetQuestions.length > questions.length) {
      questions = sheetQuestions;
    }
  }

  return questions;
}

export const parseExcelQuestions = parseQuestionsFromExcel;
