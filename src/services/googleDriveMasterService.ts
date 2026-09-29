import { getGoogleAccessToken, isGoogleSignedIn } from "./googleAuth";
import { findOrCreateAppFolder, uploadJsonToDrive } from "./googleDriveService";
import { Student } from "../types";

export interface MasterDriveSyncInfo {
  isConnected: boolean;
  autoSync: boolean;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: string | null;
  syncedStudentCount: number;
}

const STORAGE_KEYS = {
  MASTER_SHEET_ID: "gpp_master_drive_sheet_id",
  MASTER_SHEET_NAME: "gpp_master_drive_sheet_name",
  MASTER_SHEET_URL: "gpp_master_drive_sheet_url",
  MASTER_LAST_SYNCED_AT: "gpp_master_drive_last_synced_at",
  MASTER_SYNCED_COUNT: "gpp_master_drive_synced_count",
  MASTER_AUTO_SYNC: "gpp_master_drive_auto_sync",
};

export function getMasterDriveSyncInfo(): MasterDriveSyncInfo {
  try {
    const isConnected = isGoogleSignedIn();
    const autoSync = localStorage.getItem(STORAGE_KEYS.MASTER_AUTO_SYNC) !== "false";
    const spreadsheetId = localStorage.getItem(STORAGE_KEYS.MASTER_SHEET_ID);
    const spreadsheetName = localStorage.getItem(STORAGE_KEYS.MASTER_SHEET_NAME) || "Data_Master_Induk_Siswa_CBT";
    const spreadsheetUrl = localStorage.getItem(STORAGE_KEYS.MASTER_SHEET_URL);
    const lastSyncedAt = localStorage.getItem(STORAGE_KEYS.MASTER_LAST_SYNCED_AT);
    const syncedStudentCount = parseInt(localStorage.getItem(STORAGE_KEYS.MASTER_SYNCED_COUNT) || "0", 10);

    return {
      isConnected,
      autoSync,
      spreadsheetId,
      spreadsheetName,
      spreadsheetUrl,
      lastSyncedAt,
      syncedStudentCount,
    };
  } catch {
    return {
      isConnected: false,
      autoSync: true,
      spreadsheetId: null,
      spreadsheetName: "Data_Master_Induk_Siswa_CBT",
      spreadsheetUrl: null,
      lastSyncedAt: null,
      syncedStudentCount: 0,
    };
  }
}

export function setMasterDriveAutoSync(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MASTER_AUTO_SYNC, enabled ? "true" : "false");
  } catch {}
}

/**
 * Gets or creates the dedicated Google Spreadsheet for master students
 */
