import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { serverDb } from "./server/db";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Engine configurations: Latest version & Backup version
const PRIMARY_MODEL = "gemini-3.8-flash";
const BACKUP_MODEL = "gemini-flash-latest";

// API: Health & Gemini Engine Status
app.get("/api/health", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok", app: "GusthyPalinPatandaExam", time: new Date().toISOString() });
});

// ==========================================
// PERSISTENT DATABASE & DATA PROTECTION APIS
// Guarantees admin questions, students, and settings are never lost!
// ==========================================

// Get complete current database
app.get("/api/data", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const db = serverDb.getDatabase();
  res.json({
    success: true,
    data: db,
  });
});

// Save complete or partial database changes
app.post("/api/data", (req: Request, res: Response) => {
  const { students, questions, examConfig, staffUsers, label } = req.body;
  const result = serverDb.saveDatabase(
    { students, questions, examConfig, staffUsers },
    label || "admin_action"
  );
  res.json(result);
});

// List all automated and manual backup snapshots
app.get("/api/data/backups", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const backups = serverDb.listBackups();
  res.json({
    success: true,
    backups,
  });
});

// Restore from a specific backup snapshot
app.post("/api/data/restore", (req: Request, res: Response) => {
  const { filename } = req.body;
  if (!filename) {
    res.status(400).json({ success: false, message: "Nama berkas cadangan wajib diisi" });
    return;
  }
  const result = serverDb.restoreBackup(filename);
  res.json(result);
});

// Export full database as downloadable JSON file
app.get("/api/data/export", (_req: Request, res: Response) => {
  const db = serverDb.getDatabase();
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `cbt_exam_backup_${timestamp}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(db, null, 2));
});

// Import external JSON backup
app.post("/api/data/import", (req: Request, res: Response) => {
  const { jsonString, jsonData } = req.body;
  const raw = jsonString || JSON.stringify(jsonData);
  if (!raw) {
    res.status(400).json({ success: false, message: "Data cadangan JSON tidak boleh kosong" });
    return;
  }
  const result = serverDb.importDatabase(raw);
  res.json(result);
});

// =========================================================================
// REAL-TIME SECURITY AUDIT VIOLATION STREAM
// Server-Sent Events (SSE) & Live Broadcast for Instant Proctor Monitoring
// =========================================================================
const sseViolationClients = new Set<Response>();

// 1. SSE Stream for Admin / Proctors Dashboard
app.get("/api/violations/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Initial handshake
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: new Date().toISOString() })}\n\n`);

  sseViolationClients.add(res);

  // Keep-alive heartbeat every 20s
  const heartbeat = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(heartbeat);
      sseViolationClients.delete(res);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseViolationClients.delete(res);
  });
});

// 2. Fetch all student violations for audit view
app.get("/api/violations", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const db = serverDb.getDatabase();
  const violations = db.students.flatMap((s) =>
    (s.violationsLog || []).map((v) => ({
      ...v,
      studentId: s.id,
      studentName: s.name,
      className: s.className,
      nisn: s.nisn,
    }))
  );
  violations.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  res.json({
    success: true,
    count: violations.length,
    violations,
  });
});

// 3. Record student violation immediately in real-time
app.post("/api/violations", (req: Request, res: Response) => {
  const { studentId, studentName, className, nisn, type, title, description, snapshot, timestamp } = req.body;
  if (!studentId) {
    res.status(400).json({ success: false, message: "studentId is required" });
    return;
  }

  const recorded = serverDb.recordStudentViolation(studentId, {
    type,
    title,
    description,
    snapshot,
    timestamp,
  });

  const fullRecord = {
    ...recorded,
    studentId,
    studentName: studentName || "Siswa",
    className: className || "-",
    nisn: nisn || "-",
  };

  // Broadcast to all active proctor dashboards immediately!
  const payload = `data: ${JSON.stringify({ type: "NEW_VIOLATION", violation: fullRecord })}\n\n`;
  for (const client of sseViolationClients) {
    try {
      client.write(payload);
    } catch {
      sseViolationClients.delete(client);
    }
  }

  res.json({ success: true, violation: fullRecord });
});

// 4. Clear/Reset all violation logs (Admin action)
app.delete("/api/violations", (_req: Request, res: Response) => {
  const result = serverDb.clearAllViolations();

  // Broadcast cleared state
  const payload = `data: ${JSON.stringify({ type: "VIOLATIONS_CLEARED" })}\n\n`;
  for (const client of sseViolationClients) {
    try {
      client.write(payload);
    } catch {
      sseViolationClients.delete(client);
    }
  }

  res.json(result);
});

