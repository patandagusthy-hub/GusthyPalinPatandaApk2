import { Student } from "../types";

const FIRST_NAMES = [
  "Ahmad", "Muhammad", "Rizky", "Budi", "Dimas", "Fajar", "Aditya", "Ilham", "Bayu", "Arif",
  "Gilang", "Bagas", "Dwi", "Eko", "Hendra", "Wahyu", "Yoga", "Zack", "Galih", "Rian",
  "Siti", "Nur", "Putri", "Dewi", "Ayu", "Anisa", "Rina", "Dian", "Tri", "Lestari",
  "Indah", "Fitri", "Nabila", "Maya", "Salsabila", "Tiara", "Zahra", "Mega", "Wulan", "Cindy"
];

const LAST_NAMES = [
  "Pratama", "Saputra", "Santoso", "Hidayat", "Kusuma", "Wibowo", "Setiawan", "Utomo", "Permana", "Nugroho",
  "Wijaya", "Firmansyah", "Ramadhan", "Siregar", "Nasution", "Lubis", "Ginting", "Pasaribu", "Pardede", "Sitorus",
  "Gultom", "Simanjuntak", "Hutabarat", "Manurung", "Panjaitan", "Tambunan", "Tampubolon", "Pangaribuan", "Simamora", "Sitompul",
  "Anggraini", "Maharani", "Safitri", "Rahmawati", "Novitasari", "Wulandari", "Oktaviani", "Puspitasari", "Kusumawardani", "Sari"
];

const MAJORS = [
  "XII RPL 1", "XII RPL 2", "XII RPL 3",
  "XII TKJ 1", "XII TKJ 2", "XII TKJ 3",
  "XII DKV 1", "XII DKV 2",
  "XII AKL 1", "XII AKL 2",
  "XII OTKP 1", "XII OTKP 2",
  "XII BDP 1", "XII BDP 2"
];

const AVATAR_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899",
  "#06b6d4", "#14b8a6", "#f97316", "#6366f1", "#84cc16"
];

/**
 * Generates an array of realistic students for high-load simulation and testing.
 * @param count Number of students to generate (e.g. 1000)
 * @param simulateScores Whether to generate realistic random scores and exam statuses
 */
export function generateSimulationStudents(count: number = 1000, simulateScores: boolean = true): Student[] {
  const students: Student[] = [];
  const baseNisn = 2026100000;

  for (let i = 1; i <= count; i++) {
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const name = `${fn} ${ln}`;
    const nisn = String(baseNisn + i);
    const username = `siswa${String(i).padStart(4, "0")}`;
    const className = MAJORS[(i - 1) % MAJORS.length];
    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const startBarcodeToken = `GPP-${nisn.slice(-6)}-${String(i).padStart(4, "0")}`;

    let examStatus: Student["examStatus"] = "not_started";
    let mcqScore = 0;
    let essayScore = 0;
    let totalScore = 0;
    let loginCount = 0;
    let isLocked = false;
    let violationsCount = 0;

    if (simulateScores) {
      const rand = Math.random();
      if (rand < 0.60) {
        // 60% already submitted
        examStatus = "submitted";
        loginCount = 1;
        isLocked = true;
        mcqScore = Math.floor(Math.random() * 40) + 40; // 40 - 80
        essayScore = Math.floor(Math.random() * 20); // 0 - 20
        totalScore = mcqScore + essayScore;
        violationsCount = Math.random() < 0.15 ? 1 : 0;
      } else if (rand < 0.85) {
        // 25% in progress
        examStatus = "in_progress";
        loginCount = 1;
        isLocked = true;
        mcqScore = Math.floor(Math.random() * 50);
        essayScore = 0;
        totalScore = mcqScore;
        violationsCount = Math.random() < 0.10 ? 1 : 0;
      } else if (rand < 0.88) {
        // 3% disqualified
        examStatus = "disqualified";
        loginCount = 1;
        isLocked = true;
        mcqScore = 20;
        essayScore = 0;
        totalScore = 20;
        violationsCount = 2;
      } else {
        // 12% not started
        examStatus = "not_started";
        loginCount = 0;
        isLocked = false;
      }
    }

    students.push({
      id: `std-sim-${i}`,
      nisn,
      username,
      password: "siswa123",
      name,
      className,
      role: "siswa",
      isSample: true,
      loginCount,
      isLocked,
      examStatus,
      startBarcodeToken,
      mcqScore,
      essayScore,
      totalScore,
      violationsCount,
      violationsLog: violationsCount > 0 ? [
        {
          id: `vio-sim-${i}-1`,
          timestamp: new Date().toLocaleTimeString(),
          type: "TAB_SWITCH",
          title: "Deteksi Pindah Tab",
          description: "Siswa membuka tab atau aplikasi lain saat ujian berlangsung.",
        }
      ] : [],
      avatarColor,
      answers: {},
    });
  }

  return students;
}
