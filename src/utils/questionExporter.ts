import * as XLSX from "xlsx";
import { Question, ExamConfig } from "../types";

export interface QuestionExportOptions {
  includeAnswerKey?: boolean;
  includeRubrics?: boolean;
  includePoints?: boolean;
  includeHeader?: boolean;
  includeExplanation?: boolean;
}

/**
 * Format answer key readable string for any question type
 */
export function formatQuestionKey(q: Question): string {
  switch (q.type) {
    case "mcq":
      return q.correctAnswer !== undefined ? String.fromCharCode(65 + q.correctAnswer) : "-";
    case "true_false":
      return q.correctBool === true ? "BENAR (True)" : "SALAH (False)";
    case "matching":
      if (!q.matchingPairs || q.matchingPairs.length === 0) return "-";
      return q.matchingPairs.map((p, i) => `${i + 1}. [${p.left}] -> [${p.right}]`).join("; ");
    case "multi_choice":
      if (!q.correctAnswers || q.correctAnswers.length === 0) return "-";
      return q.correctAnswers.map((idx) => String.fromCharCode(65 + idx)).join(", ");
    case "short_answer":
      return q.keyAnswer || "-";
    case "essay":
      return q.keyAnswer || "(Rubrik Penilaian Esai Guru)";
    default:
      return "-";
  }
}

/**
 * Exports question bank to Microsoft Word (.doc) formatted file.
 */