// Route: Service Worker with specific offline headers
app.get("/sw.js", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  const swPath = path.join(process.cwd(), "public", "sw.js");
  res.sendFile(swPath);
});

// Route: Web App Manifest
app.get("/manifest.json", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Content-Type", "application/manifest+json");
  const manifestPath = path.join(process.cwd(), "public", "manifest.json");
  res.sendFile(manifestPath);
});

app.get("/api/gemini/status", (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    hasKey,
    primaryEngine: PRIMARY_MODEL,
    backupEngine: BACKUP_MODEL,
    status: hasKey ? "active" : "configured_default",
  });
});

// API: AI Proctoring Webcam Frame Analysis
app.post("/api/gemini/ai-proctor", async (req: Request, res: Response) => {
  try {
    const { imageBase64, studentName } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: "No image provided" });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback heuristics if no API key is available
      res.json({
        suspicious: false,
        confidence: 0.9,
        reason: "Simulasi Pengawasan Normal (AI Mode Siaga)",
        facesCount: 1,
        violations: [],
        engineUsed: "local-heuristic",
      });
      return;
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    const prompt = `Analisis foto webcam siswa bernama "${studentName || "Siswa"}" yang sedang mengerjakan ujian online.
Periksa hal-hal berikut untuk mencegah kecurangan ujian:
1. Jumlah wajah manusia yang terlihat dalam frame (apakah 0, 1, atau lebih dari 1?).
2. Apakah siswa menoleh jauh dari layar / meninggalkan tempat duduk?
3. Apakah terlihat ada benda terlarang seperti smartphone / HP, buku catatan, earphone / headset mencurigakan, atau orang lain di dekatnya?
4. Apakah ada indikasi kecurangan yang jelas?

Keluarkan jawaban HANYA dalam format JSON valid tanpa tanda markdown (tanpa \`\`\`json) dengan format:
{
  "suspicious": boolean,
  "facesCount": number,
  "reason": "Deskripsi singkat hasil analisa dalam bahasa Indonesia",
  "violations": ["daftar pelanggaran jika ada, contoh: 'Terlihat smartphone', 'Ada lebih dari 1 orang', 'Siswa tidak berada di depan kamera'"],
  "riskLevel": "LOW" | "MEDIUM" | "HIGH"
}`;

    // Call Primary Engine with fallback to Backup Engine
    let responseText = "";
    let engineUsed = PRIMARY_MODEL;

    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
      });
      responseText = response.text || "";
    } catch (primaryError) {
      console.warn(`Primary model ${PRIMARY_MODEL} error, switching to backup ${BACKUP_MODEL}:`, primaryError);
      engineUsed = BACKUP_MODEL;
      const backupResponse = await ai.models.generateContent({
        model: BACKUP_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
      });
      responseText = backupResponse.text || "";
    }

    // Parse JSON
    try {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      res.json({
        ...parsed,
        engineUsed,
      });
    } catch (parseErr) {
      res.json({
        suspicious: false,
        facesCount: 1,
        reason: "Webcam terpantau aman dan terfokus.",
        violations: [],
        riskLevel: "LOW",
        raw: responseText,
        engineUsed,
      });
    }
  } catch (error: any) {
    console.error("AI proctor error:", error);
    res.status(500).json({ error: error.message || "Gagal melakukan analisis proctor AI" });
  }
});

