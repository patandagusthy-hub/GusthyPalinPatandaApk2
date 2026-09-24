import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { Student, ExamConfig } from "../types";

export function exportResultsToExcel(students: Student[], examTitle: string, config?: ExamConfig) {
  const kkm = config?.passingScore ?? 75;
  const data = students.map((s, idx) => ({
    "No": idx + 1,
    "NISN": s.nisn,
    "Nama Lengkap": s.name,
    "Kelas": s.className,
    "Status Ujian":
      s.examStatus === "submitted"
        ? "Selesai"
        : s.examStatus === "disqualified"
        ? "Didiskualifikasi (Pelanggaran)"
        : s.examStatus === "in_progress"
        ? "Sedang Mengerjakan"
        : "Belum Mulai",
    "Nilai Pilihan Ganda": s.mcqScore,
    "Nilai Essay": s.essayScore,
    "Total Nilai (0-100)": s.totalScore,
    [`Kelulusan (KKM: ${kkm})`]:
      s.examStatus === "disqualified"
        ? "Didiskualifikasi"
        : s.totalScore >= kkm
        ? "Lulus"
        : "Belum Tuntas",
    "Jumlah Pelanggaran": s.violationsCount,
    "Waktu Selesai": s.submittedAt ? new Date(s.submittedAt).toLocaleString("id-ID") : "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Ujian");

  // Auto-width columns
  const maxColWidths = [
    { wch: 5 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
  ];
  worksheet["!cols"] = maxColWidths;

  const fileName = `Rekap_Nilai_${examTitle.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportResultsToPDF(students: Student[], examTitle: string, config: ExamConfig) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("GUSTHYPALINPATANDAEXAM", pageWidth / 2, 16, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("LAPORAN RESMI REKAPITULASI HASIL UJIAN SISWA", pageWidth / 2, 22, { align: "center" });
  doc.text(`Mata Pelajaran: ${config.subject} | Token: ${config.gateToken}`, pageWidth / 2, 28, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.line(14, 32, pageWidth - 14, 32);

  // Table header
  let startY = 40;
  const colX = [14, 24, 52, 108, 134, 164, 192, 218, 246, 276];
  const headers = [
    "No",
    "NISN",
    "Nama Siswa",
    "Kelas",
    "Skor PG",
    "Skor Essay",
    "Total",
    "Pelanggaran",
    "Status",
  ];

  doc.setFillColor(241, 245, 249);
  doc.rect(14, startY - 5, pageWidth - 28, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  doc.text(headers[0], colX[0], startY);
  doc.text(headers[1], colX[1], startY);
  doc.text(headers[2], colX[2], startY);
  doc.text(headers[3], colX[3], startY);
  doc.text(headers[4], colX[4], startY);
  doc.text(headers[5], colX[5], startY);
  doc.text(headers[6], colX[6], startY);
  doc.text(headers[7], colX[7], startY);
  doc.text(headers[8], colX[8], startY);

  startY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  students.forEach((s, idx) => {
    if (startY > 185) {
      doc.addPage();
      startY = 20;
    }

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, startY - 4, pageWidth - 28, 6.5, "F");
    }

    const statusText =
      s.examStatus === "submitted"
        ? "SELESAI"
        : s.examStatus === "disqualified"
        ? "DISKUALIFIKASI"
        : s.examStatus === "in_progress"
        ? "AKTIF"
        : "BELUM";

    doc.setTextColor(30, 41, 59);
    doc.text(String(idx + 1), colX[0], startY);
    doc.text(s.nisn, colX[1], startY);
    doc.text(s.name.substring(0, 28), colX[2], startY);
    doc.text(s.className, colX[3], startY);
    doc.text(String(s.mcqScore), colX[4], startY);
    doc.text(String(s.essayScore), colX[5], startY);

    // Color code total score
    if (s.totalScore >= config.passingScore) {
      doc.setTextColor(16, 185, 129); // green
    } else {
      doc.setTextColor(239, 68, 68); // red
    }
    doc.text(String(s.totalScore), colX[6], startY);

    // Violations count
    doc.setTextColor(s.violationsCount > 0 ? 220 : 71, s.violationsCount > 0 ? 38 : 85, s.violationsCount > 0 ? 38 : 105);
    doc.text(`${s.violationsCount}x`, colX[7], startY);

    // Status
    doc.setTextColor(
      s.examStatus === "disqualified" ? 220 : s.examStatus === "submitted" ? 16 : 100,
      s.examStatus === "submitted" ? 185 : 40,
      s.examStatus === "disqualified" ? 38 : 40
    );
    doc.text(statusText, colX[8], startY);

    startY += 6.5;
  });

  // Footer stats & signature block
  startY = Math.max(startY + 8, 160);
  if (startY > 180) {
    doc.addPage();
    startY = 25;
  }

  const avgScore = students.length ? Math.round(students.reduce((acc, c) => acc + c.totalScore, 0) / students.length) : 0;
  const passCount = students.filter((s) => s.totalScore >= config.passingScore).length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Rata-rata Nilai: ${avgScore} / 100 | Lulus (KKM >= ${config.passingScore}): ${passCount} dari ${students.length} Siswa`, 14, startY);

  const signX = pageWidth - 65;
  doc.setFont("helvetica", "normal");
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString("id-ID")}`, signX, startY);
  doc.text("Pengawas / Penanggung Jawab:", signX, startY + 6);
  doc.text("Gusthy Palin Patanda, S.Kom., M.T.", signX, startY + 22);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("NIP. 19850314 201001 1 008", signX, startY + 26);

  const fileName = `Laporan_Nilai_${examTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(fileName);
}