export function exportQuestionsToWord(
  questions: Question[],
  config: ExamConfig,
  options: QuestionExportOptions = {}
): void {
  const {
    includeAnswerKey = true,
    includeRubrics = true,
    includePoints = true,
    includeHeader = true,
    includeExplanation = true,
  } = options;

  const schoolName = config.institutionName || "DINAS PENDIDIKAN DAN KEBUDAYAAN";
  const title = config.title || "Naskah Soal Ujian Berbasis Komputer";
  const subject = config.subject || "Semua Mata Pelajaran";
  const gradeLevel = config.gradeLevel || "Umum";
  const duration = config.durationMinutes || 90;
  const academicYear = config.academicYear || "Tahun Ajaran 2026/2027";

  let questionsHtml = "";

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    let typeName = "Pilihan Ganda";
    if (q.type === "true_false") typeName = "Benar / Salah";
    else if (q.type === "matching") typeName = "Menjodohkan";
    else if (q.type === "multi_choice") typeName = "Pilihan Ganda Kompleks";
    else if (q.type === "short_answer") typeName = "Isian Singkat";
    else if (q.type === "essay") typeName = "Uraian / Essay";

    let mediaHtml = "";
    if (q.mediaType && q.mediaType !== "none" && q.mediaUrl) {
      if (q.mediaType === "image") {
        mediaHtml = `<div style="margin: 8px 0; text-align: center;"><img src="${q.mediaUrl}" alt="Media Soal" style="max-width: 450px; max-height: 250px; border: 1px solid #ccc; border-radius: 4px;" /><br/><span style="font-size: 9pt; color: #555; font-style: italic;">Gambar Soal No. ${qNum}${q.mediaCaption ? ": " + q.mediaCaption : ""}</span></div>`;
      } else {
        mediaHtml = `<div style="margin: 6px 0; padding: 6px 10px; background-color: #f1f5f9; border-left: 3px solid #3b82f6; font-size: 9.5pt;"><strong>[Lampiran Media ${q.mediaType.toUpperCase()}]:</strong> ${q.mediaUrl}${q.mediaCaption ? " (" + q.mediaCaption + ")" : ""}</div>`;
      }
    }

    let answerAreaHtml = "";

    if (q.type === "mcq" && q.options) {
      answerAreaHtml = `<table style="width: 100%; margin-top: 6px; font-size: 10.5pt; border-collapse: collapse;">`;
      q.options.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        answerAreaHtml += `<tr><td style="width: 25px; vertical-align: top; font-weight: bold;">${letter}.</td><td style="vertical-align: top; padding-bottom: 4px;">${opt}</td></tr>`;
      });
      answerAreaHtml += `</table>`;
    } else if (q.type === "true_false") {
      answerAreaHtml = `<div style="margin: 6px 0 6px 20px; font-size: 10.5pt;">Pernyataan di atas bernilai: <strong>[ &nbsp; ] BENAR &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] SALAH</strong></div>`;
    } else if (q.type === "matching" && q.matchingPairs) {
      answerAreaHtml = `<table style="width: 95%; margin: 8px auto; font-size: 10pt; border-collapse: collapse; border: 1px solid #94a3b8;">
        <tr style="background-color: #f8fafc;"><th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 48%;">Pernyataan / Kolom A</th><th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 48%;">Pasangan / Kolom B</th></tr>`;
      q.matchingPairs.forEach((pair, pIdx) => {
        answerAreaHtml += `<tr><td style="border: 1px solid #cbd5e1; padding: 6px;">${pIdx + 1}. ${pair.left}</td><td style="border: 1px solid #cbd5e1; padding: 6px;">[ ... ] ${pair.right}</td></tr>`;
      });
      answerAreaHtml += `</table>`;
    } else if (q.type === "multi_choice" && q.options) {
      answerAreaHtml = `<div style="margin: 6px 0; font-size: 10pt; font-style: italic; color: #475569;">(Pilihlah satu atau lebih jawaban yang tepat):</div>
      <table style="width: 100%; margin-top: 4px; font-size: 10.5pt; border-collapse: collapse;">`;
      q.options.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        answerAreaHtml += `<tr><td style="width: 30px; vertical-align: top;"><span style="display:inline-block; width:14px; height:14px; border:1px solid #333; margin-right:4px;"></span> ${letter}.</td><td style="vertical-align: top; padding-bottom: 4px;">${opt}</td></tr>`;
      });
      answerAreaHtml += `</table>`;
    } else if (q.type === "short_answer") {
      answerAreaHtml = `<div style="margin: 8px 0 12px 0; font-size: 10pt; border-bottom: 1px dotted #64748b; height: 24px;"><span style="color: #64748b;">Jawaban Singkat: _________________________________________________________________</span></div>`;
    } else if (q.type === "essay") {
      answerAreaHtml = `<div style="margin: 10px 0; border: 1px dashed #cbd5e1; padding: 12px; height: 90px; background-color: #fafafa; border-radius: 4px; color: #94a3b8; font-size: 9.5pt; font-style: italic;">[Lembar Ruang Jawaban Uraian Siswa]</div>`;
    }

    questionsHtml += `
      <div style="margin-bottom: 18px; page-break-inside: avoid; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; font-size: 9pt; color: #64748b; margin-bottom: 4px;">
          <span><strong>Nomor ${qNum}</strong> &bull; Tipe: ${typeName}${includePoints ? ` &bull; Bobot: ${q.points} Poin` : ""}</span>
          ${q.lastModifiedBy ? `<span style="font-size: 8pt; color: #94a3b8;">Rev: ${q.lastModifiedBy}</span>` : ""}
        </div>
        <div style="font-size: 11pt; font-weight: 500; color: #0f172a; line-height: 1.5;">${q.question}</div>
        ${mediaHtml}
        ${answerAreaHtml}
      </div>
    `;
  });

  // Appendix: Answer Key & Rubric Table (if enabled)
  let keyAppendixHtml = "";
  if (includeAnswerKey) {
    keyAppendixHtml = `
      <div style="page-break-before: always; margin-top: 30px; border-top: 2px solid #1e3a8a; padding-top: 20px;">
        <h2 style="font-size: 14pt; color: #1e3a8a; text-align: center; margin-bottom: 4px;">LAMPIRAN KUNCI JAWABAN &amp; RUBRIK PENILAIAN</h2>
        <p style="text-align: center; font-size: 10pt; color: #64748b; margin-bottom: 16px;">Dokumen Rahasia - Khusus Guru / Penguji &amp; Arsip Soal</p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
          <thead>
            <tr style="background-color: #1e3a8a; color: #ffffff;">
              <th style="border: 1px solid #1e3a8a; padding: 6px; width: 40px; text-align: center;">No</th>
              <th style="border: 1px solid #1e3a8a; padding: 6px; width: 100px;">Tipe Soal</th>
              <th style="border: 1px solid #1e3a8a; padding: 6px;">Kunci Jawaban / Model Rubrik</th>
              <th style="border: 1px solid #1e3a8a; padding: 6px; width: 60px; text-align: center;">Bobot</th>
            </tr>
          </thead>
          <tbody>
    `;

    questions.forEach((q, idx) => {
      const keyStr = formatQuestionKey(q);
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      keyAppendixHtml += `
        <tr style="background-color: ${bg};">
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-transform: capitalize;">${q.type.replace("_", " ")}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px;">
            <div><strong>Kunci:</strong> ${keyStr}</div>
            ${includeExplanation && q.explanation ? `<div style="font-size: 8.5pt; color: #475569; margin-top: 2px;"><em>Pembahasan:</em> ${q.explanation}</div>` : ""}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; color: #b45309;">${q.points}</td>
        </tr>
      `;
    });

    keyAppendixHtml += `
          </tbody>
        </table>
      </div>
    `;
  }

  const docContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${title} - ${subject}</title>
      <style>
        body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.4; margin: 30px; }
        .kop-header { text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 18px; }
        .kop-inst { font-size: 14pt; font-weight: bold; letter-spacing: 0.5px; margin: 0; }
        .kop-sub { font-size: 11pt; font-weight: bold; margin: 2px 0; }
        .kop-meta { font-size: 9pt; color: #334155; margin: 0; }
        .exam-info-table { width: 100%; font-size: 10pt; margin-bottom: 16px; border-collapse: collapse; }
        .exam-info-table td { padding: 3px 6px; }
      </style>
    </head>
    <body>
      ${
        includeHeader
          ? `
        <div class="kop-header">
          <h1 class="kop-inst">${schoolName.toUpperCase()}</h1>
          <h2 class="kop-sub">${title.toUpperCase()}</h2>
          <p class="kop-meta">${academicYear} &bull; SISTEM UJIAN BERBASIS KOMPUTER (CBT)</p>
        </div>

        <table class="exam-info-table">
          <tr>
            <td style="width: 18%;"><strong>Mata Pelajaran</strong></td>
            <td style="width: 32%;">: ${subject}</td>
            <td style="width: 18%;"><strong>Hari / Tanggal</strong></td>
            <td style="width: 32%;">: .......................................</td>
          </tr>
          <tr>
            <td><strong>Tingkat / Rombel</strong></td>
            <td>: ${gradeLevel}</td>
            <td><strong>Waktu Ujian</strong></td>
            <td>: ${duration} Menit</td>
          </tr>
          <tr>
            <td><strong>Nama Peserta</strong></td>
            <td>: .......................................</td>
            <td><strong>Nomor / NISN</strong></td>
            <td>: .......................................</td>
          </tr>
        </table>
        <hr style="border: 0; border-top: 1px solid #94a3b8; margin-bottom: 18px;" />
      `
          : ""
      }

      <div class="questions-container">
        ${questionsHtml}
      </div>

      ${keyAppendixHtml}
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + docContent], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cleanSubj = subject.replace(/[^a-zA-Z0-9]/g, "_");
  a.href = url;
  a.download = `Bank_Soal_${cleanSubj}_${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports question bank to Microsoft Excel (.xlsx) spreadsheet.
 */
export function exportQuestionsToExcel(questions: Question[], config: ExamConfig): void {
  const rows = questions.map((q, idx) => {
    const qNum = idx + 1;
    let typeName = "PG";
    if (q.type === "true_false") typeName = "BENAR_SALAH";
    else if (q.type === "matching") typeName = "MENJODOHKAN";
    else if (q.type === "multi_choice") typeName = "PG_KOMPLEKS";
    else if (q.type === "short_answer") typeName = "ISIAN";
    else if (q.type === "essay") typeName = "ESSAY";

    const optA = q.options?.[0] || "";
    const optB = q.options?.[1] || "";
    const optC = q.options?.[2] || "";
    const optD = q.options?.[3] || "";
    const optE = q.options?.[4] || "";

    const key = formatQuestionKey(q);

    return {
      "No": qNum,
      "ID Soal": q.id,
      "Tipe Soal": typeName,
      "Pertanyaan": q.question,
      "Opsi A": optA,
      "Opsi B": optB,
      "Opsi C": optC,
      "Opsi D": optD,
      "Opsi E": optE,
      "Kunci Jawaban": key,
      "Poin": q.points,
      "Tipe Media": q.mediaType || "NONE",
      "URL Media": q.mediaUrl || "",
      "Batas Putar Audio": q.audioPlayLimit || "",
      "Keterangan Media": q.mediaCaption || "",
      "Pembahasan": q.explanation || "",
      "Terakhir Diubah Oleh": q.lastModifiedBy || "Sistem Awal",
      "Waktu Terakhir Diubah": q.lastModifiedAt ? new Date(q.lastModifiedAt).toLocaleString("id-ID") : "-",
      "Total Revisi": q.revisionHistory?.length || 0,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  ws["!cols"] = [
    { wch: 5 },  // No
    { wch: 18 }, // ID Soal
    { wch: 15 }, // Tipe Soal
    { wch: 45 }, // Pertanyaan
    { wch: 20 }, // Opsi A
    { wch: 20 }, // Opsi B
    { wch: 20 }, // Opsi C
    { wch: 20 }, // Opsi D
    { wch: 20 }, // Opsi E
    { wch: 25 }, // Kunci
    { wch: 8 },  // Poin
    { wch: 12 }, // Tipe Media
    { wch: 25 }, // URL Media
    { wch: 15 }, // Audio Limit
    { wch: 20 }, // Ket Media
    { wch: 25 }, // Pembahasan
    { wch: 20 }, // Mod By
    { wch: 20 }, // Mod At
    { wch: 12 }, // Total Rev
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bank Soal Ujian");

  const cleanSubj = (config.subject || "Ujian").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, `Bank_Soal_${cleanSubj}_${Date.now()}.xlsx`);
}

/**
 * Exports question bank to JSON backup archive file.
 */
export function exportQuestionsToJson(questions: Question[], config: ExamConfig): void {
  const exportPayload = {
    appName: "GusthyPalinPatandaExam",
    version: "2.5",
    exportedAt: new Date().toISOString(),
    examConfig: {
      id: config.id,
      title: config.title,
      subject: config.subject,
      gradeLevel: config.gradeLevel,
      durationMinutes: config.durationMinutes,
      institutionName: config.institutionName,
      academicYear: config.academicYear,
    },
    totalQuestions: questions.length,
    questions,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cleanSubj = (config.subject || "Ujian").replace(/[^a-zA-Z0-9]/g, "_");
  a.href = url;
  a.download = `Backup_Bank_Soal_${cleanSubj}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print-optimized window for physical printing or saving as PDF directly from the browser.
 */