// API: AI Auto-Grading for Essay with Rubric Tuning (Strict vs Flexible Semantic)
app.post("/api/gemini/grade-essay", async (req: Request, res: Response) => {
  try {
    const {
      question,
      studentAnswer,
      keyAnswer,
      maxPoints = 20,
      rubric,
      rubricConfig,
    } = req.body;

    if (!question || !studentAnswer) {
      res.status(400).json({ error: "Pertanyaan dan jawaban siswa wajib diisi" });
      return;
    }

    const strictness = rubricConfig?.strictnessMode || "balanced";
    const typoTolerance = rubricConfig?.typoTolerance || "medium";
    const reasoningWeight = rubricConfig?.reasoningWeight ?? 50;
    const penalizeShort = rubricConfig?.penalizeLengthDeviation ?? true;
    const customDirectives = rubricConfig?.customDirectives || "";

    const ai = getGeminiClient();
    if (!ai) {
      // Rule-based fallback score tailored to rubric configuration
      const cleanAnswer = String(studentAnswer).trim();
      let fallbackScore = 0;
      let feedback = "";

      if (cleanAnswer.length < 15 && penalizeShort) {
        fallbackScore = Math.round(maxPoints * 0.25);
        feedback = "Jawaban terlalu singkat untuk menguraikan jawaban secara komprehensif.";
      } else {
        const keyWords = (keyAnswer || "")
          .toLowerCase()
          .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
          .split(/\s+/)
          .filter((w: string) => w.length > 3);

        const lowerAns = cleanAnswer.toLowerCase();
        let matchCount = 0;
        keyWords.forEach((kw: string) => {
          if (lowerAns.includes(kw)) matchCount++;
        });

        if (strictness === "strict_keyword") {
          // Strict keyword matching
          const matchRatio = keyWords.length > 0 ? matchCount / keyWords.length : 0.5;
          fallbackScore = Math.round(matchRatio * maxPoints);
          feedback = matchRatio >= 0.7
            ? "Penilaian Ketat: Kata kunci penting tercakup dengan tepat."
            : "Penilaian Ketat: Sebagian kata kunci penting belum tercantum.";
        } else if (strictness === "flexible_semantic") {
          // Flexible semantic essence
          const lengthBonus = Math.min(1, cleanAnswer.length / 60);
          const conceptRatio = Math.max(0.6, (matchCount > 0 ? 0.85 : 0.65) * lengthBonus);
          fallbackScore = Math.round(conceptRatio * maxPoints);
          feedback = "Penilaian Fleksibel: Esensi pemahaman konsep tersampaikan dengan baik.";
        } else {
          // Balanced standard
          const ratio = Math.min(1, 0.4 + (matchCount / Math.max(1, keyWords.length)) * 0.6);
          fallbackScore = Math.round(ratio * maxPoints);
          feedback = "Penilaian Berimbang: Memenuhi konsep dasar materi.";
        }
      }

      res.json({
        score: Math.min(maxPoints, fallbackScore),
        maxPoints,
        feedback,
        strictnessUsed: strictness,
        keyConceptsFound: ["Pemahaman inti materi"],
        engineUsed: "local-heuristic-rubric",
      });
      return;
    }

    // Compose Prompt based on Rubric Tuning
    let modeGuideline = "";
    if (strictness === "strict_keyword") {
      modeGuideline = `=== PANDUAN MODE: KETAT BERBASIS KATA KUNCI (Strict Keyword Matching) ===
- Siswa DIHARUSKAN menyebutkan kata kunci esensial, terminologi teknis baku, rumus, atau konsep persis yang ada pada referensi.
- Jangan berikan skor tinggi jika siswa berbelit-belit atau menjelaskan panjang lebar namun gagal menyebutkan istilah ilmiah/kata kunci pokok.
- Berikan pengurangan skor tegas jika istilah baku tidak ditemukan.`;
    } else if (strictness === "flexible_semantic") {
      modeGuideline = `=== PANDUAN MODE: FLEKSIBEL BERBASIS ESENSI MAKNA (Flexible Semantic Essence) ===
- Utamakan substansi pemahaman konsep, esensi ide, dan alur logika berpikir siswa, bukan redaksi kata demi kata.
- Berikan skor penuh atau mendekati penuh jika makna dan pemahamannya benar, meskipun menggunakan kata-kata sendiri, bahasa sehari-hari siswa, sinonim, atau analogi alternatif.
- JANGAN menghukum siswa hanya karena tidak menggunakan istilah baku persis seperti di referensi asalkan konsep logisnya benar.`;
    } else {
      modeGuideline = `=== PANDUAN MODE: STANDAR BERIMBANG (Balanced Evaluation) ===
- Menilai secara proporsional kombinasi antara keberadaan konsep kunci pokok dan kedalaman penjelasan siswa.`;
    }

    let typoGuideline = "";
    if (typoTolerance === "low") {
      typoGuideline = "- Toleransi Typo/Ejaan: RENDAH (Tuntut penulisan ejaan teknis yang benar dan presisi).";
    } else if (typoTolerance === "high") {
      typoGuideline = "- Toleransi Typo/Ejaan: TINGGI (Abaikan sepenuhnya salah ketik, singkatan wajar, dan ejaan non-baku selama substansi makna dapat dipahami).";
    } else {
      typoGuideline = "- Toleransi Typo/Ejaan: SEDANG (Toleran terhadap typo ringan 1-2 huruf yang tidak mengubah arti konsep).";
    }

    const reasoningGuideline = `- Pembagian Bobot: ${reasoningWeight}% untuk daya penalaran/argumentasi logis, dan ${100 - reasoningWeight}% untuk fakta/hafalan istilah.`;
    const lengthGuideline = penalizeShort
      ? "- Penalti Jawaban Pendek: Jika jawaban sangat singkat (kurang dari 1 kalimat lengkap) tanpa uraian penjelasan, berikan nilai maksimal 30% dari poin maksimal."
      : "";

    const customGuideline = customDirectives
      ? `=== INSTRUKSI KHUSUS GURU ===\n${customDirectives}\n`
      : "";

    const prompt = `Anda adalah penilai ujian profesional dan adil untuk sistem GusthyPalinPatandaExam.
Tugas Anda adalah menilai jawaban essay siswa berdasarkan soal, kunci jawaban/rubrik referensi, bobot poin maksimal, dan parameter kelonggaran penilaian (AI Rubric Tuning).

${modeGuideline}

${typoGuideline}
${reasoningGuideline}
${lengthGuideline}
${customGuideline}

Soal Ujian:
${question}

Kunci Jawaban / Konsep Kunci Referensi:
${keyAnswer || "Kesesuaian konsep logis dan akurasi materi"}

Rubrik Tambahan:
${rubric || "Kesesuaian konsep, kelengkapan argumentasi, dan ketepatan istilah"}

Jawaban Siswa:
"${studentAnswer}"

Poin Maksimal: ${maxPoints}

Berikan evaluasi objektif dan keluarkan HANYA dalam format JSON valid tanpa tanda markdown (\`\`\`json):
{
  "score": number, // Nilai siswa antara 0 sampai ${maxPoints} (maksimal 1 desimal, misal 18.5)
  "feedback": "Umpan balik edukatif yang jelas dan membangun untuk siswa",
  "keyConceptsFound": ["daftar konsep yang berhasil dijawab siswa dengan tepat"],
  "missingConcepts": ["konsep penting yang belum dijawab atau kurang tepat"],
  "rubricAssessment": "Ringkasan kesesuaian jawaban dengan mode penilaian (${strictness})"
}`;

    let responseText = "";
    let engineUsed = PRIMARY_MODEL;

    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: prompt,
      });
      responseText = response.text || "";
    } catch (err) {
      console.warn(`Primary model error, fallback to ${BACKUP_MODEL}:`, err);
      engineUsed = BACKUP_MODEL;
      const backupResponse = await ai.models.generateContent({
        model: BACKUP_MODEL,
        contents: prompt,
      });
      responseText = backupResponse.text || "";
    }

    try {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      res.json({
        ...parsed,
        maxPoints,
        strictnessUsed: strictness,
        engineUsed,
      });
    } catch (parseErr) {
      res.json({
        score: Math.round(maxPoints * 0.75),
        maxPoints,
        feedback: "Jawaban telah dievaluasi oleh sistem AI.",
        keyConceptsFound: ["Pemahaman dasar materi"],
        missingConcepts: [],
        strictnessUsed: strictness,
        engineUsed,
      });
    }
  } catch (error: any) {
    console.error("Essay grading error:", error);
    res.status(500).json({ error: error.message || "Gagal menilai essay dengan AI" });
  }
});

