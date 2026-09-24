import * as XLSX from "xlsx";
import { Question, Student, QuestionItemAnalysis, DistractorAnalysis } from "../types";

/**
 * Menghitung analisis butir soal empiris (Psikometri & Evaluasi Pendidikan Kemendikbud)
 * Berdasarkan jawaban aktual siswa yang telah menyelesaikan ujian.
 */
export function calculateItemAnalysis(
  questions: Question[],
  students: Student[]
): {
  analyses: QuestionItemAnalysis[];
  totalSubmitted: number;
  upperCount: number;
  lowerCount: number;
  idealQuestionsCount: number;
  revisionNeededCount: number;
} {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeStudents = Array.isArray(students) ? students : [];

  // Hanya ambil siswa yang sudah berstatus 'submitted' (sudah menyelesaikan ujian)
  const submittedStudents = safeStudents.filter((s) => s && s.examStatus === "submitted");

  if (safeQuestions.length === 0) {
    return {
      analyses: [],
      totalSubmitted: 0,
      upperCount: 0,
      lowerCount: 0,
      idealQuestionsCount: 0,
      revisionNeededCount: 0,
    };
  }

  // Jika belum ada siswa yang mengumpulkan ujian, tampilkan seluruh butir soal dengan status siap respon
  if (submittedStudents.length === 0) {
    const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const analyses: QuestionItemAnalysis[] = safeQuestions.map((q, qIndex) => ({
      questionId: q.id,
      questionNumber: qIndex + 1,
      type: q.type,
      questionText: q.question || "(Soal tidak memiliki teks)",
      points: typeof q.points === "number" && !isNaN(q.points) ? q.points : 10,
      subject: q.subject,
      totalAttempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      partialCount: 0,
      averageScore: 0,
      difficultyIndex: 0,
      difficultyLabel: "Belum Ada Data",
      difficultyBadgeColor: "slate",
      discriminationIndex: 0,
      discriminationLabel: "Belum Ada Data",
      discriminationBadgeColor: "slate",
      upperGroupPassRate: 0,
      lowerGroupPassRate: 0,
      distractors:
        q.type === "mcq" && Array.isArray(q.options)
          ? q.options.map((optText, optIdx) => ({
              optionIndex: optIdx,
              optionLabel: optionLabels[optIdx] || String(optIdx + 1),
              optionText: optText || "",
              count: 0,
              percentage: 0,
              isCorrect: optIdx === q.correctAnswer,
              upperCount: 0,
              lowerCount: 0,
              isFunctional: true,
            }))
          : undefined,
      recommendation: "Menunggu Data Jawaban",
      recommendationReason:
        "Belum ada siswa yang menyelesaikan ujian (status: submitted). Data tingkat kesukaran dan daya pembeda akan dihitung secara empiris begitu jawaban siswa masuk.",
    }));

    return {
      analyses,
      totalSubmitted: 0,
      upperCount: 0,
      lowerCount: 0,
      idealQuestionsCount: 0,
      revisionNeededCount: 0,
    };
  }

  // Urutkan siswa berdasarkan total skor tertinggi ke terendah
  const sortedStudents = [...submittedStudents].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)
  );

  const N = sortedStudents.length;

  // Penentuan Kelompok Atas (Upper Group) dan Kelompok Bawah (Lower Group)
  // Standar Kelly 27% untuk N besar (>= 20), atau median split 50% untuk N kecil (< 20)
  const groupRatio = N >= 20 ? 0.27 : 0.5;
  const groupSize = Math.max(1, Math.round(N * groupRatio));

  const upperGroup = sortedStudents.slice(0, groupSize);
  const lowerGroup = sortedStudents.slice(N - groupSize);

  let idealQuestionsCount = 0;
  let revisionNeededCount = 0;

  const analyses: QuestionItemAnalysis[] = safeQuestions
    .filter((q): q is Question => Boolean(q && q.id))
    .map((q, qIndex) => {
      const qPoints = typeof q.points === "number" && !isNaN(q.points) && q.points > 0 ? q.points : 10;
      let correctCount = 0;
      let incorrectCount = 0;
      let partialCount = 0;
      let totalScoreEarned = 0;

      // Hitung performa per siswa
      const studentScores: { studentId: string; score: number; answer: any }[] = [];

      submittedStudents.forEach((st) => {
        if (!st) return;
        const ans = st.answers ? st.answers[q.id] : undefined;
        let earned = 0;

        if (q.type === "mcq") {
          if (
            ans !== undefined &&
            q.correctAnswer !== undefined &&
            (ans === q.correctAnswer ||
              String(ans).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase())
          ) {
            earned = qPoints;
            correctCount++;
          } else {
            incorrectCount++;
          }
        } else if (q.type === "true_false") {
          if (ans !== undefined && q.correctBool !== undefined && ans === q.correctBool) {
            earned = qPoints;
            correctCount++;
          } else {
            incorrectCount++;
          }
        } else if (q.type === "matching") {
          if (
            Array.isArray(q.matchingPairs) &&
            q.matchingPairs.length > 0 &&
            typeof ans === "object" &&
            ans !== null
          ) {
            let matches = 0;
            q.matchingPairs.forEach((pair, idx) => {
              if (pair && pair.right !== undefined && ans[idx] === pair.right) matches++;
            });
            earned = Math.round((matches / q.matchingPairs.length) * qPoints);
            if (earned === qPoints) correctCount++;
            else if (earned > 0) partialCount++;
            else incorrectCount++;
          } else {
            incorrectCount++;
          }
        } else if (q.type === "multi_choice") {
          const userChoices: number[] = Array.isArray(ans) ? ans : [];
          const correctKeys: number[] = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
          if (userChoices.length > 0 && correctKeys.length > 0) {
            const isMatch =
              userChoices.length === correctKeys.length &&
              userChoices.every((val) => correctKeys.includes(val));
            if (isMatch) {
              earned = qPoints;
              correctCount++;
            } else {
              const tp = userChoices.filter((c) => correctKeys.includes(c)).length;
              const fp = userChoices.filter((c) => !correctKeys.includes(c)).length;
              const net = Math.max(0, tp - fp);
              earned = Math.round((net / correctKeys.length) * qPoints);
              if (earned > 0) partialCount++;
              else incorrectCount++;
            }
          } else {
            incorrectCount++;
          }
        } else if (q.type === "short_answer") {
          const userStr = String(ans || "").trim().toLowerCase();
          const targetStr = String(q.keyAnswer || "").trim().toLowerCase();
          if (userStr && targetStr && userStr === targetStr) {
            earned = qPoints;
            correctCount++;
          } else {
            incorrectCount++;
          }
        } else if (q.type === "essay") {
          const essayEval = st.essayEvaluations ? st.essayEvaluations[q.id] : null;
          if (essayEval && typeof essayEval.score === "number" && !isNaN(essayEval.score)) {
            earned = essayEval.score;
          } else {
            const textAns = String(ans || "").trim();
            earned = textAns.length > 20 ? Math.round(qPoints * 0.75) : textAns ? Math.round(qPoints * 0.3) : 0;
          }
          if (earned >= qPoints * 0.8) correctCount++;
          else if (earned > 0) partialCount++;
          else incorrectCount++;
        }

        totalScoreEarned += earned;
        studentScores.push({ studentId: st.id, score: earned, answer: ans });
      });

      const totalAttempts = submittedStudents.length;
      const averageScore = totalAttempts > 0 ? Number((totalScoreEarned / totalAttempts).toFixed(1)) : 0;

      // 1. Indeks Kesukaran (Facility Value, P)
      // Rasio rata-rata perolehan skor terhadap skor maksimal
      const rawP = qPoints > 0 && totalAttempts > 0 ? totalScoreEarned / (totalAttempts * qPoints) : 0;
      const difficultyIndex = Number(Math.max(0, Math.min(1, isNaN(rawP) ? 0 : rawP)).toFixed(2));

    let difficultyLabel: "Mudah" | "Sedang" | "Sukar" = "Sedang";
    let difficultyBadgeColor: "emerald" | "amber" | "rose" = "amber";

    if (difficultyIndex >= 0.7) {
      difficultyLabel = "Mudah";
      difficultyBadgeColor = "emerald";
    } else if (difficultyIndex < 0.3) {
      difficultyLabel = "Sukar";
      difficultyBadgeColor = "rose";
    } else {
      difficultyLabel = "Sedang";
      difficultyBadgeColor = "amber";
    }

    // 2. Daya Pembeda (Discrimination Index, D)
    // D = P_Upper - P_Lower (selisih proporsi skor kelompok atas dan kelompok bawah)
    const upperScores = upperGroup.map((u) => {
      const entry = studentScores.find((s) => s.studentId === u.id);
      return entry ? entry.score : 0;
    });
    const lowerScores = lowerGroup.map((l) => {
      const entry = studentScores.find((s) => s.studentId === l.id);
      return entry ? entry.score : 0;
    });

    const upperScoreSum = upperScores.reduce((acc, v) => acc + v, 0);
    const lowerScoreSum = lowerScores.reduce((acc, v) => acc + v, 0);

    const upperGroupPassRate =
      upperGroup.length > 0 && qPoints > 0
        ? Number((upperScoreSum / (upperGroup.length * qPoints)).toFixed(2))
        : 0;

    const lowerGroupPassRate =
      lowerGroup.length > 0 && qPoints > 0
        ? Number((lowerScoreSum / (lowerGroup.length * qPoints)).toFixed(2))
        : 0;

    const discriminationIndex = Number(
      Math.max(-1, Math.min(1, upperGroupPassRate - lowerGroupPassRate)).toFixed(2)
    );

    let discriminationLabel: "Sangat Baik" | "Baik" | "Cukup" | "Jelek" | "Negatif (Defektif)" = "Baik";
    let discriminationBadgeColor: "emerald" | "blue" | "amber" | "rose" | "purple" = "blue";

    if (discriminationIndex >= 0.4) {
      discriminationLabel = "Sangat Baik";
      discriminationBadgeColor = "emerald";
    } else if (discriminationIndex >= 0.3) {
      discriminationLabel = "Baik";
      discriminationBadgeColor = "blue";
    } else if (discriminationIndex >= 0.2) {
      discriminationLabel = "Cukup";
      discriminationBadgeColor = "amber";
    } else if (discriminationIndex >= 0) {
      discriminationLabel = "Jelek";
      discriminationBadgeColor = "rose";
    } else {
      discriminationLabel = "Negatif (Defektif)";
      discriminationBadgeColor = "purple";
    }

    // 3. Analisis Pengecoh (Distractor Analysis) khusus soal Pilihan Ganda (MCQ)
    let distractors: DistractorAnalysis[] | undefined;
    if (q.type === "mcq" && q.options && q.options.length > 0) {
      const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
      distractors = q.options.map((optText, optIdx) => {
        let count = 0;
        let upperCount = 0;
        let lowerCount = 0;

        studentScores.forEach((item) => {
          const val = item.answer;
          const isChosen =
            val === optIdx ||
            String(val).trim().toUpperCase() === optionLabels[optIdx] ||
            String(val).trim() === String(optIdx);

          if (isChosen) {
            count++;
            if (upperGroup.some((u) => u.id === item.studentId)) upperCount++;
            if (lowerGroup.some((l) => l.id === item.studentId)) lowerCount++;
          }
        });

        const percentage = totalAttempts > 0 ? Number(((count / totalAttempts) * 100).toFixed(1)) : 0;
        const isCorrect = optIdx === q.correctAnswer;
        // Pengecoh berfungsi baik jika dipilih minimal 5% peserta dan lebih banyak dipilih kelompok bawah daripada kelompok atas
        const isFunctional = isCorrect || (percentage >= 5.0 && lowerCount >= upperCount);

        return {
          optionIndex: optIdx,
          optionLabel: optionLabels[optIdx] || String(optIdx + 1),
          optionText: optText,
          count,
          percentage,
          isCorrect,
          upperCount,
          lowerCount,
          isFunctional,
        };
      });
    }

    // 4. Rekomendasi Pedagogis & Tindak Lanjut Soal
    let recommendation:
      | "Diterima (Sangat Baik)"
      | "Diterima dengan Revisi Kecil"
      | "Revisi Kunci Jawaban / Distraktor"
      | "Dibuang / Diganti Baru" = "Diterima (Sangat Baik)";
    let recommendationReason = "";

    if (discriminationIndex < 0) {
      recommendation = "Revisi Kunci Jawaban / Distraktor";
      recommendationReason =
        "Daya pembeda bernilai negatif. Siswa kelompok bawah justru lebih banyak menjawab benar dibandingkan siswa berprestasi tinggi. Periksa kemungkinan kunci jawaban terbalik atau rumusan kalimat ambigu.";
      revisionNeededCount++;
    } else if (discriminationIndex < 0.2) {
      recommendation = "Dibuang / Diganti Baru";
      recommendationReason =
        "Daya pembeda sangat rendah (D < 0.20). Butir soal tidak mampu membedakan tingkat pemahaman siswa, disarankan diganti dengan naskah baru.";
      revisionNeededCount++;
    } else if (discriminationIndex >= 0.2 && discriminationIndex < 0.3) {
      recommendation = "Diterima dengan Revisi Kecil";
      recommendationReason =
        "Daya pembeda cukup (0.20 <= D < 0.30). Soal dapat dipakai namun perlu penyempurnaan redaksi atau opsi pengecoh agar lebih menantang.";
      idealQuestionsCount++;
    } else {
      // D >= 0.30
      recommendation = "Diterima (Sangat Baik)";
      if (difficultyIndex >= 0.3 && difficultyIndex <= 0.7) {
        recommendationReason =
          "Soal ideal! Tingkat kesukaran sedang dengan daya pembeda tinggi. Sangat direkomendasikan untuk diarsipkan ke Bank Soal.";
      } else if (difficultyIndex > 0.7) {
        recommendationReason =
          "Soal kategori mudah namun valid dan berdaya pembeda baik. Cocok diletakkan pada awal ujian sebagai pemantik motivasi.";
      } else {
        recommendationReason =
          "Soal kategori sukar namun terbukti valid membedakan siswa unggulan berprestasi tinggi.";
      }
      idealQuestionsCount++;
    }

    return {
      questionId: q.id,
      questionNumber: qIndex + 1,
      type: q.type,
      questionText: q.question,
      points: q.points,
      subject: q.subject,
      totalAttempts,
      correctCount,
      incorrectCount,
      partialCount,
      averageScore,
      difficultyIndex,
      difficultyLabel,
      difficultyBadgeColor,
      discriminationIndex,
      discriminationLabel,
      discriminationBadgeColor,
      upperGroupPassRate,
      lowerGroupPassRate,
      distractors,
      recommendation,
      recommendationReason,
    };
  });

  return {
    analyses,
    totalSubmitted: submittedStudents.length,
    upperCount: upperGroup.length,
    lowerCount: lowerGroup.length,
    idealQuestionsCount,
    revisionNeededCount,
  };
}