export function printQuestionsAsPdf(
  questions: Question[],
  config: ExamConfig,
  options: QuestionExportOptions = {}
): void {
  const {
    includeAnswerKey = true,
    includePoints = true,
    includeHeader = true,
    includeExplanation = true,
  } = options;

  const schoolName = config.institutionName || "DINAS PENDIDIKAN DAN KEBUDAYAAN";
  const title = config.title || "Naskah Soal Ujian Berbasis Komputer";
  const subject = config.subject || "Semua Mata Pelajaran";
  const gradeLevel = config.gradeLevel || "Umum";
  const duration = config.durationMinutes || 90;
  const academicYear = config.academicYear || "Tahun Ajaran 2026/2027";

  let questionsHtml = "";

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    let typeName = "Pilihan Ganda";
    if (q.type === "true_false") typeName = "Benar / Salah";
    else if (q.type === "matching") typeName = "Menjodohkan";
    else if (q.type === "multi_choice") typeName = "Pilihan Ganda Kompleks";
    else if (q.type === "short_answer") typeName = "Isian Singkat";
    else if (q.type === "essay") typeName = "Uraian / Essay";

    let mediaHtml = "";
    if (q.mediaType && q.mediaType !== "none" && q.mediaUrl) {
      if (q.mediaType === "image") {
        mediaHtml = `<div class="media-container"><img src="${q.mediaUrl}" alt="Media Soal" /><div class="media-caption">Gambar No. ${qNum}${q.mediaCaption ? ": " + q.mediaCaption : ""}</div></div>`;
      } else {
        mediaHtml = `<div class="media-badge"><strong>[Lampiran ${q.mediaType.toUpperCase()}]:</strong> ${q.mediaUrl}</div>`;
      }
    }

    let answerAreaHtml = "";

    if (q.type === "mcq" && q.options) {
      answerAreaHtml = `<div class="options-grid">`;
      q.options.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        answerAreaHtml += `<div class="opt-item"><span class="opt-label">${letter}.</span><span>${opt}</span></div>`;
      });
      answerAreaHtml += `</div>`;
    } else if (q.type === "true_false") {
      answerAreaHtml = `<div class="tf-area">Pernyataan di atas: &nbsp;&nbsp;<strong>[ &nbsp; ] BENAR</strong> &nbsp;&nbsp;&nbsp;&nbsp; <strong>[ &nbsp; ] SALAH</strong></div>`;
    } else if (q.type === "matching" && q.matchingPairs) {
      answerAreaHtml = `<table class="match-table"><thead><tr><th>Pernyataan / Kolom A</th><th>Jawaban Pasangan / Kolom B</th></tr></thead><tbody>`;
      q.matchingPairs.forEach((pair, pIdx) => {
        answerAreaHtml += `<tr><td>${pIdx + 1}. ${pair.left}</td><td>[ ... ] ${pair.right}</td></tr>`;
      });
      answerAreaHtml += `</tbody></table>`;
    } else if (q.type === "multi_choice" && q.options) {
      answerAreaHtml = `<div class="multi-notice">Pilihlah satu atau lebih pilihan yang benar:</div><div class="options-grid">`;
      q.options.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        answerAreaHtml += `<div class="opt-item"><span class="checkbox-box"></span><span class="opt-label">${letter}.</span><span>${opt}</span></div>`;
      });
      answerAreaHtml += `</div>`;
    } else if (q.type === "short_answer") {
      answerAreaHtml = `<div class="short-line">Jawaban Singkat: __________________________________________________</div>`;
    } else if (q.type === "essay") {
      answerAreaHtml = `<div class="essay-box">Lembar Ruang Jawaban Uraian Siswa</div>`;
    }

    questionsHtml += `
      <div class="question-block">
        <div class="q-header">
          <span class="q-num">Soal No. ${qNum}</span>
          <span class="q-type">${typeName}</span>
          ${includePoints ? `<span class="q-points">${q.points} Poin</span>` : ""}
        </div>
        <div class="q-text">${q.question}</div>
        ${mediaHtml}
        ${answerAreaHtml}
      </div>
    `;
  });

  // Appendix: Kunci Jawaban
  let keyAppendixHtml = "";
  if (includeAnswerKey) {
    keyAppendixHtml = `
      <div class="page-break"></div>
      <div class="appendix-section">
        <h2 class="appendix-title">KUNCI JAWABAN &amp; RUBRIK PENILAIAN RESMI</h2>
        <p class="appendix-sub">Arsip Pengajar / Petugas Pengawas &bull; Dokumen Rahasia</p>
        <table class="key-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">No</th>
              <th style="width: 120px;">Tipe Soal</th>
              <th>Kunci Jawaban / Model Rubrik</th>
              <th style="width: 60px; text-align: center;">Bobot</th>
            </tr>
          </thead>
          <tbody>
    `;

    questions.forEach((q, idx) => {
      const keyStr = formatQuestionKey(q);
      keyAppendixHtml += `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td>${q.type.replace("_", " ")}</td>
          <td>
            <div><strong>Kunci:</strong> ${keyStr}</div>
            ${includeExplanation && q.explanation ? `<div class="q-exp"><em>Pembahasan:</em> ${q.explanation}</div>` : ""}
          </td>
          <td style="text-align: center; font-weight: bold; color: #b45309;">${q.points}</td>
        </tr>
      `;
    });

    keyAppendixHtml += `
          </tbody>
        </table>
      </div>
    `;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup diblokir oleh browser. Izinkan pop-up untuk mencetak atau menyimpan sebagai PDF.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title} - ${subject} (Cetak PDF)</title>
      <style>
        @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #111827; background: #fff; margin: 0; padding: 10px; }
        .kop-container { text-align: center; border-bottom: 2.5px double #000; padding-bottom: 8px; margin-bottom: 12px; }
        .kop-inst { font-size: 13.5pt; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
        .kop-title { font-size: 11pt; font-weight: 700; margin: 2px 0; }
        .kop-meta { font-size: 8.5pt; color: #4b5563; margin: 0; }
        .meta-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 12px; }
        .meta-table td { padding: 2px 4px; }
        .question-block { margin-bottom: 14px; page-break-inside: avoid; border-bottom: 1px dashed #e5e7eb; padding-bottom: 10px; }
        .q-header { display: flex; align-items: center; gap: 8px; font-size: 8.5pt; color: #4b5563; margin-bottom: 4px; }
        .q-num { font-weight: 700; color: #111827; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
        .q-type { font-weight: 600; text-transform: uppercase; }
        .q-points { font-weight: 700; color: #b45309; }
        .q-text { font-size: 10.5pt; font-weight: 500; line-height: 1.5; margin-bottom: 6px; }
        .media-container { text-align: center; margin: 8px 0; }
        .media-container img { max-width: 400px; max-height: 220px; border: 1px solid #d1d5db; border-radius: 4px; }
        .media-caption { font-size: 8pt; color: #6b7280; font-style: italic; margin-top: 2px; }
        .media-badge { font-size: 8.5pt; background: #eff6ff; padding: 4px 8px; border-left: 3px solid #3b82f6; margin: 6px 0; }
        .options-grid { margin-left: 10px; margin-top: 4px; }
        .opt-item { display: flex; align-items: flex-start; gap: 6px; font-size: 10pt; margin-bottom: 3px; }
        .opt-label { font-weight: 700; min-width: 18px; }
        .checkbox-box { display: inline-block; width: 12px; height: 12px; border: 1px solid #374151; margin-top: 3px; }
        .tf-area { margin: 6px 0 6px 12px; font-size: 10pt; }
        .match-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6px 0; }
        .match-table th, .match-table td { border: 1px solid #cbd5e1; padding: 5px 8px; }
        .match-table th { background: #f8fafc; font-weight: 700; text-align: left; }
        .multi-notice { font-size: 8.5pt; font-style: italic; color: #6b7280; margin-bottom: 4px; }
        .short-line { margin: 8px 0; font-size: 9.5pt; border-bottom: 1px dotted #9ca3af; height: 22px; color: #6b7280; }
        .essay-box { margin: 8px 0; border: 1px dashed #cbd5e1; height: 75px; background: #fafafa; border-radius: 4px; padding: 6px 10px; color: #9ca3af; font-size: 8.5pt; font-style: italic; }
        .page-break { page-break-before: always; }
        .appendix-section { margin-top: 20px; }
        .appendix-title { font-size: 12.5pt; font-weight: 800; text-align: center; margin: 0; color: #1e3a8a; }
        .appendix-sub { text-align: center; font-size: 8.5pt; color: #6b7280; margin: 2px 0 12px 0; }
        .key-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        .key-table th, .key-table td { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; }
        .key-table th { background: #1e3a8a; color: #fff; font-weight: 700; text-align: left; }
        .q-exp { font-size: 8pt; color: #4b5563; margin-top: 2px; }
        .no-print-bar { background: #1e293b; color: #fff; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 12px; border-radius: 8px; }
        .no-print-bar button { background: #2563eb; color: #fff; border: 0; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; }
        @media print {
          .no-print-bar { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <span>Pratinjau Naskah Cetak PDF &bull; Klik Cetak untuk mencetak fisik atau memilih 'Save as PDF' di dialog browser.</span>
        <button onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
      </div>

      ${
        includeHeader
          ? `
        <div class="kop-container">
          <h1 class="kop-inst">${schoolName.toUpperCase()}</h1>
          <h2 class="kop-title">${title.toUpperCase()}</h2>
          <p class="kop-meta">${academicYear} &bull; SISTEM UJIAN CBT</p>
        </div>

        <table class="meta-table">
          <tr>
            <td style="width: 18%;"><strong>Mata Pelajaran</strong></td>
            <td style="width: 32%;">: ${subject}</td>
            <td style="width: 18%;"><strong>Hari / Tanggal</strong></td>
            <td style="width: 32%;">: .......................................</td>
          </tr>
          <tr>
            <td><strong>Tingkat / Rombel</strong></td>
            <td>: ${gradeLevel}</td>
            <td><strong>Alokasi Waktu</strong></td>
            <td>: ${duration} Menit</td>
          </tr>
          <tr>
            <td><strong>Nama Peserta</strong></td>
            <td>: .......................................</td>
            <td><strong>Nomor / NISN</strong></td>
            <td>: .......................................</td>
          </tr>
        </table>
        <hr style="border: 0; border-top: 1px solid #9ca3af; margin-bottom: 12px;" />
      `
          : ""
      }

      <div class="questions-list">
        ${questionsHtml}
      </div>

      ${keyAppendixHtml}

      <script>
        // Auto trigger print dialog after document is loaded
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.print();
          }, 400);
        });
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