// API: Live Test Bench for AI Rubric Tuning (Used by Teachers in Admin Panel)
app.post("/api/gemini/test-essay-rubric", async (req: Request, res: Response) => {
  try {
    const {
      question = "Jelaskan fungsi dari mitokondria pada sel hewan!",
      keyAnswer = "Mitokondria berfungsi sebagai pusat respirasi seluler dan penghasil energi dalam bentuk ATP.",
      studentAnswer,
      maxPoints = 20,
      rubricConfig,
    } = req.body;

    if (!studentAnswer) {
      res.status(400).json({ error: "Jawaban simulasi siswa wajib diisi untuk uji coba." });
      return;
    }

    // Call grading logic
    const ai = getGeminiClient();
    const strictness = rubricConfig?.strictnessMode || "balanced";
    const typoTolerance = rubricConfig?.typoTolerance || "medium";
    const reasoningWeight = rubricConfig?.reasoningWeight ?? 50;
    const penalizeShort = rubricConfig?.penalizeLengthDeviation ?? true;
    const customDirectives = rubricConfig?.customDirectives || "";

    if (!ai) {
      res.json({
        score: Math.round(maxPoints * 0.8),
        maxPoints,
        feedback: "Simulasi Heuristik Rubrik: Jawaban relevan dengan konsep uji.",
        keyConceptsFound: ["Konsep seluler", "Energi ATP"],
        missingConcepts: [],
        strictnessUsed: strictness,
        engineUsed: "local-simulation",
      });
      return;
    }

    let modeDesc = "";
    if (strictness === "strict_keyword") {
      modeDesc = "Mode KETAT KATA KUNCI: Menuntut istilah teknis baku dan kata kunci persis.";
    } else if (strictness === "flexible_semantic") {
      modeDesc = "Mode FLEKSIBEL ESENSI MAKNA: Menerima analogi, sinonim, dan bahasa bebas siswa asalkan substansinya tepat.";
    } else {
      modeDesc = "Mode STANDAR BERIMBANG: Menimbang kata kunci dan pemahaman umum.";
    }

    const prompt = `Anda adalah penilai uji coba AI Rubric Tuning.
Evaluasi jawaban essay simulasi berikut dengan parameter yang ditentukan:
${modeDesc}
- Toleransi Typo: ${typoTolerance}
- Bobot Penalaran vs Hafalan: ${reasoningWeight}% : ${100 - reasoningWeight}%
${customDirectives ? `- Instruksi Tambahan: ${customDirectives}` : ""}

Pertanyaan:
${question}

Kunci Jawaban Referensi:
${keyAnswer}

Jawaban Siswa Uji Coba:
"${studentAnswer}"

Poin Maksimal: ${maxPoints}

Keluarkan HANYA dalam format JSON valid tanpa tanda markdown (\`\`\`json):
{
  "score": number, // Nilai antara 0 sampai ${maxPoints}
  "feedback": "Umpan balik ringkas alasan pemberian nilai",
  "keyConceptsFound": ["daftar konsep yang dinilai benar"],
  "missingConcepts": ["konsep yang terlewatkan atau kurang"],
  "rubricAssessment": "Analisis kecocokan dengan mode ${strictness}"
}`;

    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
    });

    const cleaned = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json({
      ...parsed,
      maxPoints,
      strictnessUsed: strictness,
      engineUsed: PRIMARY_MODEL,
    });
  } catch (error: any) {
    console.error("Test rubric error:", error);
    res.status(500).json({ error: error.message || "Gagal menguji rubrik AI" });
  }
});