export async function getOrCreateMasterStudentSpreadsheet(): Promise<{
  id: string;
  name: string;
  url: string;
}> {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Sesi Google Drive belum terhubung. Silakan login ke akun Google terlebih dahulu.");

  const spreadsheetName = "Data_Master_Induk_Siswa_CBT";

  // Check stored ID first
  const storedId = localStorage.getItem(STORAGE_KEYS.MASTER_SHEET_ID);
  const storedUrl = localStorage.getItem(STORAGE_KEYS.MASTER_SHEET_URL);
  if (storedId) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${storedId}?fields=id,name,trashed,webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        const fileData = await checkRes.json();
        if (!fileData.trashed) {
          const finalUrl = fileData.webViewLink || storedUrl || `https://docs.google.com/spreadsheets/d/${fileData.id}/edit`;
          return { id: fileData.id, name: fileData.name || spreadsheetName, url: finalUrl };
        }
      }
    } catch {}
  }

  // Ensure GPP_CBT_Backups folder exists
  const folderId = await findOrCreateAppFolder("GPP_CBT_Backups");

  // Search if spreadsheet already exists in folder
  const q = `name = '${spreadsheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and '${folderId}' in parents`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const existing = searchData.files[0];
      const url = existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`;
      try {
        localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_ID, existing.id);
        localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_NAME, existing.name);
        localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_URL, url);
      } catch {}
      return { id: existing.id, name: existing.name, url };
    }
  }

  // Create new spreadsheet
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
      description: "Data Induk / Master Siswa Ujian CBT GusthyPalinPatanda (Hanya Nama & Kelas, tersinkron otomatis)",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal membuat spreadsheet Master Siswa di Google Drive.");
  }

  const created = await createRes.json();
  const spreadsheetId = created.id;
  const webViewLink = created.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Initialize Header row
  const headers = [
    "No",
    "Nama Lengkap Siswa",
    "Kelas",
    "Username Akun",
    "Password",
    "NISN",
    "Token Barcode Ujian",
    "Status Login",
    "Status Ujian",
    "Terakhir Disinkronkan",
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:J1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [headers] }),
    }
  );

  // Format header row (Emerald styling with freeze row 1)
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
                  backgroundColor: { red: 0.05, green: 0.35, blue: 0.22 },
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
    console.warn("Formatting master header warning:", fmtErr);
  }

  try {
    localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_ID, spreadsheetId);
    localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_NAME, spreadsheetName);
    localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_URL, webViewLink);
  } catch {}

  return { id: spreadsheetId, name: spreadsheetName, url: webViewLink };
}

/**
 * Synchronizes all master students to Google Drive Spreadsheet & JSON Snapshot
 */
export async function syncAllMasterStudentsToGoogleDrive(students: Student[]): Promise<{
  success: boolean;
  spreadsheetUrl: string;
  syncedCount: number;
  lastSyncedAt: string;
  backupFileId?: string;
}> {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error("Sesi Google Drive belum terhubung. Silakan login ke akun Google terlebih dahulu.");
  }

  // 1. Get or create spreadsheet
  const { id: spreadsheetId, url: spreadsheetUrl } = await getOrCreateMasterStudentSpreadsheet();

  // 2. Prepare sorted data strictly alphabetically by student name (A-Z)
  const sorted = [...students].sort((a, b) => {
    const nameCmp = (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base", numeric: true });
    if (nameCmp !== 0) return nameCmp;
    return (a.className || "").localeCompare(b.className || "", "id", { numeric: true });
  });

  const nowStr = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    dateStyle: "medium",
    timeStyle: "medium",
  }) + " WITA";

  const rows: (string | number)[][] = [
    [
      "No",
      "Nama Lengkap Siswa",
      "Kelas",
      "Username Akun",
      "Password",
      "NISN",
      "Token Barcode Ujian",
      "Status Login",
      "Status Ujian",
      "Terakhir Disinkronkan",
    ],
  ];

  sorted.forEach((s, idx) => {
    rows.push([
      idx + 1,
      s.name || "-",
      s.className || "-",
      s.username || "-",
      s.password || "siswa123",
      s.nisn || "-",
      s.startBarcodeToken || "-",
      s.isLocked ? "Sedang Login / Terkunci" : "Siap Login",
      s.examStatus === "submitted"
        ? `Selesai (${s.totalScore ?? 0})`
        : s.examStatus === "in_progress"
        ? "Sedang Mengerjakan"
        : s.examStatus === "disqualified"
        ? "Didiskualifikasi"
        : "Belum Mulai",
      nowStr,
    ]);
  });

  // 3. Clear old values and write updated rows
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:J:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:J${rows.length}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal memperbarui data pada spreadsheet Google Drive.");
  }

  // 4. Save timestamped JSON backup snapshot to Drive
  let backupFileId: string | undefined;
  try {
    const dateTag = new Date().toISOString().replace(/[:.]/g, "-");
    const backupResult = await uploadJsonToDrive({
      fileName: `data_master_siswa_${dateTag}.json`,
      data: {
        exportedAt: new Date().toISOString(),
        totalStudents: sorted.length,
        students: sorted,
      },
      description: `Cadangan Data Master Siswa (${sorted.length} siswa) - CBT GusthyPalinPatanda`,
    });
    backupFileId = backupResult.id;
  } catch (backupErr) {
    console.warn("[Drive] Snapshot JSON upload skipped or failed:", backupErr);
  }

  // 5. Update local state
  try {
    localStorage.setItem(STORAGE_KEYS.MASTER_LAST_SYNCED_AT, nowStr);
    localStorage.setItem(STORAGE_KEYS.MASTER_SYNCED_COUNT, String(sorted.length));
  } catch {}

  return {
    success: true,
    spreadsheetUrl,
    syncedCount: sorted.length,
    lastSyncedAt: nowStr,
    backupFileId,
  };
}
