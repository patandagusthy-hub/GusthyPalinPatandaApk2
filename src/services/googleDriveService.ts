import { getGoogleAccessToken } from "./googleAuth";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  description?: string;
}

export interface DriveStorageQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";

const DEFAULT_FOLDER_NAME = "GPP_CBT_Backups";

// Helper to get authorized headers
function getAuthHeaders(): HeadersInit {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error("Sesi Google Drive belum terhubung. Silakan login ke akun Google terlebih dahulu.");
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

// Get storage quota of the connected Google Drive account
export async function getDriveStorageInfo(): Promise<{
  quota: DriveStorageQuota;
  user?: { displayName: string; emailAddress: string; photoLink?: string };
}> {
  const headers = getAuthHeaders();
  const res = await fetch(
    `${DRIVE_API_BASE}/about?fields=storageQuota,user(displayName,emailAddress,photoLink)`,
    { headers }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal memuat informasi penyimpanan Google Drive.");
  }

  const data = await res.json();
  return {
    quota: data.storageQuota || {},
    user: data.user,
  };
}

// Find or create application backup folder in Google Drive root
export async function findOrCreateAppFolder(
  folderName: string = DEFAULT_FOLDER_NAME
): Promise<string> {
  const headers = getAuthHeaders();

  // 1. Search if folder already exists
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, { headers });
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // 2. Create folder if not found
  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      description: "Folder otomatis untuk cadangan dan rekap data CBT GusthyPalinPatandaExam",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal membuat folder di Google Drive.");
  }

  const created = await createRes.json();
  return created.id;
}

// List files in Google Drive (optionally filtered by folder or search term)
export async function listDriveFiles(options?: {
  folderId?: string;
  searchTerm?: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<{ files: GoogleDriveFile[]; nextPageToken?: string }> {
  const headers = getAuthHeaders();
  const queryParts: string[] = ["trashed = false"];

  if (options?.folderId) {
    queryParts.push(`'${options.folderId}' in parents`);
  }

  if (options?.searchTerm?.trim()) {
    const clean = options.searchTerm.replace(/'/g, "\\'");
    queryParts.push(`name contains '${clean}'`);
  }

  const q = queryParts.join(" and ");
  const pageSize = options?.pageSize || 30;
  let url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q
  )}&pageSize=${pageSize}&orderBy=modifiedTime desc&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents,description)`;

  if (options?.pageToken) {
    url += `&pageToken=${encodeURIComponent(options.pageToken)}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal mengambil daftar berkas dari Google Drive.");
  }

  const data = await res.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

// Upload JSON database backup or exported file to Google Drive using multipart upload
export async function uploadJsonToDrive(params: {
  fileName: string;
  data: any;
  folderId?: string;
  description?: string;
}): Promise<GoogleDriveFile> {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Tidak ada token otorisasi Google Drive");

  let targetFolderId = params.folderId;
  if (!targetFolderId) {
    try {
      targetFolderId = await findOrCreateAppFolder(DEFAULT_FOLDER_NAME);
    } catch (e) {
      console.warn("Could not find or create default folder, uploading to root:", e);
    }
  }

  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: "application/json",
    description: params.description || "Cadangan CBT GusthyPalinPatandaExam",
  };

  if (targetFolderId) {
    metadata.parents = [targetFolderId];
  }

  const boundary = "-------GPP_CBT_DRIVE_BOUNDARY_" + Date.now();
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const contentStr = typeof params.data === "string" ? params.data : JSON.stringify(params.data, null, 2);

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    contentStr +
    closeDelimiter;

  const res = await fetch(`${DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal mengunggah berkas ke Google Drive.");
  }

  return await res.json();
}

// Upload any text/CSV/string file to Google Drive
export async function uploadTextToDrive(params: {
  fileName: string;
  content: string;
  mimeType: string;
  folderId?: string;
  description?: string;
}): Promise<GoogleDriveFile> {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Tidak ada token otorisasi Google Drive");

  let targetFolderId = params.folderId;
  if (!targetFolderId) {
    try {
      targetFolderId = await findOrCreateAppFolder(DEFAULT_FOLDER_NAME);
    } catch {}
  }

  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: params.mimeType,
    description: params.description || "Ekspor Berkas CBT",
  };

  if (targetFolderId) {
    metadata.parents = [targetFolderId];
  }

  const boundary = "-------GPP_CBT_TEXT_BOUNDARY_" + Date.now();
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${params.mimeType}\r\n\r\n` +
    params.content +
    closeDelimiter;

  const res = await fetch(`${DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal mengunggah berkas ke Google Drive.");
  }

  return await res.json();
}

// Download file content from Google Drive
export async function downloadFileContent(fileId: string): Promise<string> {
  const headers = getAuthHeaders();
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers,
  });

  if (!res.ok) {
    throw new Error("Gagal mengunduh isi berkas dari Google Drive.");
  }

  return await res.text();
}

// Delete file from Google Drive (MUST be preceded by explicit user confirmation modal)
export async function deleteDriveFile(fileId: string): Promise<void> {
  const headers = getAuthHeaders();
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal menghapus berkas di Google Drive.");
  }
}