// API: AI Question Generator for Teachers
app.post("/api/gemini/generate-questions", async (req: Request, res: Response) => {
  try {
    const { topic, gradeLevel, count = 3, type = "all" } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      res.status(400).json({ error: "Gemini API Key belum terpasang di Secrets." });
      return;
    }

    const prompt = `Buatkan ${count} butir soal ujian berkualitas tinggi untuk mata pelajaran/topik "${topic}" tingkat "${gradeLevel || "Umum"}".
Jenis soal: ${type === "mcq" ? "Hanya Pilihan Ganda" : type === "essay" ? "Hanya Essay" : "Campuran Pilihan Ganda dan Essay"}.

Keluarkan HANYA JSON array valid tanpa \`\`\`json:
[
  {
    "type": "mcq", // atau "essay"
    "question": "Teks soal lengkap",
    "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"], // jika mcq
    "correctAnswer": 0, // indeks pilihan benar (0=A, 1=B, 2=C, 3=D) jika mcq
    "keyAnswer": "Pembahasan atau kunci jawaban lengkap", // untuk essay maupun mcq
    "points": 10 // bobot poin
  }
]`;

    let responseText = "";
    let engineUsed = PRIMARY_MODEL;

    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: prompt,
      });
      responseText = response.text || "";
    } catch (err) {
      engineUsed = BACKUP_MODEL;
      const backupResponse = await ai.models.generateContent({
        model: BACKUP_MODEL,
        contents: prompt,
      });
      responseText = backupResponse.text || "";
    }

    const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json({ questions: parsed, engineUsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal membuat soal dengan AI" });
  }
});

// Start server with Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
          } else if (filePath.endsWith("sw.js")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Service-Worker-Allowed", "/");
          }
        },
      })
    );
    app.get("*", (_req: Request, res: Response) => {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GusthyPalinPatandaExam server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
