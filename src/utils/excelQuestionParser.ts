import * as XLSX from "xlsx";
import { Question, QuestionType, MatchingPair } from "../types";

export function downloadExcelQuestionTemplate(): void {
  const rows = [
    {
      "No": 1,
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

export function parseQuestionsFromExcel(buffer: ArrayBuffer): Omit<Question, "id">[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(ws);

  const questions: Omit<Question, "id">[] = [];

  rawData.forEach((row) => {
    const qText = String(row["Pertanyaan"] || row["Soal"] || row["question"] || "").trim();
    if (!qText) return;

    const rawType = String(row["Tipe Soal"] || row["Tipe"] || row["type"] || "PG").trim().toUpperCase();
    let qType: QuestionType = "mcq";

    if (rawType.includes("BENAR") || rawType.includes("SALAH") || rawType === "TF" || rawType === "BS") {
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

    const rawKey = String(row["Kunci Jawaban"] || row["Kunci"] || row["key"] || "").trim();
    const points = parseInt(String(row["Poin"] || row["points"] || "10"), 10) || 10;

    const rawMediaType = String(row["Tipe Media"] || row["mediaType"] || "").trim().toUpperCase();
    let mediaType: "none" | "image" | "audio" | "video" = "none";
    if (rawMediaType.includes("GAMBAR") || rawMediaType.includes("IMAGE")) mediaType = "image";
    else if (rawMediaType.includes("AUDIO") || rawMediaType.includes("SOUND")) mediaType = "audio";
    else if (rawMediaType.includes("VIDEO")) mediaType = "video";

    const mediaUrl = String(row["URL Media"] || row["mediaUrl"] || "").trim() || undefined;
    const mediaCaption = String(row["Keterangan Media"] || row["mediaCaption"] || "").trim() || undefined;
    const audioPlayLimit = parseInt(String(row["Batas Putar Audio"] || "0"), 10) || undefined;

    // Collect options
    const optA = String(row["Opsi A"] || "").trim();
    const optB = String(row["Opsi B"] || "").trim();
    const optC = String(row["Opsi C"] || "").trim();
    const optD = String(row["Opsi D"] || "").trim();
    const optE = String(row["Opsi E"] || "").trim();
    const options = [optA, optB, optC, optD, optE].filter(Boolean);

    const questionItem: Omit<Question, "id"> = {
      type: qType,
      question: qText,
      points,
      mediaType,
      mediaUrl,
      mediaCaption,
      audioPlayLimit,
    };

    if (qType === "mcq") {
      questionItem.options = options.length >= 2 ? options : ["A", "B", "C", "D"];
      const keyLetter = rawKey.toUpperCase();
      questionItem.correctAnswer = /^[A-E]$/.test(keyLetter) ? keyLetter.charCodeAt(0) - 65 : 0;
    } else if (qType === "true_false") {
      const upper = rawKey.toUpperCase();
      questionItem.correctBool = upper === "BENAR" || upper === "B" || upper === "TRUE" || upper === "1";
      questionItem.keyAnswer = questionItem.correctBool ? "Benar" : "Salah";
    } else if (qType === "matching") {
      // Pairs separated by ; or newlines: e.g. "Jakarta = Indonesia; Tokyo = Jepang"
      const pairTokens = rawKey.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
      const matchingPairs: MatchingPair[] = [];
      pairTokens.forEach((pt) => {
        const parts = pt.split(/[:=->]+/).map((s) => s.trim());
        if (parts.length >= 2) {
          matchingPairs.push({ left: parts[0], right: parts[1] });
        }
      });
      questionItem.matchingPairs = matchingPairs.length >= 2 ? matchingPairs : [
        { left: "Konsep 1", right: "Pasangan 1" },
        { left: "Konsep 2", right: "Pasangan 2" },
      ];
    } else if (qType === "multi_choice") {
      questionItem.options = options.length >= 2 ? options : ["Opsi 1", "Opsi 2", "Opsi 3"];
      const letters = rawKey.split(/[,;\s]+/).map((s) => s.trim().toUpperCase());
      const correctIndices = letters
        .filter((l) => /^[A-E]$/.test(l))
        .map((l) => l.charCodeAt(0) - 65);
      questionItem.correctAnswers = correctIndices.length > 0 ? correctIndices : [0];
    } else if (qType === "short_answer" || qType === "essay") {
      questionItem.keyAnswer = rawKey;
    }

    questions.push(questionItem);
  });

  return questions;
}

export const parseExcelQuestions = parseQuestionsFromExcel;
