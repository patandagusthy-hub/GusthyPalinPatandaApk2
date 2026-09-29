import mammoth from "mammoth";
import { Question, QuestionType, MatchingPair, TingkatKelas, parseTingkatKelas } from "../types";
import { parseQuestionsFromExcel } from "./excelQuestionParser";

export interface ParsedQuestionResult {
  questions: Omit<Question, "id">[];
  rawText: string;
  errors: string[];
}

/**
 * Downloads an enhanced Word (.doc) template with complete instructions and examples for:
 * 1. Pilihan Ganda (MCQ - Single Choice)
 * 2. Pilihan Ganda Kompleks (Multi-Choice - Jawaban Lebih dari Satu)
 * 3. Benar / Salah (True / False)
 * 4. Menjodohkan (Matching Pairs)
 * 5. Isian Singkat (Short Answer)
 * 6. Essay / Uraian
 * 7. Lampiran Gambar, Audio (Listening), Video, dan Formula LaTeX ($x^2$, \frac{a}{b})
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
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background-color: #f8fafc; font-weight: bold; }
  </style>
</head>
<body>
  <h1>TEMPLATE IMPORT SOAL UJIAN (MULTI-FORMAT & MEDIA CBT)</h1>
  
  <div class="note">
    <strong>PETUNJUK UMUM PENULISAN SOAL:</strong>
    <ol>
      <li>Setiap butir soal diawali dengan nomor urut dan tanda titik (contoh: <strong>1. </strong>, <strong>2. </strong>, atau <strong>Soal 1.</strong>). Bisa menggunakan penomoran otomatis Word maupun teks biasa.</li>
      <li><strong>Pilihan Ganda (Single Choice):</strong> Tuliskan opsi A, B, C, D, E lalu kunci jawaban <strong>KUNCI: B</strong> atau <strong>KUNCI: B. Teks Pilihan</strong>.</li>
      <li><strong>Pilihan Ganda Kompleks (Multi Choice):</strong> Tuliskan kunci jawaban berupa huruf ganda dipisah koma (contoh: <strong>KUNCI: A, C</strong> atau <strong>KUNCI: B, D, E</strong>) atau tambahkan tag <strong>[KOMPLEKS]</strong>.</li>
      <li><strong>Benar / Salah (True / False):</strong> Tuliskan tag <strong>[BENAR_SALAH]</strong> atau kunci jawaban <strong>KUNCI: Benar</strong> / <strong>KUNCI: Salah</strong>.</li>
      <li><strong>Tipe Lainnya:</strong> Tuliskan tag awalan: <strong>[JODOHKAN]</strong> (dengan format PASANGAN: Kiri = Kanan), <strong>[ISIAN]</strong>, atau <strong>[ESSAY]</strong>.</li>
      <li><strong>Target Jenjang Kelas:</strong> Tambahkan tag <code>[KELAS: X]</code>, <code>[KELAS: XI]</code>, <code>[KELAS: XII]</code>, atau <code>[KELAS: Semua Kelas]</code>. Jika dikosongkan, otomatis menyesuaikan nama berkas atau Semua Kelas.</li>
      <li>Untuk rumus Matematika / Sains (LaTeX), gunakan simbol dolar: <code>$x^2 + y^2 = r^2$</code>.</li>
    </ol>
  </div>

  <h2>1. CONTOH SOAL PILIHAN GANDA (SINGLE CHOICE)</h2>
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

  <h2>2. CONTOH SOAL PILIHAN GANDA KOMPLEKS (MULTI CHOICE)</h2>
  <div class="q-block">
    <p class="q-title">2. [KOMPLEKS] Manakah di antara komponen berikut yang termasuk ke dalam perangkat keras keluaran (Output Device)?</p>
    <p class="q-opt">A. Monitor</p>
    <p class="q-opt">B. Keyboard</p>
    <p class="q-opt">C. Printer</p>
    <p class="q-opt">D. Barcode Scanner</p>
    <p class="q-opt">E. Speaker</p>
    <p class="q-key">KUNCI: A, C, E</p>
    <p class="q-points">POIN: 15</p>
  </div>

  <h2>3. CONTOH SOAL BENAR / SALAH (TRUE / FALSE)</h2>
  <div class="q-block">
    <p class="q-title">3. [BENAR_SALAH] Bilangan prima terkecil yang merupakan bilangan genap adalah 2.</p>
    <p class="q-key">KUNCI: Benar</p>
    <p class="q-points">POIN: 10</p>
  </div>

  <h2>4. CONTOH SOAL MENJODOHKAN (MATCHING)</h2>
  <div class="q-block">
    <p class="q-title">4. [JODOHKAN] Pasangkan ibu kota negara dengan nama negaranya yang tepat di bawah ini:</p>
    <p class="q-opt">PASANGAN: Jakarta = Indonesia</p>
    <p class="q-opt">PASANGAN: Tokyo = Jepang</p>
    <p class="q-opt">PASANGAN: Canberra = Australia</p>
    <p class="q-points">POIN: 20</p>
  </div>

  <h2>5. CONTOH SOAL ISIAN SINGKAT &amp; ESSAY</h2>
  <div class="q-block">
    <p class="q-title">5. [ISIAN] Proses pembuatan makanan pada tumbuhan hijau dengan bantuan cahaya matahari dan klorofil disebut proses...</p>
    <p class="q-key">KUNCI: Fotosintesis</p>
    <p class="q-points">POIN: 10</p>
  </div>

  <div class="q-block">
    <p class="q-title">6. [ESSAY] Jelaskan konsep Two-Factor Authentication (2FA) serta sebutkan minimal 2 contoh faktornya!</p>
    <p class="q-key">KUNCI: 2FA adalah verifikasi keamanan dua lapis. Contoh: Password/PIN, OTP ponsel, biometrik sidik jari.</p>
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
 * Parses and processes HTML tables into clean question blocks if the table represents
 * a question list or question grid (columnar table e.g. No, Soal, Opsi A-E, Kunci, Jenis, Poin).
 */