/**
 * Ekspor Rekap Analisis Butir Soal ke Format Excel (.xlsx)
 */
export function exportItemAnalysisToExcel(
  analyses: QuestionItemAnalysis[],
  examTitle: string = "Ujian",
  subject: string = "Mata Pelajaran"
) {
  if (!analyses || analyses.length === 0) return;

  const rows = analyses.map((item) => ({
    "No. Soal": item.questionNumber,
    "Tipe Soal": item.type.toUpperCase(),
    "Mata Pelajaran": item.subject || subject,
    "Bobot Poin": item.points,
    "Jumlah Siswa": item.totalAttempts,
    "Jumlah Benar": item.correctCount,
    "Jumlah Salah": item.incorrectCount,
    "Rata-rata Skor": item.averageScore,
    "Indeks Kesukaran (P)": item.difficultyIndex,
    "Kategori Kesukaran": item.difficultyLabel,
    "Daya Pembeda (D)": item.discriminationIndex,
    "Kategori Daya Pembeda": item.discriminationLabel,
    "Kelompok Atas (P_U)": item.upperGroupPassRate,
    "Kelompok Bawah (P_L)": item.lowerGroupPassRate,
    "Rekomendasi": item.recommendation,
    "Keterangan Pedagogis": item.recommendationReason,
    "Naskah Soal": String(item.questionText || "").replace(/<[^>]*>?/gm, "").slice(0, 150),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-width column layout
  const colWidths = [
    { wch: 8 },  // No
    { wch: 14 }, // Tipe
    { wch: 18 }, // Mapel
    { wch: 10 }, // Poin
    { wch: 12 }, // Total
    { wch: 12 }, // Benar
    { wch: 12 }, // Salah
    { wch: 12 }, // Rata-rata
    { wch: 18 }, // P
    { wch: 16 }, // Kat Kesukaran
    { wch: 16 }, // D
    { wch: 20 }, // Kat Pembeda
    { wch: 16 }, // P_U
    { wch: 16 }, // P_L
    { wch: 25 }, // Rekomendasi
    { wch: 45 }, // Alasan
    { wch: 40 }, // Naskah
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Analisis Butir Soal");

  const cleanTitle = examTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `Analisis_Butir_Soal_${cleanTitle}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
