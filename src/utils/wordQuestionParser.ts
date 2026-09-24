import mammoth from "mammoth";
import { Question, QuestionType, MatchingPair } from "../types";

export interface ParsedQuestionResult {
  questions: Omit<Question, "id">[];
  rawText: string;
  errors: string[];
}

/**
 * Downloads an enhanced Word (.doc) template with complete instructions and examples for:
 * 1. Pilihan Ganda (MCQ)
 * 2. Benar / Salah (True / False)
 * 3. Menjodohkan (Matching Pairs)
 * 4. Pilihan Ganda Kompleks (Multi-Choice)
 * 5. Isian Singkat (Short Answer)
 * 6. Essay / Uraian
 * 7. Lampiran Gambar, Audio (Listening), Video, dan Formula LaTeX/MathML ($x^2$, \frac{a}{b})
 */
export function downloadWordTemplate(): void {
  const content = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Template Soal Ujian Lengkap - CBT AI Studio</title>
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #0f172a; margin: 30px; }
    h1 { font-size: 16pt; color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-bottom: 12px; }
    h2 { font-size: 13pt; color: #1e40af; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .note { background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; margin-bottom: 18px; font-size: 10pt; }
    .media-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; margin-bottom: 18px; font-size: 10pt; }
    .q-block { margin-bottom: 20px; padding: 10px; border-bottom: 1px dashed #cbd5e1; }
    .q-title { font-weight: bold; }
    .q-opt { margin-left: 20px; margin-top: 2px; margin-bottom: 2px; }
    .q-key { font-weight: bold; color: #047857; margin-top: 6px; }
    .q-points { font-weight: bold; color: #b45309; }
    code { font-family: 'Consolas', monospace; background-color: #f1f5f9; padding: 2px 5px; border-radius: 4px; color: #0f172a; }
  </style>
</head>
<body>
  <h1>TEMPLATE IMPORT SOAL UJIAN (MULTI-FORMAT & MEDIA CBT)</h1>
  
  <div class="note">
    <strong>PETUNJUK UMUM PENULISAN SOAL:</strong>
    <ol>
      <li>Setiap butir soal diawali dengan nomor urut dan tanda titik (contoh: <strong>1. </strong>, <strong>2. </strong>).</li>
      <li>Tuliskan tipe soal dengan tag awalan jika bukan PG biasa: <strong>[BENAR_SALAH]</strong>, <strong>[JODOHKAN]</strong>, <strong>[KOMPLEKS]</strong>, <strong>[ISIAN]</strong>, atau <strong>[ESSAY]</strong>.</li>
      <li>Untuk rumus Matematika / Sains (LaTeX), gunakan simbol dolar: <code>$x^2 + y^2 = r^2$</code> atau display <code>$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$</code>.</li>
      <li>Simpan berkas dalam format <strong>.docx</strong> atau <strong>.doc</strong> lalu unggah di Bank Soal.</li>
    </ol>
  </div>

  <div class="media-box">
    <strong>PETUNJUK PENYISIPAN MEDIA (GAMBAR, AUDIO LISTENING, VIDEO):</strong>
    <ul>
      <li><strong>Gambar:</strong> Tambahkan baris <code>[GAMBAR: https://url-gambar.com/foto.jpg]</code> atau <code>[CAPTION: Keterangan gambar]</code> di bawah nomor soal.</li>
      <li><strong>Audio Listening:</strong> Tambahkan baris <code>[AUDIO: https://url-audio.com/listening1.mp3]</code>. (Bisa atur batas putar dengan <code>[PUTAR: 2]</code>).</li>
      <li><strong>Video:</strong> Tambahkan baris <code>[VIDEO: https://url-video.com/simulasi.mp4]</code> atau link YouTube.</li>
    </ul>
  </div>

  <h2>1. CONTOH SOAL PILIHAN GANDA (PG)</h2>
  <div class="q-block">
    <p class="q-title">1. Manakah protokol jaringan yang bertugas menyediakan komunikasi terenkripsi dan aman saat mengakses situs web?</p>
    <p class="q-opt">A. HTTP</p>
    <p class="q-opt">B. HTTPS</p>
    <p class="q-opt">C. FTP</p>
    <p class="q-opt">D. Telnet</p>
    <p class="q-opt">E. SMTP</p>
    <p class="q-key">KUNCI: B</p>
    <p class="q-points">POIN: 10</p>
  </div>

  <div class="q-block">
    <p class="q-title">2. Hitung akar penyelesaian dari persamaan kuadrat $x^2 - 5x + 6 = 0$:</p>
    <p class="q-opt">A. $x = 1$ atau $x = 6$</p>
    <p class="q-opt">B. $x = 2$ atau $x = 3$</p>
    <p class="q-opt">C. $x = -2$ atau $x = -3$</p>
    <p class="q-opt">D. $x = 5$ atau $x = 6$</p>
    <p class="q-key">KUNCI: B</p>
    <p class="q-points">POIN: 10</p>
  </div>

  <h2>2. CONTOH SOAL BENAR / SALAH (TRUE / FALSE)</h2>
  <div class="q-block">
    <p class="q-title">3. [BENAR_SALAH] Bilangan prima terkecil yang merupakan bilangan genap adalah 2.</p>
    <p class="q-key">KUNCI: BENAR</p>
    <p class="q-points">POIN: 10</p>
  </div>

  <div class="q-block">
    <p class="q-title">4. [BENAR_SALAH] Kecepatan cahaya di ruang hampa adalah sekitar 300 km per jam.</p>
    <p class="q-key">KUNCI: SALAH</p>
    <p class="q-points">POIN: 10</p>
  </div>

  <h2>3. CONTOH SOAL MENJODOHKAN (MEMASANGKAN PERNYATAAN)</h2>
  <div class="q-block">
    <p class="q-title">5. [JODOHKAN] Pasangkan ibu kota negara dengan nama negaranya yang tepat di bawah ini:</p>
    <p class="q-opt">PASANGAN: Jakarta = Indonesia</p>
    <p class="q-opt">PASANGAN: Tokyo = Jepang</p>
    <p class="q-opt">PASANGAN: Seoul = Korea Selatan</p>
    <p class="q-opt">PASANGAN: Canberra = Australia</p>
    <p class="q-points">POIN: 20</p>
  </div>

  <h2>4. CONTOH SOAL PILIHAN GANDA KOMPLEKS (LEBIH DARI SATU JAWABAN BENAR)</h2>
  <div class="q-block">
    <p class="q-title">6. [KOMPLEKS] Manakah di antara komponen berikut yang termasuk ke dalam perangkat keras keluaran (Output Device)?</p>
    <p class="q-opt">A. Monitor</p>
    <p class="q-opt">B. Keyboard</p>
    <p class="q-opt">C. Printer</p>
    <p class="q-opt">D. Barcode Scanner</p>
    <p class="q-opt">E. Speaker</p>
    <p class="q-key">KUNCI: A, C, E</p>
    <p class="q-points">POIN: 15</p>
  </div>

  <h2>5. CONTOH SOAL DENGAN AUDIO LISTENING</h2>
  <div class="q-block">
    <p class="q-title">7. [AUDIO: https://actions.google.com/sounds/v1/speech/announcement_chime.ogg]</p>
    <p class="q-opt">[PUTAR: 2]</p>
    <p class="q-title">Berdasarkan percakapan audio yang Anda dengar, topik utama yang sedang dibahas adalah...</p>
    <p class="q-opt">A. Rencana perjalanan liburan akhir pekan</p>
    <p class="q-opt">B. Jadwal ujian tengah semester</p>
    <p class="q-opt">C. Pengumuman lomba kebersihan kelas</p>
    <p class="q-opt">D. Penggantian guru pembimbing</p>
    <p class="q-key">KUNCI: A</p>
    <p class="q-points">POIN: 15</p>
  </div>

  <h2>6. CONTOH SOAL ISIAN SINGKAT</h2>
  <div class="q-block">
    <p class="q-title">8. [ISIAN] Proses pembuatan makanan pada tumbuhan hijau dengan bantuan cahaya matahari dan klorofil disebut proses...</p>
    <p class="q-key">KUNCI: Fotosintesis</p>
    <p class="q-points">POIN: 10</p>
  </div>

  <h2>7. CONTOH SOAL ESSAY / URAIAN</h2>
  <div class="q-block">
    <p class="q-title">9. [ESSAY] Jelaskan konsep Two-Factor Authentication (2FA) serta sebutkan minimal 2 contoh faktor autentikasi yang umum digunakan!</p>
    <p class="q-key">KUNCI: 2FA adalah metode keamanan ganda yang mewajibkan dua bukti verifikasi sebelum memberi akses. Contoh faktor: Something you know (password/PIN), Something you have (OTP ponsel/hardware key), Something you are (biometrik sidik jari/wajah).</p>
    <p class="q-points">POIN: 20</p>
  </div>
</body>
</html>
  `.trim();

  const blob = new Blob(["\ufeff", content], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Template_Soal_Ujian_Lengkap.doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses raw text extracted from a Word (.doc / .docx) or text document into structured Questions.
 * Supports MCQ, True/False, Matching, Multi-Choice, Short Answer, Essay, and Media tags.
 */
export function parseQuestionsFromText(rawText: string): ParsedQuestionResult {
  const errors: string[] = [];
  const questions: Omit<Question, "id">[] = [];

  // Normalize line breaks and remove non-printable control characters
  const normalized = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "");

  const lines = normalized.split("\n").map((l) => l.trim());

  interface RawBlock {
    header: string;
    lines: string[];
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;

  const questionStartRegex = /^(?:\[?(\d+)[\.\)\]]|\bSoal\s+(\d+)[\.:]?)\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Ignore template headers / guidelines
    if (
      line.toUpperCase().includes("TEMPLATE IMPORT SOAL") ||
      line.toUpperCase().includes("PETUNJUK UMUM") ||
      line.toUpperCase().includes("PETUNJUK PENGISIAN") ||
      line.toUpperCase().includes("PETUNJUK PENYISIPAN MEDIA") ||
      line.toUpperCase().startsWith("1. CONTOH SOAL") ||
      line.toUpperCase().startsWith("2. CONTOH SOAL") ||
      line.toUpperCase().startsWith("3. CONTOH SOAL") ||
      line.toUpperCase().startsWith("4. CONTOH SOAL") ||
      line.toUpperCase().startsWith("5. CONTOH SOAL") ||
      line.toUpperCase().startsWith("6. CONTOH SOAL") ||
      line.toUpperCase().startsWith("7. CONTOH SOAL") ||
      line.toUpperCase().startsWith("BAGIAN A:") ||
      line.toUpperCase().startsWith("BAGIAN B:")
    ) {
      continue;
    }

    const match = line.match(questionStartRegex);
    if (match) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        header: match[3] ? match[3].trim() : "",
        lines: [],
      };
    } else if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Fallback: split by empty paragraphs
  if (blocks.length === 0) {
    const rawParagraphs = normalized.split(/\n\s*\n+/);
    for (const para of rawParagraphs) {
      const pLines = para.split("\n").map((l) => l.trim()).filter(Boolean);
      if (pLines.length >= 2) {
        blocks.push({
          header: pLines[0],
          lines: pLines.slice(1),
        });
      }
    }
  }

  // Regex helpers
  const optionRegex = /^([A-Ea-e])[\.\)]\s*(.+)$/;
  const keyRegex = /^(?:KUNCI(?:\s+JAWABAN)?|JAWABAN|ANSWER|KEY)\s*[:=]\s*(.+)$/i;
  const pointsRegex = /^(?:POIN|POINT|BOBOT|SKOR|SCORE|POINTS)\s*[:=]\s*(\d+)$/i;
  const pairRegex = /^(?:PASANGAN|PAIR|JODOHKAN)\s*[:=]\s*(.+?)\s*(?:=|->|:)\s*(.+)$/i;

  // Media tags regex
  const imageTagRegex = /\[(?:GAMBAR|IMAGE)\s*[:=]\s*(.+?)\]/i;
  const audioTagRegex = /\[AUDIO\s*[:=]\s*(.+?)\]/i;
  const videoTagRegex = /\[VIDEO\s*[:=]\s*(.+?)\]/i;
  const captionTagRegex = /\[(?:CAPTION|KETERANGAN)\s*[:=]\s*(.+?)\]/i;
  const audioLimitTagRegex = /\[(?:PUTAR|LIMIT|PLAY_LIMIT)\s*[:=]\s*(\d+)\]/i;

  // Type tags
  const tfTagRegex = /\[(?:BENAR_SALAH|TRUE_FALSE|TF|BS)\]/i;
  const matchingTagRegex = /\[(?:JODOHKAN|MATCHING|PASANGKAN)\]/i;
  const multiTagRegex = /\[(?:KOMPLEKS|MULTI|MULTIPLE|PILIHAN_GANDA_KOMPLEKS)\]/i;
  const shortTagRegex = /\[(?:ISIAN|SHORT|ISIAN_SINGKAT)\]/i;
  const essayTagRegex = /\[(?:ESSAY|URAIAN)\]/i;

  blocks.forEach((block, index) => {
    let questionText = block.header;
    const blockLines = block.lines;

    let qType: QuestionType = "mcq";
    if (tfTagRegex.test(questionText)) qType = "true_false";
    else if (matchingTagRegex.test(questionText)) qType = "matching";
    else if (multiTagRegex.test(questionText)) qType = "multi_choice";
    else if (shortTagRegex.test(questionText)) qType = "short_answer";
    else if (essayTagRegex.test(questionText)) qType = "essay";

    // Clean tags from question header
    questionText = questionText
      .replace(tfTagRegex, "")
      .replace(matchingTagRegex, "")
      .replace(multiTagRegex, "")
      .replace(shortTagRegex, "")
      .replace(essayTagRegex, "")
      .trim();

    const options: string[] = [];
    const matchingPairs: MatchingPair[] = [];
    let correctAnswer: number | undefined = undefined;
    let correctAnswers: number[] | undefined = undefined;
    let correctBool: boolean | undefined = undefined;
    let keyAnswer: string | undefined = undefined;
    let points: number | undefined = undefined;

    let mediaType: "none" | "image" | "audio" | "video" = "none";
    let mediaUrl: string | undefined = undefined;
    let mediaCaption: string | undefined = undefined;
    let audioPlayLimit: number | undefined = undefined;

    // Check media in question header
    const imgInHeader = questionText.match(imageTagRegex);
    if (imgInHeader) {
      mediaType = "image";
      mediaUrl = imgInHeader[1].trim();
      questionText = questionText.replace(imageTagRegex, "").trim();
    }
    const audioInHeader = questionText.match(audioTagRegex);
    if (audioInHeader) {
      mediaType = "audio";
      mediaUrl = audioInHeader[1].trim();
      questionText = questionText.replace(audioTagRegex, "").trim();
    }
    const videoInHeader = questionText.match(videoTagRegex);
    if (videoInHeader) {
      mediaType = "video";
      mediaUrl = videoInHeader[1].trim();
      questionText = questionText.replace(videoTagRegex, "").trim();
    }

    // Process line by line
    for (const line of blockLines) {
      // Check type tags in lines
      if (tfTagRegex.test(line)) {
        qType = "true_false";
        continue;
      }
      if (matchingTagRegex.test(line)) {
        qType = "matching";
        continue;
      }
      if (multiTagRegex.test(line)) {
        qType = "multi_choice";
        continue;
      }
      if (shortTagRegex.test(line)) {
        qType = "short_answer";
        continue;
      }
      if (essayTagRegex.test(line)) {
        qType = "essay";
        continue;
      }

      // Check media in line
      const imgMatch = line.match(imageTagRegex);
      if (imgMatch) {
        mediaType = "image";
        mediaUrl = imgMatch[1].trim();
        continue;
      }
      const audioMatch = line.match(audioTagRegex);
      if (audioMatch) {
        mediaType = "audio";
        mediaUrl = audioMatch[1].trim();
        continue;
      }
      const videoMatch = line.match(videoTagRegex);
      if (videoMatch) {
        mediaType = "video";
        mediaUrl = videoMatch[1].trim();
        continue;
      }
      const capMatch = line.match(captionTagRegex);
      if (capMatch) {
        mediaCaption = capMatch[1].trim();
        continue;
      }
      const limitMatch = line.match(audioLimitTagRegex);
      if (limitMatch) {
        audioPlayLimit = parseInt(limitMatch[1], 10);
        continue;
      }

      // Check points
      const pointsMatch = line.match(pointsRegex);
      if (pointsMatch) {
        points = parseInt(pointsMatch[1], 10);
        continue;
      }

      // Check matching pair
      const pairMatch = line.match(pairRegex);
      if (pairMatch) {
        qType = "matching";
        matchingPairs.push({
          left: pairMatch[1].trim(),
          right: pairMatch[2].trim(),
        });
        continue;
      }

      // Check key answer
      const keyMatch = line.match(keyRegex);
      if (keyMatch) {
        const keyVal = keyMatch[1].trim();

        if (qType === "true_false") {
          const upper = keyVal.toUpperCase();
          correctBool = upper === "BENAR" || upper === "B" || upper === "TRUE" || upper === "T";
          keyAnswer = correctBool ? "Benar" : "Salah";
        } else if (qType === "multi_choice" || keyVal.includes(",")) {
          qType = "multi_choice";
          const letters = keyVal.split(/[,;\s]+/).map((s) => s.trim().toUpperCase());
          correctAnswers = letters
            .filter((l) => /^[A-E]$/.test(l))
            .map((l) => l.charCodeAt(0) - 65);
        } else if (/^[A-Ea-e]$/i.test(keyVal)) {
          const letter = keyVal.toUpperCase();
          correctAnswer = letter.charCodeAt(0) - 65;
        } else {
          keyAnswer = keyVal;
          if (qType === "mcq") {
            // Check if user specified short answer without tag
            qType = "short_answer";
          }
        }
        continue;
      }

      // Check option A-E
      const optMatch = line.match(optionRegex);
      if (optMatch && qType !== "essay" && qType !== "matching" && qType !== "short_answer") {
        options.push(optMatch[2].trim());
        continue;
      }

      // Append line to question text
      if (options.length === 0 && matchingPairs.length === 0 && !keyAnswer) {
        if (!questionText) {
          questionText = line;
        } else {
          questionText += " " + line;
        }
      }
    }

    if (!questionText.trim()) {
      errors.push(`Soal nomor ${index + 1} tidak memiliki teks pertanyaan.`);
      return;
    }

    // Default points
    const finalPoints = points || (qType === "essay" ? 20 : qType === "matching" ? 20 : 10);

    const qItem: Omit<Question, "id"> = {
      type: qType,
      question: questionText.trim(),
      points: finalPoints,
      mediaType,
      mediaUrl,
      mediaCaption,
      audioPlayLimit,
    };

    if (qType === "mcq") {
      qItem.options = options.length >= 2 ? options : ["A", "B", "C", "D"];
      qItem.correctAnswer = correctAnswer ?? 0;
    } else if (qType === "multi_choice") {
      qItem.options = options.length >= 2 ? options : ["Opsi 1", "Opsi 2", "Opsi 3"];
      qItem.correctAnswers = correctAnswers && correctAnswers.length > 0 ? correctAnswers : [0];
    } else if (qType === "true_false") {
      qItem.correctBool = correctBool ?? true;
      qItem.keyAnswer = qItem.correctBool ? "Benar" : "Salah";
    } else if (qType === "matching") {
      qItem.matchingPairs =
        matchingPairs.length > 0
          ? matchingPairs
          : [
              { left: "Item 1", right: "Pasangan 1" },
              { left: "Item 2", right: "Pasangan 2" },
            ];
    } else if (qType === "short_answer" || qType === "essay") {
      qItem.keyAnswer = keyAnswer || "";
    }

    questions.push(qItem);
  });

  return {
    questions,
    rawText: normalized,
    errors,
  };
}

/**
 * Extracts raw text from an ArrayBuffer of a .docx file using mammoth.
 */
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Parses a Word (.doc / .docx) or text File object directly into questions.
 */
export async function parseWordFile(file: File): Promise<ParsedQuestionResult> {
  const fileName = file.name.toLowerCase();
  let text = "";

  if (fileName.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    text = await extractTextFromDocx(arrayBuffer);
  } else {
    // For .doc, .txt, or HTML-based doc files
    text = await file.text();
    if (text.includes("<html") || text.includes("<body")) {
      const doc = new DOMParser().parseFromString(text, "text/html");
      text = doc.body.textContent || "";
    }
  }

  return parseQuestionsFromText(text);
}