function processTablesInDoc(doc: Document): void {
  const tables = doc.querySelectorAll("table");
  tables.forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0) return;

    // Check if table has a header row (either row 0 or row 1)
    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(rows.length, 3); r++) {
      const cells = Array.from(rows[r].querySelectorAll("th, td")).map((c) =>
        (c.textContent || "").trim().toLowerCase()
      );

      const map: Record<string, number> = {};
      cells.forEach((text, cIdx) => {
        if (/^(?:no|nomor|no\.|#)$/i.test(text)) map.no = cIdx;
        else if (/^(?:soal|pertanyaan|stimulus|item|butir\s+soal|uraian\s+soal)$/i.test(text))
          map.soal = cIdx;
        else if (/^(?:opsi\s*a|pilihan\s*a|jawaban\s*a|a)$/i.test(text)) map.a = cIdx;
        else if (/^(?:opsi\s*b|pilihan\s*b|jawaban\s*b|b)$/i.test(text)) map.b = cIdx;
        else if (/^(?:opsi\s*c|pilihan\s*c|jawaban\s*c|c)$/i.test(text)) map.c = cIdx;
        else if (/^(?:opsi\s*d|pilihan\s*d|jawaban\s*d|d)$/i.test(text)) map.d = cIdx;
        else if (/^(?:opsi\s*e|pilihan\s*e|jawaban\s*e|e)$/i.test(text)) map.e = cIdx;
        else if (/^(?:kunci|kunci\s*jawaban|jawaban\s*benar|key|ans)$/i.test(text)) map.kunci = cIdx;
        else if (/^(?:jenis|tipe|bentuk\s*soal|model)$/i.test(text)) map.jenis = cIdx;
        else if (/^(?:bobot|poin|point|skor|score)$/i.test(text)) map.poin = cIdx;
        else if (/^(?:kelas|tingkat|tingkat\s*kelas|grade)$/i.test(text)) map.kelas = cIdx;
      });

      // Must identify at least "soal" or ("no" and at least 1 option or kunci)
      if (
        map.soal !== undefined ||
        (map.no !== undefined && (map.a !== undefined || map.kunci !== undefined))
      ) {
        headerRowIdx = r;
        colMap = map;
        break;
      }
    }

    if (headerRowIdx !== -1 && (colMap.soal !== undefined || colMap.a !== undefined)) {
      // Columnar format: convert each data row into structured question text
      const container = doc.createElement("div");
      let autoNo = 1;

      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll("th, td"));
        if (cells.length === 0) continue;

        const getCellText = (idx?: number) => {
          if (idx === undefined || !cells[idx]) return "";
          return (cells[idx].textContent || "").trim();
        };

        const rawNo = getCellText(colMap.no);
        const noVal = rawNo ? rawNo.replace(/[^\d]/g, "") || String(autoNo) : String(autoNo);
        autoNo++;

        const soalText = getCellText(colMap.soal);
        if (!soalText) continue;

        const optA = getCellText(colMap.a);
        const optB = getCellText(colMap.b);
        const optC = getCellText(colMap.c);
        const optD = getCellText(colMap.d);
        const optE = getCellText(colMap.e);
        const kunci = getCellText(colMap.kunci);
        const jenis = getCellText(colMap.jenis);
        const poin = getCellText(colMap.poin);
        const kelas = getCellText(colMap.kelas);

        let typePrefix = "";
        if (jenis) {
          const jUp = jenis.toUpperCase();
          if (jUp.includes("KOMPLEKS") || jUp.includes("PGK") || jUp.includes("MULTI")) {
            typePrefix = "[KOMPLEKS] ";
          } else if (jUp.includes("BENAR") || jUp.includes("SALAH") || jUp.includes("BS") || jUp.includes("TF")) {
            typePrefix = "[BENAR_SALAH] ";
          } else if (jUp.includes("JODOH") || jUp.includes("PASANG") || jUp.includes("MATCH")) {
            typePrefix = "[JODOHKAN] ";
          } else if (jUp.includes("ISIAN") || jUp.includes("SHORT")) {
            typePrefix = "[ISIAN] ";
          } else if (jUp.includes("ESSAY") || jUp.includes("URAIAN")) {
            typePrefix = "[ESSAY] ";
          }
        }

        let kelasPrefix = "";
        if (kelas) {
          kelasPrefix = `[KELAS: ${kelas}] `;
        }

        const qBlock = doc.createElement("p");
        let formatted = `\n\n${noVal}. ${typePrefix}${kelasPrefix}${soalText}\n`;
        if (optA) formatted += `A. ${optA}\n`;
        if (optB) formatted += `B. ${optB}\n`;
        if (optC) formatted += `C. ${optC}\n`;
        if (optD) formatted += `D. ${optD}\n`;
        if (optE) formatted += `E. ${optE}\n`;
        if (kunci) formatted += `KUNCI: ${kunci}\n`;
        if (poin) formatted += `POIN: ${poin}\n`;
        formatted += `\n`;

        qBlock.textContent = formatted;
        container.appendChild(qBlock);
      }

      table.replaceWith(container);
    } else {
      // General table: ensure cells are tab-delimited and rows are line-delimited
      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll("td, th"));
        cells.forEach((cell, idx) => {
          if (idx > 0) {
            cell.prepend(doc.createTextNode(" \t "));
          }
        });
        row.append(doc.createTextNode("\n"));
      });
    }
  });
}

