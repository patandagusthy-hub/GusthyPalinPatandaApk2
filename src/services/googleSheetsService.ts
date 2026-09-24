import { getGoogleAccessToken, isGoogleSignedIn } from "./googleAuth";
import { findOrCreateAppFolder } from "./googleDriveService";
import { Student } from "../types";

export interface SyncStatusInfo {
  enabled: boolean;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: string | null;
  lastStudentName: string | null;
  totalSyncedRows: number;
}

const STORAGE_KEYS = {
  AUTO_SYNC_ENABLED: "gpp_drive_auto_sync_enabled",
  SPREADSHEET_ID: "gpp_drive_active_spreadsheet_id",
  SPREADSHEET_NAME: "gpp_drive_active_spreadsheet_name",
  SPREADSHEET_URL: "gpp_drive_active_spreadsheet_url",
  LAST_SYNCED_AT: "gpp_drive_last_synced_at",
  LAST_STUDENT: "gpp_drive_last_synced_student",
};

// Queue mutex to prevent race conditions during concurrent submissions
let isSyncingQueue = false;
const syncQueue: Array<{ student: Student; passingScore: number }> = [];

export function isAutoSyncEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC_ENABLED);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC_ENABLED, enabled ? "true" : "false");
  } catch {}
}

export function getStoredSpreadsheetInfo(): {
  id: string | null;
  name: string | null;
  url: string | null;
  lastSyncedAt: string | null;
  lastStudent: string | null;
} {
  try {
    return {
      id: localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID),
      name: localStorage.getItem(STORAGE_KEYS.SPREADSHEET_NAME),
      url: localStorage.getItem(STORAGE_KEYS.SPREADSHEET_URL),
      lastSyncedAt: localStorage.getItem(STORAGE_KEYS.LAST_SYNCED_AT),
      lastStudent: localStorage.getItem(STORAGE_KEYS.LAST_STUDENT),
    };
  } catch {
    return { id: null, name: null, url: null, lastSyncedAt: null, lastStudent: null };
  }
}

// Find or create the dedicated Google Spreadsheet in the GPP_CBT_Backups folder
export async function getOrCreateExamSpreadsheet(
  examTitle: string = "Ujian_CBT"
): Promise<{ id: string; name: string; url: string }> {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Sesi Google Drive belum aktif. Silakan hubungkan akun Google.");

  // Clean title for spreadsheet file name
  const cleanTitle = (examTitle || "CBT_Exam")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const spreadsheetName = `Rekap_Nilai_Realtime_${cleanTitle}`;

  // 1. Check if existing spreadsheet id is stored and valid
  const stored = getStoredSpreadsheetInfo();
  if (stored.id && stored.url) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${stored.id}?fields=id,name,trashed,webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        const fileData = await checkRes.json();
        if (!fileData.trashed) {
          return {
            id: fileData.id,
            name: fileData.name || stored.name || spreadsheetName,
            url: fileData.webViewLink || stored.url,
          };
        }
      }
    } catch {}
  }

  // 2. Locate or create GPP_CBT_Backups folder in Drive
  const folderId = await findOrCreateAppFolder("GPP_CBT_Backups");

  // 3. Search if spreadsheet exists in Drive
  const q = `name = '${spreadsheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and '${folderId}' in parents`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name,webViewLink)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const existing = searchData.files[0];
      const url = existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`;
      try {
        localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, existing.id);
        localStorage.setItem(STORAGE_KEYS.SPREADSHEET_NAME, existing.name);
        localStorage.setItem(STORAGE_KEYS.SPREADSHEET_URL, url);
      } catch {}
      return { id: existing.id, name: existing.name, url };
    }
  }

  // 4. Create new Google Spreadsheet via Drive API
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: spreadsheetName,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
      description: `Rekapitulasi Nilai Otomatis Real-time CBT (${examTitle})`,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal membuat spreadsheet baru di Google Drive.");
  }

  const created = await createRes.json();
  const spreadsheetId = created.id;
  const webViewLink =
    created.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 5. Initialize Header Row with Official Styling
  const headers = [
    "No",
    "NISN",
    "Nama Lengkap Siswa",
    "Kelas",
    "Nilai PG",
    "Nilai Essay",
    "Total Nilai",
    "Status Ujian",
    "Waktu Selesai (WITA/WIB)",
    "Status Kelulusan",
    "Pelanggaran",
    "Terakhir Disinkronkan",
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:L1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  // Freeze row 1 and format header styling
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.08, green: 0.2, blue: 0.38 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      }),
    });
  } catch (fmtErr) {
    console.warn("Formatting header warning:", fmtErr);
  }

  try {
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId);
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET_NAME, spreadsheetName);
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET_URL, webViewLink);
  } catch {}

  return { id: spreadsheetId, name: spreadsheetName, url: webViewLink };
}

// Sync or update a single student's row into the Google Spreadsheet
export async function syncStudentToSheet(
  student: Student,
  passingScore: number = 75,
  examTitle: string = "Ujian_CBT"
): Promise<{ success: boolean; spreadsheetUrl: string; rowNumber: number }> {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Tidak ada token otorisasi Google");

  const { id: spreadsheetId, url: spreadsheetUrl } = await getOrCreateExamSpreadsheet(examTitle);

  // 1. Fetch current rows to check if student already has a row
  const getRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:L`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  let rows: string[][] = [];
  if (getRes.ok) {
    const data = await getRes.json();
    rows = data.values || [];
  }

  const cleanNisn = (student.nisn || "").trim();
  const cleanName = (student.name || "").trim().toLowerCase();

  // Find existing row index (1-indexed, row 1 is header)
  let foundRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowNisn = (rows[i][1] || "").trim();
    const rowName = (rows[i][2] || "").trim().toLowerCase();

    if ((cleanNisn && rowNisn === cleanNisn) || (cleanName && rowName === cleanName)) {
      foundRowIdx = i + 1; // 1-indexed for Sheets API range
      break;
    }
  }

  const finishedTime = student.submittedAt
    ? new Date(student.submittedAt).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "medium",
      })
    : new Date().toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "medium",
      });

  const rowData = [
    foundRowIdx > 0 ? foundRowIdx - 1 : rows.length, // No urut
    student.nisn || "-",
    student.name || "Tanpa Nama",
    student.className || "-",
    student.mcqScore ?? 0,
    student.essayScore ?? 0,
    student.totalScore ?? 0,
    student.examStatus === "submitted" ? "Selesai" : student.examStatus === "disqualified" ? "Didiskualifikasi" : "Dalam Ujian",
    finishedTime,
    (student.totalScore ?? 0) >= passingScore ? "LULUS" : "REMIDIAL",
    student.violationsCount ?? 0,
    new Date().toLocaleTimeString("id-ID"),
  ];

  let targetRowNumber = foundRowIdx;

  if (foundRowIdx > 0) {
    // Update existing row
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A${foundRowIdx}:L${foundRowIdx}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [rowData] }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err.error?.message || "Gagal memperbarui baris siswa di Google Sheets.");
    }
  } else {
    // Append new row
    targetRowNumber = rows.length + 1;
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:L:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [rowData] }),
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      throw new Error(err.error?.message || "Gagal menambahkan baris siswa baru ke Google Sheets.");
    }
  }

  // Update last sync info
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED_AT, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.LAST_STUDENT, student.name || student.nisn);
  } catch {}

  return {
    success: true,
    spreadsheetUrl,
    rowNumber: targetRowNumber,
  };
}