/**
 * Intelligently processes lists (<ol> and <ul>) in Word documents:
 * - If the list represents QUESTIONS (numbered 1, 2, 3... or containing KUNCI / options):
 *   Prefix each question item with "1. ", "2. ", "3. ", etc.
 * - If the list represents OPTIONS (choices A, B, C, D):
 *   Prefix each choice with "A. ", "B. ", "C. ", "D. ", etc.
 * - If an item already starts with a number or letter, NEVER prepend duplicate labels!
 */
function processListsInDoc(doc: Document): void {
  const lists = Array.from(doc.querySelectorAll("ol, ul"));

  lists.forEach((list) => {
    const isOrdered = list.tagName.toLowerCase() === "ol";
    const items = Array.from(list.querySelectorAll(":scope > li"));
    if (items.length === 0) return;

    // Check if items already start with numbering or option letters
    const numberPrefixRegex = /^(?:(?:No(?:mor)?\.?|Soal(?:\s+No(?:mor)?\.?)?|Question|Item)\s*)?[\[\(]?\d+[\]\)]?[-.\):\–\s]/i;
    const letterPrefixRegex = /^(?:[\[\(]?[A-Ea-e][\]\)]?[-.\):\–\s])/;

    // Inspect content to decide if this list is a list of QUESTIONS or a list of OPTIONS
    let hasQuestionIndicators = false;
    let hasChildListsOrOptions = false;
    let totalTextLen = 0;

    items.forEach((li) => {
      const text = (li.textContent || "").trim();
      totalTextLen += text.length;

      if (
        /\b(?:KUNCI|JAWABAN|ANSWER|KEY|POIN|POINT|BOBOT|PASANGAN|\[KOMPLEKS\]|\[BENAR_SALAH\]|\[ISIAN\]|\[ESSAY\])\b/i.test(
          text
        )
      ) {
        hasQuestionIndicators = true;
      }

      // Check if item contains child list or internal options (e.g. A. B. C. D.)
      if (
        li.querySelector("ol, ul, table") ||
        /(?:^|\n)\s*[A-Ea-e][-.\):\–\s]/.test(text)
      ) {
        hasChildListsOrOptions = true;
      }
    });

    const avgTextLen = totalTextLen / items.length;
    const isTopLevel = !list.parentElement?.closest("li");

    // Decision: Is this list of QUESTIONS or OPTIONS?
    const isQuestionList =
      hasQuestionIndicators ||
      hasChildListsOrOptions ||
      (isOrdered && isTopLevel && (items.length >= 2 || avgTextLen > 60));

    if (isQuestionList) {
      // It is a list of questions: prefix each item with 1., 2., 3., 4...
      items.forEach((li, idx) => {
        const text = (li.textContent || "").trim();
        const hasNum = numberPrefixRegex.test(text);
        if (!hasNum) {
          li.prepend(doc.createTextNode(`\n${idx + 1}. `));
        }
      });
    } else {
      // It is a list of options: prefix each item with A., B., C., D...
      let optIdx = 0;
      items.forEach((li) => {
        const text = (li.textContent || "").trim();
        const hasLetter = letterPrefixRegex.test(text);
        if (!hasLetter && optIdx < 10) {
          const letter = String.fromCharCode(65 + optIdx);
          optIdx++;
          li.prepend(doc.createTextNode(`\n${letter}. `));
        }
      });
    }
  });
}

/**
 * Extracts plain text from HTML documents while preserving linebreaks between paragraphs,
 * table rows, and list items. Also extracts embedded <img> as [GAMBAR: src].
 * Intelligently handles Word tables, auto-numbered questions, and multiple choice options.
 */
export function extractTextFromHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");

      // 1. Remove Google Docs / Word bookmarks and anchors (<a id="..."></a>)
      doc.querySelectorAll("a").forEach((a) => {
        const text = a.textContent?.trim() || "";
        if (!text) {
          a.remove();
        } else {
          a.replaceWith(doc.createTextNode(text));
        }
      });

      // 2. Remove script / style tags
      doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());

      // 3. Process tables into structured question blocks or clean grid
      processTablesInDoc(doc);

      // 4. Process <ol> and <ul> lists with question vs option awareness
      processListsInDoc(doc);

      // 5. Replace <br> with newline
      doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));

      // 6. Convert <img> tags to [GAMBAR: url] so image references aren't lost
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");
        if (src) {
          img.replaceWith(doc.createTextNode(`\n[GAMBAR: ${src}]\n`));
        }
      });

      // 7. Add newlines around block elements
      doc
        .querySelectorAll(
          "p, div, li, tr, h1, h2, h3, h4, h5, h6, table, blockquote, pre, header, footer, section, article"
        )
        .forEach((el) => {
          el.prepend("\n");
          el.append("\n");
        });

      const bodyText = doc.body.textContent || "";
      if (bodyText.trim().length > 0) {
        return bodyText;
      }
    } catch (e) {
      console.warn("DOMParser HTML extraction fallback:", e);
    }
  }

  // Regex fallback:
  let processed = html;

  // Remove scripts & styles
  processed = processed.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Convert <ol> lists: check if questions or options
  processed = processed.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, listContent) => {
    const isQList =
      /\b(?:KUNCI|JAWABAN|ANSWER|KEY|POIN|POINT|BOBOT|PASANGAN)\b/i.test(listContent);
    let idx = 0;
    return listContent.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (__li, itemText) => {
      const cleanItem = itemText.replace(/<[^>]+>/g, " ").trim();
      if (/^(?:[\[\(]?(?:\d+|[A-Ea-e])[\]\)]?[-.\):\–\s])/i.test(cleanItem)) {
        return "\n" + cleanItem + "\n";
      }
      idx++;
      if (isQList) {
        return `\n${idx}. ${cleanItem}\n`;
      }
      const letter = String.fromCharCode(64 + idx);
      return `\n${letter}. ${cleanItem}\n`;
    });
  });

  // Convert <ul> lists: default to options A, B, C, D unless question indicators present
  processed = processed.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, listContent) => {
    let optIndex = 0;
    return listContent.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (__li, itemText) => {
      const cleanItem = itemText.replace(/<[^>]+>/g, " ").trim();
      if (/^(?:[\[\(]?[A-Ea-e][\]\)]?[-.\):\–\s])/i.test(cleanItem)) {
        return "\n" + cleanItem + "\n";
      }
      const letter = String.fromCharCode(65 + optIndex);
      optIndex++;
      return `\n${letter}. ${cleanItem}\n`;
    });
  });

  return processed
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "\n[GAMBAR: $1]\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|table|blockquote|pre)>/gi, "\n")
    .replace(/<(p|div|li|tr|h[1-6]|table|blockquote|pre)[^>]*>/gi, "\n")
    .replace(/<td[^>]*>/gi, " \t ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
}

/**
 * Extracts plain text from RTF (Rich Text Format) documents.
 */
export function extractTextFromRtf(rtf: string): string {
  return rtf
    .replace(/\\par[d]?\b/gi, "\n")
    .replace(/\\line\b/gi, "\n")
    .replace(/\\tab\b/gi, "\t")
    .replace(/\\cell\b/gi, " \t ")
    .replace(/\\row\b/gi, "\n")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, code) => {
      let num = parseInt(code, 10);
      if (num < 0) num += 65536;
      return String.fromCharCode(num);
    })
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "");
}

/**
 * Extracts text from binary Word 97-2003 (.doc) files (OLE2 / CFBF format).
 * Scans UTF-16LE and 8-bit text streams for readable question content.
 */
export function extractTextFromBinaryDoc(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Strategy 1: Look for UTF-16LE text sequences
  const utf16Runs: string[] = [];
  let currentRun = "";

  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (
      (code >= 32 && code <= 126) ||
      code === 10 ||
      code === 13 ||
      code === 9 ||
      (code >= 160 && code <= 383)
    ) {
      currentRun += String.fromCharCode(code === 13 ? 10 : code);
    } else {
      if (currentRun.trim().length >= 4) {
        utf16Runs.push(currentRun.trim());
      }
      currentRun = "";
    }
  }
  if (currentRun.trim().length >= 4) {
    utf16Runs.push(currentRun.trim());
  }

  // Strategy 2: Look for 8-bit text sequences (CP1252 / ASCII)
  const asciiRuns: string[] = [];
  let currentAscii = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (
      (b >= 32 && b <= 126) ||
      b === 10 ||
      b === 13 ||
      b === 9 ||
      (b >= 160 && b <= 255)
    ) {
      currentAscii += String.fromCharCode(b === 13 ? 10 : b);
    } else {
      if (currentAscii.trim().length >= 4) {
        asciiRuns.push(currentAscii.trim());
      }
      currentAscii = "";
    }
  }
  if (currentAscii.trim().length >= 4) {
    asciiRuns.push(currentAscii.trim());
  }

  const scoreRun = (runs: string[]) => {
    const joined = runs.join("\n");
    let score = 0;
    if (/\b(?:kunci|jawaban|soal|pilihan|poin|bobot)\b/i.test(joined)) score += 50;
    if (/\b[1-9]\d*[\.\)]/i.test(joined)) score += 30;
    if (/\b[A-Ea-e][\.\)]/i.test(joined)) score += 20;
    return { score, text: joined };
  };

  const utf16Score = scoreRun(utf16Runs);
  const asciiScore = scoreRun(asciiRuns);

  if (utf16Score.score > asciiScore.score && utf16Score.score > 0) {
    return utf16Score.text;
  }
  return asciiScore.text || utf16Score.text;
}

/**
 * Extracts text from an ArrayBuffer of a .docx file using mammoth.
 * Uses convertToHtml + extractTextFromHtml to preserve structure and options
 * WITHOUT escaping markdown characters or turning lettered lists into ordered numbers.
 */
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  let htmlText = "";
  try {
    const htmlResult = await (mammoth as any).convertToHtml({ arrayBuffer });
    if (htmlResult && htmlResult.value && htmlResult.value.trim().length > 0) {
      htmlText = extractTextFromHtml(htmlResult.value);
    }
  } catch (e) {
    console.warn("Mammoth convertToHtml fallback:", e);
  }

  // Also extract raw text as baseline
  let rawText = "";
  try {
    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    rawText = rawResult.value || "";
  } catch (e) {
    console.warn("Mammoth extractRawText fallback:", e);
  }

  if (htmlText && htmlText.trim().length > 20) {
    return htmlText;
  }
  return rawText;
}

/**
 * Checks if a line contains multiple options horizontally, e.g.:
 * "A. HTTP   B. HTTPS   C. FTP   D. Telnet"
 * or "A. Opsi Satu\tB. Opsi Dua"
 */