// Batch sync all submitted students in one go
export async function syncAllSubmittedStudents(
  students: Student[],
  passingScore: number = 75,
  examTitle: string = "Ujian_CBT"
): Promise<{ totalSynced: number; spreadsheetUrl: string }> {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Tidak ada token otorisasi Google");

  const submitted = students.filter(
    (s) => s.examStatus === "submitted" || s.examStatus === "disqualified"
  );
  if (submitted.length === 0) {
    const { url } = await getOrCreateExamSpreadsheet(examTitle);
    return { totalSynced: 0, spreadsheetUrl: url };
  }

  const { id: spreadsheetId, url: spreadsheetUrl } = await getOrCreateExamSpreadsheet(examTitle);

  // Build matrix
  const headers = [
    "No",
    "NISN",
    "Nama Lengkap Siswa",
    "Kelas",
    "Nilai PG",
    "Nilai Essay",
    "Total Nilai",
    "Status Ujian",
    "Waktu Selesai (WITA/WIB)",
    "Status Kelulusan",
    "Pelanggaran",
    "Terakhir Disinkronkan",
  ];

  const rows = submitted.map((st, idx) => {
    const finishedTime = st.submittedAt
      ? new Date(st.submittedAt).toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "medium",
        })
      : "-";

    return [
      idx + 1,
      st.nisn || "-",
      st.name || "Tanpa Nama",
      st.className || "-",
      st.mcqScore ?? 0,
      st.essayScore ?? 0,
      st.totalScore ?? 0,
      st.examStatus === "submitted" ? "Selesai" : "Didiskualifikasi",
      finishedTime,
      (st.totalScore ?? 0) >= passingScore ? "LULUS" : "REMIDIAL",
      st.violationsCount ?? 0,
      new Date().toLocaleTimeString("id-ID"),
    ];
  });

  const fullData = [headers, ...rows];

  // Overwrite sheet values with clean formatted table
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:L${fullData.length}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: fullData }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal menyinkronkan seluruh siswa ke Google Sheets.");
  }

  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED_AT, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.LAST_STUDENT, `Massal (${submitted.length} Siswa)`);
  } catch {}

  return {
    totalSynced: submitted.length,
    spreadsheetUrl,
  };
}

// Enqueue real-time sync with mutex protection
export function enqueueStudentAutoSync(
  student: Student,
  passingScore: number = 75,
  examTitle: string = "Ujian_CBT"
): void {
  if (!isAutoSyncEnabled()) return;
  if (!isGoogleSignedIn()) return;

  syncQueue.push({ student, passingScore });
  processSyncQueue(examTitle);
}

async function processSyncQueue(examTitle: string) {
  if (isSyncingQueue) return;
  isSyncingQueue = true;

  while (syncQueue.length > 0) {
    const item = syncQueue.shift();
    if (item) {
      try {
        await syncStudentToSheet(item.student, item.passingScore, examTitle);
      } catch (err) {
        console.warn("[AutoSync Drive] Error syncing student row:", err);
      }
    }
  }

  isSyncingQueue = false;
}