function splitMultipleOptionsFromLine(
  line: string
): { letter: string; text: string }[] | null {
  const optPattern =
    /(?:^|\s{2,}|\t|\s+(?=(?:[\[\(]?[A-Ea-e][\]\)]?[-.\):\–\\])))(?:[\[\(]?([A-Ea-e])[\]\)]?\s*\\?[-.\):\–]\s*)/g;
  const matches = [...line.matchAll(optPattern)];

  if (matches.length >= 2) {
    const results: { letter: string; text: string }[] = [];
    for (let i = 0; i < matches.length; i++) {
      const letter = (matches[i][1] || "").toUpperCase();
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
      const text = line.substring(start, end).trim();
      if (letter && text) {
        results.push({ letter, text });
      }
    }
    if (results.length >= 2) {
      return results;
    }
  }

  return null;
}

/**
 * Parses raw text extracted from a Word (.doc / .docx), Excel, or text document into structured Questions.
 * Robust against markdown escapes (\. \( \)), bold markers (__KUNCI__ / **KUNCI**), and anchor tags.
 * Accurately separates Single Choice (mcq), Multi Choice (multi_choice), True/False, Matching, Short Answer, and Essay.
 */
export function parseQuestionsFromText(
  rawText: string,
  inheritedGrade?: TingkatKelas
): ParsedQuestionResult {
  const errors: string[] = [];
  const questions: Omit<Question, "id">[] = [];

  // Normalize line breaks and spaces
  let normalized = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ") // Non-breaking space
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width spaces
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "");

  // Strip Google Docs / Word bookmarks and anchors: <a id="..."> </a>
  normalized = normalized.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1");
  normalized = normalized.replace(/<[^>]+>/g, " ");

  // Strip markdown backslash escapes: \(EVs\) -> (EVs), \. -> ., \_ -> _
  normalized = normalized.replace(/\\([\(\)\[\]\.\-\:\_\*\\\/])/g, "$1");

  // Clean markdown bold/italics markers globally (__KUNCI: C, D__ -> KUNCI: C, D)
  normalized = normalized.replace(/__([^\n_]+)__/g, "$1");
  normalized = normalized.replace(/\*\*([^\n*]+)\*\*/g, "$1");

  // Detect document-wide grade level if specified in headers (e.g. KELAS: XII or TINGKAT: XII)
  let docWideGrade: TingkatKelas = inheritedGrade || "Semua Kelas";
  const docGradeMatch = normalized.match(
    /\b(?:KELAS|TINGKAT|GRADE)\s*[:=\-–]?\s*(XII|XI|X|SEMUA\s*KELAS)\b/i
  );
  if (docGradeMatch) {
    const parsedG = parseTingkatKelas(docGradeMatch[1].trim());
    if (parsedG) docWideGrade = parsedG;
  }

  const rawLines = normalized.split("\n");
  const lines: string[] = [];

  for (const rawL of rawLines) {
    let l = rawL.trim();
    if (!l) continue;

    // Strip leading bullet markers (• ◦ ⁃)
    l = l.replace(/^[\u2022\u2023\u25E6\u2043\u2219\*\+\-]\s*/, "");

    // Strip markdown markers around lines
    l = l
      .replace(/^_{1,2}([^\n_]+)_{1,2}$/, "$1")
      .replace(/^\*{1,2}([^\n*]+)\*{1,2}$/, "$1");

    // Remove markdown table pipe borders if entire line is just a border e.g. |---|---|
    if (/^\|[\s\-\:\.\*]+\|$/.test(l)) continue;

    // If line starts and ends with table pipe, strip leading/trailing pipes
    if (l.startsWith("|") && l.endsWith("|")) {
      l = l.replace(/^\|\s*/, "").replace(/\s*\|$/, "").trim();
    }

    lines.push(l);
  }

  interface RawBlock {
    header: string;
    lines: string[];
    explicitNumber?: number;
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;
  let preQuestionLines: string[] = [];

  // Question start regex:
  // 1. "1. ", "1) ", "(1) ", "[1] ", "1: ", "1 - "
  // 2. "Soal 1. ", "Soal No. 1: ", "No. 1. ", "No 1. ", "Nomor 1: "
  // 3. Standalone number on a line: "1", "2", "3" (when between 1 and 250)
  const explicitPrefixRegex =
    /^(?:(?:No(?:mor)?\.?|Soal(?:\s+No(?:mor)?\.?)?|Question|Item)\s*)[\[\(]?(\d{1,3})[\]\)]?\s*\\?[\.\)\:\–\-]?\s*(.*)$/i;
  const standardNumRegex =
    /^[\[\(]?(\d{1,3})[\]\)]\s*\\?[\.\)\:\–\-]\s*(.*)$/;
  const dotNumRegex =
    /^(\d{1,3})\s*[\.\)\:\–\-]\s*(.*)$/;
  const standaloneNumRegex =
    /^[\[\(]?(\d{1,3})[\]\)]?$/;

  // Unit and number false positives (e.g. 2024, 100%, 50 km/h, 1st, 2nd, 3D, 4WD)
  const isUnitOrMeasurement = (str: string) =>
    /^\d+(?:%|st|nd|rd|th|kg|g|mg|m|cm|mm|km|v|w|kw|kwh|mah|hz|khz|mhz|s|sec|min|jam|hari|tahun|buah|butir|unit|x)\b/i.test(
      str
    ) || /^\d{4}\b/.test(str);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Ignore known template headers / guidelines
    const upper = line.toUpperCase();
    if (
      upper.includes("TEMPLATE IMPORT SOAL") ||
      upper.includes("PETUNJUK UMUM") ||
      upper.includes("PETUNJUK PENGISIAN") ||
      upper.includes("PETUNJUK PENYISIPAN MEDIA") ||
      upper.startsWith("CONTOH SOAL") ||
      upper.startsWith("BAGIAN A:") ||
      upper.startsWith("BAGIAN B:") ||
      upper.startsWith("PILIHLAH SALAH SATU") ||
      upper.startsWith("PILIHLAH JAWABAN") ||
      upper.startsWith("KERJAKAN SOAL")
    ) {
      continue;
    }

    // Do NOT mistake an option, key, point, or grade as a question start
    if (
      /^(?:KUNCI|JAWABAN|ANSWER|KEY|POIN|POINT|BOBOT|PASANGAN|PAIR|KELAS|TINGKAT)\s*[:=\-–]/i.test(
        line
      )
    ) {
      if (currentBlock) {
        currentBlock.lines.push(line);
      }
      continue;
    }

    // Check if line starts an explicit question
    let matchNum: number | null = null;
    let matchHeader: string = "";

    const expMatch = line.match(explicitPrefixRegex);
    if (expMatch && expMatch[1] && !isUnitOrMeasurement(line)) {
      matchNum = parseInt(expMatch[1], 10);
      matchHeader = expMatch[2] ? expMatch[2].trim() : "";
    } else {
      const stdMatch = line.match(standardNumRegex) || line.match(dotNumRegex);
      if (stdMatch && stdMatch[1] && !isUnitOrMeasurement(line)) {
        matchNum = parseInt(stdMatch[1], 10);
        matchHeader = stdMatch[2] ? stdMatch[2].trim() : "";
      } else if (standaloneNumRegex.test(line) && !isUnitOrMeasurement(line)) {
        const numVal = parseInt(line.replace(/[^\d]/g, ""), 10);
        // Only accept standalone number if it's within plausible exam index
        const nextExpected = currentBlock ? (currentBlock.explicitNumber || 0) + 1 : 1;
        if (numVal >= 1 && numVal <= 250 && Math.abs(numVal - nextExpected) <= 3) {
          matchNum = numVal;
          matchHeader = "";
        }
      }
    }

    if (matchNum !== null) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        header: matchHeader,
        lines: [],
        explicitNumber: matchNum,
      };
    } else if (currentBlock) {
      currentBlock.lines.push(line);
    } else {
      // Lines before Question 1 (reading passage, stimulus text)
      preQuestionLines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Fallback: split by empty paragraphs if no numbered blocks found
  if (blocks.length === 0) {
    const rawParagraphs = normalized.split(/\n\s*\n+/);
    for (const para of rawParagraphs) {
      const pLines = para
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (pLines.length >= 2) {
        const hasOptions = pLines.some((pl) =>
          /^(?:[\[\(]?[A-Ea-e][\]\)]?[-.\):\–\\]|KUNCI|JAWABAN)/i.test(pl)
        );
        if (hasOptions || pLines.length >= 3) {
          blocks.push({
            header: pLines[0],
            lines: pLines.slice(1),
          });
        }
      }
    }
  }

  // Single Option regex: matches "A. ", "a. ", "A) ", "(A) ", "[A] ", "A: ", "A - ", "A\. ", "A.Teks"
  const singleOptionRegex =
    /^(?:[\[\(]([A-Ea-e])[\]\)]\s*[-.\:\–\\]?|([A-Ea-e])\s*\\?[-.\):\–])\s*(.+)$/;

  // Key regex: matches "KUNCI: B", "KUNCI JAWABAN: C, D", "JAWABAN: B", "JAWABAN BENAR: B", "KEY: C, D"
  const keyRegex =
    /^(?:KUNCI(?:\s+JAWABAN)?|JAWABAN(?:\s+BENAR)?|ANSWER|KEY|CORRECT(?:\s+ANSWER)?)\s*[:=\-–]\s*(.+)$/i;

  // Points regex: matches "POIN: 10", "POINT: 10", "BOBOT: 10", "SKOR: 10", "POINTS: 10", "SCORE: 10"
  const pointsRegex =
    /^(?:POIN|POINT|BOBOT|SKOR|SCORE|POINTS|NILAI)\s*[:=\-–]\s*(\d+)$/i;

  // Matching pair regex: matches "PASANGAN: A = B" or "PAIR: A = B"
  const pairRegex =
    /^(?:PASANGAN|PAIR|JODOHKAN)\s*[:=\-–]\s*(.+?)\s*(?:=|->|:)\s*(.+)$/i;

  // Media tags regex
  const imageTagRegex = /\[(?:GAMBAR|IMAGE)\s*[:=]\s*(.+?)\]/i;
  const audioTagRegex = /\[AUDIO\s*[:=]\s*(.+?)\]/i;
  const videoTagRegex = /\[VIDEO\s*[:=]\s*(.+?)\]/i;
  const captionTagRegex = /\[(?:CAPTION|KETERANGAN)\s*[:=]\s*(.+?)\]/i;
  const audioLimitTagRegex = /\[(?:PUTAR|LIMIT|PLAY_LIMIT)\s*[:=]\s*(\d+)\]/i;

  // Type tags regex
  const tfTagRegex = /\[(?:BENAR_SALAH|TRUE_FALSE|TF|BS)\]/i;
  const matchingTagRegex = /\[(?:JODOHKAN|MATCHING|PASANGKAN)\]/i;
  const multiTagRegex = /\[(?:KOMPLEKS|MULTI|MULTIPLE|PILIHAN_GANDA_KOMPLEKS|PGK)\]/i;
  const shortTagRegex = /\[(?:ISIAN|SHORT|ISIAN_SINGKAT)\]/i;
  const essayTagRegex = /\[(?:ESSAY|URAIAN)\]/i;

  // Grade level tags regex
  const gradeTagRegex = /\[(?:KELAS|TINGKAT|TARGET_KELAS|GRADE)\s*[:=]\s*(.+?)\]/i;
  const gradeLineRegex = /^(?:KELAS|TINGKAT|TARGET\s+KELAS|GRADE)\s*[:=]\s*(.+)$/i;

  blocks.forEach((block, index) => {
    let questionText = block.header;
    const blockLines = block.lines;

    // Attach pre-question reading passage / stimulus to Question 1 if available
    if (index === 0 && preQuestionLines.length > 0) {
      const stimulus = preQuestionLines.join("\n").trim();
      if (stimulus) {
        questionText = questionText ? `${stimulus}\n\n${questionText}` : stimulus;
      }
    }

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

    // Check grade in question header (e.g. [KELAS: X])
    let tingkatKelas: TingkatKelas = docWideGrade;
    const gradeInHeader = questionText.match(gradeTagRegex);
    if (gradeInHeader) {
      const parsed = parseTingkatKelas(gradeInHeader[1].trim());
      if (parsed) tingkatKelas = parsed;
      questionText = questionText.replace(gradeTagRegex, "").trim();
    }

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
    for (let li = 0; li < blockLines.length; li++) {
      let line = blockLines[li].trim();
      if (!line) continue;

      // Clean bold/italics inside line (e.g. __KUNCI: C, D__)
      line = line
        .replace(/^_{1,2}([^\n_]+)_{1,2}$/, "$1")
        .replace(/^\*{1,2}([^\n*]+)\*{1,2}$/, "$1");

      // Check grade tags in lines (e.g. KELAS: XI or [KELAS: XII])
      const gradeMatch = line.match(gradeLineRegex) || line.match(gradeTagRegex);
      if (gradeMatch) {
        const parsed = parseTingkatKelas(gradeMatch[1].trim());
        if (parsed) tingkatKelas = parsed;
        continue;
      }

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

      // Check answer key
      const keyMatch = line.match(keyRegex);
      if (keyMatch) {
        const keyVal = keyMatch[1].trim();
        const upper = keyVal.toUpperCase();

        // 1. True / False (Benar / Salah) Detection
        if (
          qType === "true_false" ||
          /\b(?:BENAR|TRUE|BETUL)\b/i.test(keyVal) ||
          /\b(?:SALAH|FALSE|PALSU)\b/i.test(keyVal) ||
          ((upper === "B" || upper === "S") && options.length === 0)
        ) {
          qType = "true_false";
          const isTrue =
            /\b(?:BENAR|TRUE|BETUL)\b/i.test(keyVal) ||
            upper === "B" ||
            upper.startsWith("B (") ||
            upper.startsWith("B.");
          correctBool = isTrue;
          keyAnswer = isTrue ? "Benar" : "Salah";
          continue;
        }

        // 2. Extract letter choices from key (e.g. "C", "A, C", "A, B, D", "A dan C", "AC")
        // Check if multiple letters are specified
        const foundLetters = [...keyVal.matchAll(/\b([A-Ea-e])\b/g)].map((m) =>
          m[1].toUpperCase()
        );

        // Check condensed form e.g. "AC" or "ABD"
        const condensedLetters = keyVal.replace(/[^A-Ea-e]/g, "").toUpperCase();

        const multiLetters =
          foundLetters.length >= 2
            ? foundLetters
            : condensedLetters.length >= 2 && condensedLetters.length <= 5
            ? condensedLetters.split("")
            : [];

        if (multiLetters.length >= 2 || qType === "multi_choice") {
          const lettersToUse =
            multiLetters.length >= 2
              ? multiLetters
              : foundLetters.length >= 1
              ? foundLetters
              : condensedLetters.length >= 1
              ? condensedLetters.split("")
              : [];

          if (lettersToUse.length > 0) {
            qType = "multi_choice";
            const uniqueLetters = [...new Set(lettersToUse)];
            correctAnswers = uniqueLetters
              .map((l) => l.charCodeAt(0) - 65)
              .sort((a, b) => a - b);
            keyAnswer = uniqueLetters.join(", ");
            continue;
          }
        }

        // 3. Single Choice MCQ Key (e.g. "C", "C.", "C. Battery pack", "(C)", "[C]")
        const singleLetterMatch = keyVal.match(/^[\[\(]?([A-Ea-e])[\]\)]?(?:[-.\:\–\s]+.*|$)/);
        if (singleLetterMatch && qType !== "essay" && qType !== "short_answer") {
          const letter = singleLetterMatch[1].toUpperCase();
          correctAnswer = letter.charCodeAt(0) - 65;
          keyAnswer = keyVal;
          continue;
        }

        // 4. Default: Short answer / Essay key
        keyAnswer = keyVal;
        if (options.length === 0 && qType === "mcq") {
          qType = "short_answer";
        }
        continue;
      }

      // Check multi-options on a single line (e.g. "A. Option 1   B. Option 2   C. Option 3")
      const multiOptSplits = splitMultipleOptionsFromLine(line);
      if (
        multiOptSplits &&
        qType !== "essay" &&
        qType !== "matching" &&
        qType !== "short_answer"
      ) {
        for (const item of multiOptSplits) {
          options.push(item.text);
        }
        continue;
      }

      // Check single option A-E
      const optMatch = line.match(singleOptionRegex);
      if (
        optMatch &&
        qType !== "essay" &&
        qType !== "matching" &&
        qType !== "short_answer"
      ) {
        options.push(optMatch[3].trim());
        continue;
      }

      // If we haven't encountered any options or keys yet, append to question stimulus / text
      if (options.length === 0 && matchingPairs.length === 0 && !keyAnswer) {
        if (!questionText) {
          questionText = line;
        } else {
          questionText += "\n" + line;
        }
      } else if (options.length > 0 && !keyAnswer) {
        // Option continuation across multiple lines
        options[options.length - 1] += " " + line;
      }
    }

    if (!questionText.trim()) {
      errors.push(`Soal nomor ${index + 1} tidak memiliki teks pertanyaan.`);
      return;
    }

    // Auto-detect True/False if options are just "Benar" and "Salah" (or "True" and "False")
    if (
      options.length === 2 &&
      qType === "mcq" &&
      /^(?:benar|true)$/i.test(options[0].trim()) &&
      /^(?:salah|false)$/i.test(options[1].trim())
    ) {
      qType = "true_false";
      correctBool = correctAnswer === 0;
      keyAnswer = correctBool ? "Benar" : "Salah";
    }

    // Default points
    const finalPoints =
      points ||
      (qType === "essay"
        ? 20
        : qType === "matching"
        ? 20
        : qType === "multi_choice"
        ? 15
        : 10);

    const qItem: Omit<Question, "id"> = {
      type: qType,
      question: questionText.trim(),
      tingkatKelas,
      points: finalPoints,
      mediaType,
      mediaUrl,
      mediaCaption,
      audioPlayLimit,
    };

    if (qType === "mcq") {
      qItem.options =
        options.length >= 2 ? options : ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"];
      qItem.correctAnswer = correctAnswer !== undefined ? correctAnswer : 0;
    } else if (qType === "multi_choice") {
      qItem.options =
        options.length >= 2 ? options : ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"];
      qItem.correctAnswers =
        correctAnswers && correctAnswers.length > 0 ? correctAnswers : [0];
    } else if (qType === "true_false") {
      qItem.correctBool = correctBool !== undefined ? correctBool : true;
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
 * Parses any document file (Word .docx/.doc, Excel .xlsx/.xls/.csv, RTF, HTML, TXT)
 * into structured questions with high fidelity and automatic format detection.
 */
export async function parseWordFile(file: File): Promise<ParsedQuestionResult> {
  const fileName = file.name.toLowerCase();

  // Detect grade level from file name (e.g. "XII TKA.docx" -> "XII")
  let defaultGrade: TingkatKelas = "Semua Kelas";
  if (/\bxii\b/i.test(fileName)) {
    defaultGrade = "XII";
  } else if (/\bxi\b/i.test(fileName)) {
    defaultGrade = "XI";
  } else if (/\bx\b/i.test(fileName) && !/\bxi/i.test(fileName)) {
    defaultGrade = "X";
  }

  // 1. If it is an Excel / Spreadsheet file (.xlsx, .xls, .csv), parse via Excel parser
  if (
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".csv")
  ) {
    try {
      const buffer = await file.arrayBuffer();
      const excelQuestions = parseQuestionsFromExcel(buffer);
      // Apply default grade if not set
      if (defaultGrade !== "Semua Kelas") {
        excelQuestions.forEach((q) => {
          if (!q.tingkatKelas || q.tingkatKelas === "Semua Kelas") {
            q.tingkatKelas = defaultGrade;
          }
        });
      }
      return {
        questions: excelQuestions,
        rawText: `Diimpor dari file Excel: ${file.name} (${excelQuestions.length} butir soal)`,
        errors:
          excelQuestions.length === 0
            ? ["Tidak ada butir soal valid yang ditemukan dalam file spreadsheet."]
            : [],
      };
    } catch (err: any) {
      console.warn("Excel parse in Word parser fallback:", err);
    }
  }

  // 2. Read array buffer to inspect magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check if it is a ZIP archive / modern DOCX (starts with PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  if (isZip || fileName.endsWith(".docx")) {
    try {
      const text = await extractTextFromDocx(arrayBuffer);
      if (text && text.trim().length > 0) {
        const parsed = parseQuestionsFromText(text, defaultGrade);
        if (parsed.questions.length > 0) {
          return parsed;
        }
      }
      // If HTML extraction yielded 0 questions, try mammoth raw text fallback
      const rawRes = await mammoth.extractRawText({ arrayBuffer });
      if (rawRes.value && rawRes.value.trim().length > 0) {
        return parseQuestionsFromText(rawRes.value, defaultGrade);
      }
    } catch (docxErr: any) {
      console.warn("Mammoth extraction error, trying HTML/text fallback:", docxErr);
    }
  }

  // Check if it is binary Word 97-2003 .doc (starts with 0xD0, 0xCF, 0x11, 0xE0)
  const isBinaryDoc =
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;

  if (isBinaryDoc) {
    const extracted = extractTextFromBinaryDoc(arrayBuffer);
    if (extracted && extracted.trim().length > 0) {
      return parseQuestionsFromText(extracted, defaultGrade);
    }
  }

  // Decode as text to check for RTF, HTML, or plain text
  let rawText = "";
  try {
    rawText = new TextDecoder("utf-8").decode(arrayBuffer);
  } catch {
    rawText = await file.text();
  }

  // Check if it is an RTF document
  if (rawText.trim().startsWith("{\\rtf")) {
    const rtfText = extractTextFromRtf(rawText);
    return parseQuestionsFromText(rtfText, defaultGrade);
  }

  // Check if it is an HTML-based document (.doc or .htm)
  if (
    rawText.includes("<html") ||
    rawText.includes("<body") ||
    rawText.includes("<p ") ||
    rawText.includes("<div")
  ) {
    const htmlText = extractTextFromHtml(rawText);
    return parseQuestionsFromText(htmlText, defaultGrade);
  }

  // Fallback as plain text
  return parseQuestionsFromText(rawText, defaultGrade);
}
