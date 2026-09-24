import { useState, useEffect, useCallback, useRef } from "react";
import {
  Student,
  TeacherOrAdmin,
  Question,
  QuestionRevision,
  ExamConfig,
  ViolationRecord,
  Role,
  BackupFileInfo,
  isSampleStudent,
  isExamClassActive,
} from "../types";
import {
  INITIAL_STUDENTS,
  INITIAL_ADMINS,
  INITIAL_QUESTIONS,
  INITIAL_EXAM_CONFIG,
} from "../data/initialData";
import {
  parseStudentScanPayload,
  generateUniqueStudentToken,
  ensureUniqueStudentTokens,
} from "../utils/barcodeUtils";
import { storageEngine } from "../utils/storageEngine";
import { generateSimulationStudents } from "../utils/studentGenerator";
import { safeStorage } from "../utils/safeStorage";
import {
  deduplicateStudents,
  mergeImportedStudents,
  normalizeNisn,
  normalizeClassKey,
  normalizeNameKey,
} from "../utils/studentDeduplicator";
import { db } from "../firebaseConfig";
import { enqueueStudentAutoSync } from "../services/googleSheetsService";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";

const STORAGE_KEYS = {
  CURRENT_USER: "GPP_EXAM_CURRENT_USER_V1",
};

// Helper: Ensure objects are compatible with Firestore (strip undefined -> null)
function cleanForFirestore<T>(data: T): any {
  if (data === undefined) return null;
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value === undefined ? null : value))
  );
}

// Helper: Batch commit operations handling Firestore 500-op limit
async function commitBatchOperations(
  operations: Array<{
    type: "set" | "delete";
    ref: any;
    data?: any;
    options?: any;
  }>
) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === "set") {
        batch.set(op.ref, op.data, op.options || {});
      } else if (op.type === "delete") {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

// Background sync to server disk database (/api/data)
async function syncToServerDb(payload: {
  students?: Student[];
  questions?: Question[];
  examConfig?: ExamConfig;
  staffUsers?: TeacherOrAdmin[];
  label?: string;
}) {
  try {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Non-blocking server sync
  }
}

export function useExamStore() {
  const [firebaseStatus, setFirebaseStatus] = useState<"connected" | "connecting" | "error">("connecting");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [hasAdminCustomData, setHasAdminCustomData] = useState<boolean>(true);

  // 1. Staff (Admins & Teachers)
  const [staffUsers, setStaffUsers] = useState<TeacherOrAdmin[]>(INITIAL_ADMINS);

  // 2. Students - Firestore Collection 'students' (Initialized with complete master dataset to ensure no class is empty)
  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const raw = safeStorage.getItem("GPP_EXAM_STUDENTS_V1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with INITIAL_STUDENTS (321 students) to ensure classes with 0 students are immediately populated
          const pool = [...parsed, ...INITIAL_STUDENTS];
          const { unique } = deduplicateStudents(pool);
          const { students: cleanStudents } = ensureUniqueStudentTokens(unique);
          return cleanStudents;
        }
      }
    } catch {}
    const { unique } = deduplicateStudents(INITIAL_STUDENTS);
    const { students: cleanStudents } = ensureUniqueStudentTokens(unique);
    return cleanStudents;
  });

  // 3. Questions - Firestore Collection 'questions'
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);

  // 4. Exam Config - Firestore Document 'settings/examConfig'
  const [examConfig, setExamConfig] = useState<ExamConfig>(INITIAL_EXAM_CONFIG);

  // 5. Custom Registered Classes - Firestore Document 'settings/classes' (Preserved permanently)
  const [customClasses, setCustomClasses] = useState<string[]>(() => {
    const defaultClasses = Array.from(
      new Set(INITIAL_STUDENTS.map((s) => (s?.className || "").trim()).filter(Boolean))
    ).sort();

    try {
      const saved = safeStorage.getItem("gpp_registered_classes");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...defaultClasses, ...parsed])).sort();
        }
      }
    } catch {}
    return defaultClasses;
  });

  // Current session user (cached locally for tab refresh continuity)
  const [currentUser, setCurrentUser] = useState<Student | TeacherOrAdmin | null>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (saved) return JSON.parse(saved);
    } catch {
      return null;
    }
    return null;
  });

  // Exam execution state
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string | number>>({});
  const [activeViolations, setActiveViolations] = useState<ViolationRecord[]>([]);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  // Save current user session to safeStorage
  useEffect(() => {
    if (currentUser) {
      safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      safeStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  // Keep local fast-access storage in sync with students
  useEffect(() => {
    if (students && students.length > 0) {
      storageEngine.saveStudentsAsync(students);
      try {
        safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(students));
      } catch {}
    }
  }, [students]);

  // Keep registered classes synced to safeStorage
  useEffect(() => {
    if (customClasses && customClasses.length > 0) {
      try {
        safeStorage.setItem("gpp_registered_classes", JSON.stringify(customClasses));
      } catch {}
    }
  }, [customClasses]);

  // =========================================================================
  // FIREBASE INITIALIZATION & REAL-TIME LISTENERS
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    async function initAndSubscribeFirebase() {
      try {
        setFirebaseStatus("connecting");

        // Check if database metadata exists; if not, check existing data before seeding
        const metaRef = doc(db, "settings", "metadata");
        const metaSnap = await getDoc(metaRef);

        // Check if students collection in Firestore already contains documents
        const existingStudentsSnap = await getDocs(collection(db, "students"));
        const existingStudentCount = existingStudentsSnap.size;

        // Fetch server persistent database (/api/data) to ensure no records on disk are missed
        let serverStudents: Student[] = [];
        try {
          const apiRes = await fetch("/api/data");
          if (apiRes.ok) {
            const apiJson = await apiRes.json();
            if (apiJson.data?.students && Array.isArray(apiJson.data.students) && apiJson.data.students.length > 0) {
              serverStudents = apiJson.data.students;
            }
          }
        } catch (e) {
          console.warn("[Firebase] Could not fetch server database on init:", e);
        }

        // Only seed initial students if Firestore is completely empty (0 documents)
        if (existingStudentCount === 0 && (!metaSnap.exists() || !metaSnap.data()?.initialized)) {
          console.log(`[Firebase] Firestore students collection is empty. Initializing master dataset...`);
          setIsSyncing(true);

          const sourceStudents = serverStudents.length > 0 ? serverStudents : INITIAL_STUDENTS;
          const { unique: cleanInitial } = deduplicateStudents(sourceStudents);
          const sOps = cleanInitial.map((s) => ({
            type: "set" as const,
            ref: doc(db, "students", s.id),
            data: cleanForFirestore(s),
            options: { merge: true },
          }));
          await commitBatchOperations(sOps);

          // Seed Classes list in Firestore
          const initialClassList = Array.from(
            new Set(cleanInitial.map((s) => (s?.className || "").trim()).filter(Boolean))
          ).sort();
          await setDoc(doc(db, "settings", "classes"), { list: initialClassList }, { merge: true });

          // Seed Config if not present
          const cfgSnap = await getDoc(doc(db, "settings", "examConfig"));
          if (!cfgSnap.exists()) {
            await setDoc(doc(db, "settings", "examConfig"), cleanForFirestore(INITIAL_EXAM_CONFIG));
          }

          // Seed Staff if not present
          const staffSnap = await getDoc(doc(db, "settings", "staff"));
          if (!staffSnap.exists()) {
            await setDoc(doc(db, "settings", "staff"), { list: cleanForFirestore(INITIAL_ADMINS) });
          }

          // Seed Questions if not present
          const qSnap = await getDocs(collection(db, "questions"));
          if (qSnap.empty) {
            const qOps = INITIAL_QUESTIONS.map((q) => ({
              type: "set" as const,
              ref: doc(db, "questions", q.id),
              data: cleanForFirestore(q),
            }));
            await commitBatchOperations(qOps);
          }

          // Mark as Initialized
          await setDoc(metaRef, {
            initialized: true,
            version: 5,
            syncedAt: new Date().toISOString(),
          }, { merge: true });

          setIsSyncing(false);
        } else {
          console.log("[Firebase] Existing student master data detected. Checking synchronization with server database...");
          // If server database has students missing from Firestore, sync them to Firestore immediately
          if (serverStudents.length > 0) {
            const existingFsIds = new Set(existingStudentsSnap.docs.map((d) => d.id));
            const missingFromServer = serverStudents.filter((s) => !existingFsIds.has(s.id));
            if (missingFromServer.length > 0) {
              console.log(`[Firebase] Syncing ${missingFromServer.length} missing students from server database to Firestore...`);
              const missingOps = missingFromServer.map((s) => ({
                type: "set" as const,
                ref: doc(db, "students", s.id),
                data: cleanForFirestore(s),
                options: { merge: true },
              }));
              await commitBatchOperations(missingOps);
            }

            // Sync registered classes
            const allAvailableClasses = Array.from(
              new Set([
                ...serverStudents.map((s) => (s?.className || "").trim()).filter(Boolean),
                ...existingStudentsSnap.docs.map((d) => (d.data()?.className || "").trim()).filter(Boolean),
              ])
            ).sort();
            if (allAvailableClasses.length > 0) {
              await setDoc(doc(db, "settings", "classes"), { list: allAvailableClasses }, { merge: true });
              if (isMounted) {
                setCustomClasses(allAvailableClasses);
              }
            }
          }

          await setDoc(metaRef, {
            initialized: true,
            version: 5,
            preservedAt: new Date().toISOString(),
          }, { merge: true });
        }

        // =====================================================================
        // Real-Time Listener 1: Students Collection
        // =====================================================================
        const unsubStudents = onSnapshot(
          collection(db, "students"),
          (snapshot) => {
            if (!isMounted) return;
            const fetchedStudents: Student[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Student;
              fetchedStudents.push({ ...data, id: data.id || docSnap.id });
            });

            if (fetchedStudents.length > 0) {
              // Deduplicate fetched students to guarantee uniqueness across all classes
              const { unique } = deduplicateStudents(fetchedStudents);

              // Guarantee 100% unique barcode tokens across all students (no duplicate tokens)
              const { students: cleanStudents, fixedCount } = ensureUniqueStudentTokens(unique);

              // Sort by class and name
              cleanStudents.sort((a, b) => {
                const cCmp = (a.className || "").localeCompare(b.className || "");
                if (cCmp !== 0) return cCmp;
                return (a.name || "").localeCompare(b.name || "");
              });

              setStudents((prev) => {
                // Merge fetched students with previously loaded students so classes are NEVER blank or lost
                const pool = [...prev, ...cleanStudents];
                const { unique: mergedUnique } = deduplicateStudents(pool);
                const { students: mergedClean } = ensureUniqueStudentTokens(mergedUnique);
                mergedClean.sort((a, b) => {
                  const cCmp = (a.className || "").localeCompare(b.className || "");
                  if (cCmp !== 0) return cCmp;
                  return (a.name || "").localeCompare(b.name || "");
                });
                safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(mergedClean));
                storageEngine.saveStudentsAsync(mergedClean).catch(() => {});
                return mergedClean;
              });

              // Ensure all available classes from students are registered in customClasses
              const derivedClasses = Array.from(
                new Set(cleanStudents.map((s) => (s?.className || "").trim()).filter(Boolean))
              ).sort();
              if (derivedClasses.length > 0) {
                setCustomClasses((prev) => Array.from(new Set([...prev, ...derivedClasses])).sort());
              }

              // Auto-Sync Real-Time to Google Drive Spreadsheet if changes contain completed exam
              try {
                snapshot.docChanges().forEach((change) => {
                  if (change.type === "added" || change.type === "modified") {
                    const st = change.doc.data() as Student;
                    if (st && (st.examStatus === "submitted" || st.examStatus === "disqualified")) {
                      enqueueStudentAutoSync(st, examConfig.passingScore, examConfig.title);
                    }
                  }
                });
              } catch (autoErr) {
                console.warn("[AutoSync Drive] Snapshot listener warning:", autoErr);
              }

              // Synchronize active student session in real time with Firestore doc
              setCurrentUser((curr) => {
                if (curr && curr.role === "siswa") {
                  const updatedStudentDoc = cleanStudents.find((s) => s.id === curr.id);
                  if (updatedStudentDoc) {
                    if (updatedStudentDoc.examStatus === "not_started") {
                      setExamStarted(false);
                      setExamSubmitted(false);
                      setIsDisqualified(false);
                      setStudentAnswers({});
                      setActiveViolations([]);
                    } else if (updatedStudentDoc.examStatus === "submitted") {
                      setExamStarted(false);
                      setExamSubmitted(true);
                      setIsDisqualified(false);
                    } else if (updatedStudentDoc.examStatus === "disqualified") {
                      setExamStarted(false);
                      setExamSubmitted(true);
                      setIsDisqualified(true);
                    }
                    return updatedStudentDoc;
                  }
                }
                return curr;
              });

              // If any duplicate tokens were repaired, persist the fixed tokens to Firestore
              if (fixedCount > 0) {
                const fixOps = cleanStudents
                  .filter((s) => s.startBarcodeToken)
                  .map((s) => ({
                    type: "set" as const,
                    ref: doc(db, "students", s.id),
                    data: cleanForFirestore({ startBarcodeToken: s.startBarcodeToken }),
                    options: { merge: true },
                  }));
                commitBatchOperations(fixOps).catch((err) =>
                  console.warn("[Firebase] Auto-repaired duplicate tokens notice:", err)
                );
              }
            }
            setFirebaseStatus("connected");
            setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
          },
          (err) => {
            console.warn("[Firebase] Students onSnapshot notice:", err);
            setFirebaseStatus("error");
          }
        );

        // =====================================================================
        // Real-Time Listener 2: Questions Collection
        // =====================================================================
        const unsubQuestions = onSnapshot(
          collection(db, "questions"),
          (snapshot) => {
            if (!isMounted) return;
            const fetchedQuestions: Question[] = [];
            snapshot.forEach((docSnap) => {
              const q = docSnap.data() as Question;
              fetchedQuestions.push({ ...q, id: q.id || docSnap.id });
            });
            if (fetchedQuestions.length > 0) {
              fetchedQuestions.sort((a, b) => {
                const numA = parseInt((a.id || "").replace(/\D/g, ""), 10);
                const numB = parseInt((b.id || "").replace(/\D/g, ""), 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return (a.id || "").localeCompare(b.id || "");
              });
              setQuestions(fetchedQuestions);
            }
            setFirebaseStatus("connected");
            setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
          },
          (err) => {
            console.warn("[Firebase] Questions onSnapshot notice:", err);
          }
        );

        // =====================================================================
        // Real-Time Listener 3: Exam Config Document
        // =====================================================================
        const unsubConfig = onSnapshot(
          doc(db, "settings", "examConfig"),
          (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
              const data = docSnap.data() as ExamConfig;
              setExamConfig((prev) => ({
                ...INITIAL_EXAM_CONFIG,
                ...prev,
                ...data,
              }));
              setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
            }
          },
          (err) => {
            console.warn("[Firebase] Config onSnapshot notice:", err);
          }
        );

        // =====================================================================
        // Real-Time Listener 4: Classes Document
        // =====================================================================
        const unsubClasses = onSnapshot(
          doc(db, "settings", "classes"),
          (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (Array.isArray(data?.list)) {
                setCustomClasses(data.list);
              }
            }
          },
          (err) => {
            console.warn("[Firebase] Classes onSnapshot notice:", err);
          }
        );

        // =====================================================================
        // Real-Time Listener 5: Staff Document
        // =====================================================================
        const unsubStaff = onSnapshot(
          doc(db, "settings", "staff"),
          (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (Array.isArray(data?.list) && data.list.length > 0) {
                setStaffUsers(data.list);
              }
            }
          },
          (err) => {
            console.warn("[Firebase] Staff onSnapshot notice:", err);
          }
        );

        return () => {
          unsubStudents();
          unsubQuestions();
          unsubConfig();
          unsubClasses();
          unsubStaff();
        };
      } catch (err) {
        console.error("[Firebase] Initialization error:", err);
        setFirebaseStatus("error");
      }
    }

    const cleanupPromise = initAndSubscribeFirebase();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, []);

  // Synchronize student session details if logged in as student
  useEffect(() => {
    if (currentUser && currentUser.role === "siswa") {
      const match = students.find((s) => s.id === currentUser.id);
      if (match) {
        if (match.answers && Object.keys(match.answers).length > 0) {
          setStudentAnswers(match.answers);
        }
        setActiveViolations(match.violationsLog || []);
        if (match.examStatus === "submitted" || match.examStatus === "disqualified") {
          setExamSubmitted(true);
          setExamStarted(false);
          setIsDisqualified(match.examStatus === "disqualified");
        } else if (match.examStatus === "in_progress") {
          setExamStarted(true);
        }
      }
    }
  }, [currentUser?.id, students]);

  // =========================================================================
  // AUTHENTICATION & BARCODE LOGIN
  // =========================================================================
  const login = useCallback(
    (identifier: string, pass: string, role: Role): { success: boolean; message?: string } => {
      if (role === "admin" || role === "guru") {
        const adminFound = staffUsers.find(
          (a) =>
            a.role === role &&
            (a.username.toLowerCase() === identifier.toLowerCase() ||
              a.email.toLowerCase() === identifier.toLowerCase())
        );

        if (adminFound && (!adminFound.password || adminFound.password === pass)) {
          setCurrentUser(adminFound);
          return { success: true };
        }
        return { success: false, message: "Kombinasi username atau password salah!" };
      }

      // Siswa login
      const studentIndex = students.findIndex(
        (s) =>
          s.username.toLowerCase() === identifier.toLowerCase() ||
          s.nisn === identifier ||
          s.startBarcodeToken.toLowerCase() === identifier.toLowerCase()
      );

      if (studentIndex === -1) {
        return { success: false, message: "Siswa dengan NISN / Username tersebut tidak ditemukan!" };
      }

      const student = students[studentIndex];

      // Check if student's class is active for this exam
      if (!isExamClassActive(examConfig, student.className)) {
        return {
          success: false,
          message: `AKSES UJIAN DITUTUP: Kelas "${student.className}" saat ini sedang DINONAKTIFKAN untuk sesi ujian ini oleh Guru / Admin. Silakan hubungi proktor/pengawas ujian jika kelas Anda seharusnya dijadwalkan.`,
        };
      }

      if (student.password && student.password !== pass) {
        return { success: false, message: "Password siswa salah!" };
      }

      // Single-Login Constraint
      if (student.isLocked || student.loginCount >= 1) {
        return {
          success: false,
          message:
            "AKUN TERKUNCI: Siswa hanya diizinkan login 1 KALI. Anda sudah pernah login sebelumnya. Silakan lapor ke Admin / Pengawas untuk mereset status login Anda!",
        };
      }

      if (student.examStatus === "submitted" || student.examStatus === "disqualified") {
        return {
          success: false,
          message: "Ujian untuk akun ini sudah selesai / disubmit. Tidak dapat login kembali.",
        };
      }

      const updatedStudent: Student = {
        ...student,
        loginCount: student.loginCount + 1,
        isLocked: true,
      };

      setStudents((prev) => {
        const copy = [...prev];
        copy[studentIndex] = updatedStudent;
        return copy;
      });

      setCurrentUser(updatedStudent);

      // Restore active exam progress and answers from Firestore student document
      if (student.answers) {
        setStudentAnswers(student.answers);
      } else {
        setStudentAnswers({});
      }
      if (student.violationsLog && student.violationsLog.length > 0) {
        setActiveViolations(student.violationsLog);
      } else {
        setActiveViolations([]);
      }
      if (student.examStatus === "in_progress") {
        setExamStarted(true);
      }

      // Persist lock status to Firebase Firestore
      setDoc(
        doc(db, "students", updatedStudent.id),
        cleanForFirestore({ loginCount: updatedStudent.loginCount, isLocked: true }),
        { merge: true }
      ).catch((err) => console.warn("[Firebase] Student lock update notice:", err));

      return { success: true };
    },
    [students, examConfig, staffUsers]
  );

  const loginWithBarcode = useCallback(
    (barcodeData: string): { success: boolean; message?: string } => {
      const parsed = parseStudentScanPayload(barcodeData);
      const cleanData = (parsed.token || parsed.raw || "").trim();

      // Priority 1: Exact Student ID match (Guaranteed unique per student record)
      let studentIndex = -1;
      if (parsed.id) {
        studentIndex = students.findIndex(
          (s) => s.id.toLowerCase() === parsed.id.toLowerCase()
        );
      }

      // Priority 2: Exact startBarcodeToken match
      if (studentIndex === -1 && (parsed.token || cleanData)) {
        const tokenToFind = (parsed.token || cleanData).toLowerCase();
        const tokenMatches: number[] = [];
        students.forEach((s, idx) => {
          if (s.startBarcodeToken && s.startBarcodeToken.toLowerCase() === tokenToFind) {
            tokenMatches.push(idx);
          }
        });

        if (tokenMatches.length === 1) {
          studentIndex = tokenMatches[0];
        } else if (tokenMatches.length > 1) {
          // If multiple students share the token, disambiguate by class first
          if (parsed.className) {
            const classMatch = tokenMatches.find(
              (idx) =>
                students[idx].className.toLowerCase() === parsed.className.toLowerCase()
            );
            if (classMatch !== undefined) studentIndex = classMatch;
          }
          // Disambiguate by active exam class
          if (studentIndex === -1) {
            const activeMatch = tokenMatches.find((idx) =>
              isExamClassActive(examConfig, students[idx].className)
            );
            if (activeMatch !== undefined) studentIndex = activeMatch;
          }
          if (studentIndex === -1) studentIndex = tokenMatches[0];
        }
      }

      // Priority 3: Match by NISN
      if (studentIndex === -1 && parsed.nisn) {
        const nisnMatches: number[] = [];
        students.forEach((s, idx) => {
          if (s.nisn === parsed.nisn) {
            nisnMatches.push(idx);
          }
        });

        if (nisnMatches.length === 1) {
          studentIndex = nisnMatches[0];
        } else if (nisnMatches.length > 1) {
          if (parsed.className) {
            const classMatch = nisnMatches.find(
              (idx) =>
                students[idx].className.toLowerCase() === parsed.className.toLowerCase()
            );
            if (classMatch !== undefined) studentIndex = classMatch;
          }
          if (studentIndex === -1) {
            const activeMatch = nisnMatches.find((idx) =>
              isExamClassActive(examConfig, students[idx].className)
            );
            if (activeMatch !== undefined) studentIndex = activeMatch;
          }
          if (studentIndex === -1) studentIndex = nisnMatches[0];
        }
      }

      // Priority 4: Fallback match by raw data (id, startBarcodeToken, or nisn)
      if (studentIndex === -1 && cleanData) {
        const rawMatches: number[] = [];
        students.forEach((s, idx) => {
          if (
            s.id.toLowerCase() === cleanData.toLowerCase() ||
            s.startBarcodeToken.toLowerCase() === cleanData.toLowerCase() ||
            s.nisn === cleanData
          ) {
            rawMatches.push(idx);
          }
        });

        if (rawMatches.length === 1) {
          studentIndex = rawMatches[0];
        } else if (rawMatches.length > 1) {
          const activeMatch = rawMatches.find((idx) =>
            isExamClassActive(examConfig, students[idx].className)
          );
          studentIndex = activeMatch !== undefined ? activeMatch : rawMatches[0];
        }
      }

      if (studentIndex === -1) {
        return {
          success: false,
          message: "Barcode / QR tidak valid atau data siswa tidak terdaftar dalam sistem.",
        };
      }

      const student = students[studentIndex];

      if (!isExamClassActive(examConfig, student.className)) {
        return {
          success: false,
          message: `AKSES UJIAN DITUTUP: Kelas "${student.className}" saat ini sedang DINONAKTIFKAN untuk sesi ujian ini oleh Guru / Admin. Silakan hubungi proktor/pengawas ujian jika kelas Anda seharusnya dijadwalkan.`,
        };
      }

      if (student.isLocked || student.loginCount >= 1) {
        return {
          success: false,
          message:
            `AKUN TERKUNCI (${student.name}): Barcode ini sudah pernah digunakan untuk login. Hubungi Admin/Proktor untuk mereset izin login Anda.`,
        };
      }

      const updatedStudent: Student = {
        ...student,
        loginCount: student.loginCount + 1,
        isLocked: true,
      };

      setStudents((prev) => {
        const copy = [...prev];
        copy[studentIndex] = updatedStudent;
        return copy;
      });

      setCurrentUser(updatedStudent);

      // Restore active exam progress and answers from Firestore student document
      if (student.answers) {
        setStudentAnswers(student.answers);
      } else {
        setStudentAnswers({});
      }
      if (student.violationsLog && student.violationsLog.length > 0) {
        setActiveViolations(student.violationsLog);
      } else {
        setActiveViolations([]);
      }
      if (student.examStatus === "in_progress") {
        setExamStarted(true);
      } else if (student.examStatus === "submitted") {
        setExamStarted(false);
        setExamSubmitted(true);
      } else if (student.examStatus === "disqualified") {
        setExamStarted(false);
        setExamSubmitted(true);
        setIsDisqualified(true);
      }

      // Persist lock status to Firebase Firestore
      setDoc(
        doc(db, "students", updatedStudent.id),
        cleanForFirestore({ loginCount: updatedStudent.loginCount, isLocked: true }),
        { merge: true }
      ).catch((err) => console.warn("[Firebase] Barcode lock update notice:", err));

      return { success: true };
    },
    [students, examConfig]
  );

  const resetStudentLogin = useCallback(async (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          return {
            ...s,
            isLocked: false,
            loginCount: 0,
            examStatus: s.examStatus === "disqualified" ? "not_started" : s.examStatus,
            violationsCount: 0,
            violationsLog: [],
          };
        }
        return s;
      })
    );

    try {
      await setDoc(
        doc(db, "students", studentId),
        cleanForFirestore({
          isLocked: false,
          loginCount: 0,
          violationsCount: 0,
          violationsLog: [],
        }),
        { merge: true }
      );
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error resetting student login:", err);
    }
  }, []);

  const resetMultipleStudentsLogin = useCallback(async (studentIds: string[]) => {
    if (!studentIds || studentIds.length === 0) return;
    const idsSet = new Set(studentIds);
    setStudents((prev) =>
      prev.map((s) => {
        if (idsSet.has(s.id)) {
          return {
            ...s,
            isLocked: false,
            loginCount: 0,
            examStatus: s.examStatus === "disqualified" ? "not_started" : s.examStatus,
            violationsCount: 0,
            violationsLog: [],
          };
        }
        return s;
      })
    );

    try {
      const ops = studentIds.map((id) => ({
        type: "set" as const,
        ref: doc(db, "students", id),
        data: cleanForFirestore({
          isLocked: false,
          loginCount: 0,
          violationsCount: 0,
          violationsLog: [],
        }),
        options: { merge: true },
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error resetting multiple students login:", err);
    }
  }, []);

  const resetAllStudentsLogin = useCallback(async () => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        isLocked: false,
        loginCount: 0,
        examStatus: "not_started",
        violationsCount: 0,
        violationsLog: [],
        mcqScore: 0,
        essayScore: 0,
        totalScore: 0,
        answers: {},
      }))
    );

    try {
      const ops = students.map((s) => ({
        type: "set" as const,
        ref: doc(db, "students", s.id),
        data: cleanForFirestore({
          isLocked: false,
          loginCount: 0,
          examStatus: "not_started",
          violationsCount: 0,
          violationsLog: [],
          mcqScore: 0,
          essayScore: 0,
          totalScore: 0,
          answers: {},
        }),
        options: { merge: true },
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error resetting all student logins:", err);
    }
  }, [students]);

  // =========================================================================
  // EXAM RUNTIME & RESULTS IN FIREBASE FIRESTORE
  // =========================================================================
  const startExamWithBarcode = useCallback(
    (barcodeInput: string): { success: boolean; message?: string } => {
      if (!currentUser || currentUser.role !== "siswa") {
        return { success: false, message: "Hanya siswa yang dapat memulai ujian." };
      }

      const currentStudent = currentUser as Student;

      if (!isExamClassActive(examConfig, currentStudent.className)) {
        return {
          success: false,
          message: `AKSES UJIAN DITUTUP: Kelas "${currentStudent.className}" saat ini sedang DINONAKTIFKAN untuk sesi ujian ini oleh Guru / Admin.`,
        };
      }

      const parsed = parseStudentScanPayload(barcodeInput);
      const cleanInput = (parsed.token || parsed.id || parsed.nisn || parsed.raw || barcodeInput || "").trim().toLowerCase();
      const rawLower = (barcodeInput || "").trim().toLowerCase();

      const validTokens = [
        (examConfig.gateToken || "").toLowerCase().trim(),
        (currentStudent.startBarcodeToken || "").toLowerCase().trim(),
        (currentStudent.nisn || "").toLowerCase().trim(),
        (currentStudent.id || "").toLowerCase().trim(),
        (currentStudent.username || "").toLowerCase().trim(),
      ].filter(Boolean);

      const isMatch =
        validTokens.includes(cleanInput) ||
        validTokens.includes(rawLower) ||
        (parsed.token && validTokens.includes(parsed.token.toLowerCase().trim())) ||
        (parsed.id && validTokens.includes(parsed.id.toLowerCase().trim())) ||
        (parsed.nisn && validTokens.includes(parsed.nisn.toLowerCase().trim()));

      if (!isMatch) {
        return {
          success: false,
          message:
            "Barcode / Kode Token Tidak Cocok! Pastikan Anda memindai Barcode Ujian yang tertera pada Kartu Ujian Anda atau Token Ujian yang diberikan Pengawas.",
        };
      }

      const updatedStudent: Student = {
        ...currentStudent,
        examStatus: "in_progress",
        startedAt: new Date().toISOString(),
      };

      setExamStarted(true);
      setCurrentUser(updatedStudent);
      setStudents((prev) => prev.map((s) => (s.id === currentStudent.id ? updatedStudent : s)));

      // Save start status to Firebase Firestore
      setDoc(
        doc(db, "students", currentStudent.id),
        cleanForFirestore({ examStatus: "in_progress", startedAt: updatedStudent.startedAt }),
        { merge: true }
      ).catch((err) => console.warn("[Firebase] Error saving exam start:", err));

      return { success: true };
    },
    [currentUser, examConfig]
  );

  const recordAnswer = useCallback(
    (questionId: string, answer: string | number) => {
      setStudentAnswers((prev) => {
        const next = { ...prev, [questionId]: answer };
        if (currentUser && currentUser.role === "siswa") {
          setCurrentUser((curr) => (curr ? ({ ...curr, answers: next } as Student) : null));
          setStudents((all) =>
            all.map((s) => (s.id === currentUser.id ? { ...s, answers: next } : s))
          );
          // Immediately sync answer to Firebase Firestore
          setDoc(
            doc(db, "students", currentUser.id),
            cleanForFirestore({ answers: next }),
            { merge: true }
          ).catch((err) => console.warn("[Firebase] Error syncing student answer:", err));
        }
        return next;
      });
    },
    [currentUser]
  );

  const submitExam = useCallback(
    async (reason?: string, forceDisqualify: boolean = false) => {
      if (!currentUser || currentUser.role !== "siswa" || examSubmitted) return;

      const currentStudent = currentUser as Student;
      setIsGrading(true);

      // Automated evaluation
      let mcqTotal = 0;
      let mcqMax = 0;
      let essayTotal = 0;
      let essayMax = 0;
      const essayEvaluations: Record<string, any> = {};

      questions.forEach((q) => {
        const studentAns = studentAnswers[q.id];

        if (q.type === "mcq") {
          mcqMax += q.points;
          if (
            studentAns !== undefined &&
            (studentAns === q.correctAnswer ||
              String(studentAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase())
          ) {
            mcqTotal += q.points;
          }
        } else if (q.type === "true_false") {
          mcqMax += q.points;
          if (studentAns !== undefined && String(studentAns) === String(q.correctBool)) {
            mcqTotal += q.points;
          }
        } else if (q.type === "matching") {
          mcqMax += q.points;
          const pairMap = typeof studentAns === "object" && studentAns !== null ? (studentAns as Record<string | number, string>) : null;
          if (q.matchingPairs && q.matchingPairs.length > 0 && pairMap) {
            let correctMatches = 0;
            q.matchingPairs.forEach((pair, idx) => {
              if (pairMap[idx] === pair.right) {
                correctMatches++;
              }
            });
            const partial = Math.round((correctMatches / q.matchingPairs.length) * q.points);
            mcqTotal += partial;
          }
        } else if (q.type === "multi_choice") {
          mcqMax += q.points;
          const userChoices: number[] = Array.isArray(studentAns) ? studentAns : [];
          const correctKeys: number[] = q.correctAnswers || [];
          if (userChoices.length > 0 && correctKeys.length > 0) {
            const isMatch =
              userChoices.length === correctKeys.length &&
              userChoices.every((val) => correctKeys.includes(val));
            if (isMatch) {
              mcqTotal += q.points;
            } else {
              const truePositives = userChoices.filter((c) => correctKeys.includes(c)).length;
              const falsePositives = userChoices.filter((c) => !correctKeys.includes(c)).length;
              const netScore = Math.max(0, truePositives - falsePositives);
              mcqTotal += Math.round((netScore / correctKeys.length) * q.points);
            }
          }
        } else if (q.type === "short_answer") {
          mcqMax += q.points;
          const userStr = String(studentAns || "").trim().toLowerCase();
          const targetStr = String(q.keyAnswer || "").trim().toLowerCase();
          if (userStr && targetStr && userStr === targetStr) {
            mcqTotal += q.points;
          }
        } else if (q.type === "essay") {
          essayMax += q.points;
          const textAns = String(studentAns || "").trim();
          let scoreGiven = 0;
          let feedback = "";

          const rubricCfg = examConfig.aiRubricConfig || {
            strictnessMode: "balanced",
            typoTolerance: "medium",
            reasoningWeight: 50,
            penalizeLengthDeviation: true,
          };

          if (!textAns) {
            scoreGiven = 0;
            feedback = "Tidak dijawab.";
          } else if (textAns.length < 15 && rubricCfg.penalizeLengthDeviation) {
            scoreGiven = Math.round(q.points * 0.25);
            feedback = "Jawaban terlalu singkat, belum menguraikan konsep secara komprehensif.";
          } else {
            const sampleKeywords = ((q as any).sampleAnswer || q.keyAnswer || q.question || "")
              .toLowerCase()
              .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
              .split(/\s+/)
              .filter((w) => w.length > 3);

            let matchedCount = 0;
            sampleKeywords.forEach((kw) => {
              if (textAns.toLowerCase().includes(kw)) matchedCount++;
            });

            if (rubricCfg.strictnessMode === "strict_keyword") {
              // Ketat Berbasis Kata Kunci: Menuntut keberadaan istilah kunci esensial
              const ratio = sampleKeywords.length > 0 ? matchedCount / sampleKeywords.length : 0.5;
              scoreGiven = Math.round(ratio * q.points);
              feedback =
                ratio >= 0.65
                  ? "Penilaian Ketat: Kata kunci esensial dan terminologi baku tercakup."
                  : "Penilaian Ketat: Sebagian kata kunci pokok belum disebutkan.";
            } else if (rubricCfg.strictnessMode === "flexible_semantic") {
              // Fleksibel Berbasis Esensi Makna: Mengapresiasi pemahaman substansial
              const lengthFactor = Math.min(1, textAns.length / 50);
              const semanticScore = Math.max(0.7, (matchedCount > 0 ? 0.95 : 0.75) * lengthFactor);
              scoreGiven = Math.round(semanticScore * q.points);
              feedback = "Penilaian Fleksibel: Esensi pemahaman materi teruraikan dengan baik.";
            } else {
              // Standar Berimbang
              if (sampleKeywords.length > 0 && matchedCount >= 2) {
                scoreGiven = Math.round(q.points * 0.95);
                feedback = "Penjelasan relevan dan mencakup poin penting materi.";
              } else {
                scoreGiven = Math.round(q.points * 0.7);
                feedback = "Jawaban memadai dan memenuhi konsep dasar.";
              }
            }
          }

          essayTotal += scoreGiven;
          essayEvaluations[q.id] = {
            score: scoreGiven,
            maxScore: q.points,
            feedback,
          };
        }
      });

      const totalPossible = mcqMax + essayMax || 100;
      const rawScore = mcqTotal + essayTotal;
      const finalScaledScore = Math.min(100, Math.round((rawScore / totalPossible) * 100));

      const status: "submitted" | "disqualified" = forceDisqualify ? "disqualified" : "submitted";

      const updatedStudent: Student = {
        ...currentStudent,
        mcqScore: mcqTotal,
        essayScore: essayTotal,
        totalScore: forceDisqualify ? Math.min(finalScaledScore, 30) : finalScaledScore,
        examStatus: status,
        submittedAt: new Date().toISOString(),
        answers: studentAnswers,
        essayEvaluations,
      };

      setStudents((prev) =>
        prev.map((s) => (s.id === currentStudent.id ? updatedStudent : s))
      );

      setCurrentUser(updatedStudent);
      setExamStarted(false);
      setExamSubmitted(true);
      setIsDisqualified(forceDisqualify);
      setIsGrading(false);

      // Save complete exam results to Firebase Firestore
      try {
        await setDoc(
          doc(db, "students", currentStudent.id),
          cleanForFirestore(updatedStudent),
          { merge: true }
        );
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
        // Trigger Real-Time Google Drive Spreadsheet Auto-Sync
        try {
          enqueueStudentAutoSync(updatedStudent, examConfig.passingScore, examConfig.title);
        } catch (syncErr) {
          console.warn("[AutoSync Drive] Direct submit sync warning:", syncErr);
        }
      } catch (err) {
        console.error("[Firebase] Error saving final exam results to Firestore:", err);
      }
    },
    [currentUser, examSubmitted, questions, studentAnswers, examConfig.passingScore, examConfig.title]
  );

  const recordViolation = useCallback(
    (
      type: ViolationRecord["type"],
      title: string,
      description: string,
      snapshot?: string
    ) => {
      if (!currentUser || currentUser.role !== "siswa" || !examStarted || examSubmitted) {
        return;
      }

      const newViolation: ViolationRecord = {
        id: "viol-" + Date.now(),
        timestamp: new Date().toLocaleTimeString("id-ID"),
        type,
        title,
        description,
        snapshot,
      };

      setActiveViolations((prev) => {
        const nextList = [...prev, newViolation];
        const newCount = nextList.length;

        setStudents((all) =>
          all.map((s) =>
            s.id === currentUser.id
              ? {
                  ...s,
                  violationsCount: newCount,
                  violationsLog: nextList,
                }
              : s
          )
        );

        // 1. Send immediately to Server Real-Time Violation Stream & Database
        const violationPayload = {
          studentId: currentUser.id,
          studentName: currentUser.name,
          className: currentUser.className,
          nisn: currentUser.nisn,
          type,
          title,
          description,
          snapshot,
          timestamp: newViolation.timestamp,
        };

        fetch("/api/violations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(violationPayload),
        }).catch((err) => console.warn("[Violations API] Real-time post notice:", err));

        // 2. Broadcast via BroadcastChannel for instant zero-latency cross-tab sync
        try {
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            const bc = new BroadcastChannel("gpp_cbt_violations_channel");
            bc.postMessage({
              type: "NEW_VIOLATION",
              violation: {
                ...newViolation,
                studentId: currentUser.id,
                studentName: currentUser.name,
                className: currentUser.className,
                nisn: currentUser.nisn,
              },
            });
            bc.close();
          }
        } catch (bcErr) {
          // Ignore BroadcastChannel errors in restricted contexts
        }

        // 3. Update violation count and log in Firestore (if connected)
        setDoc(
          doc(db, "students", currentUser.id),
          cleanForFirestore({ violationsCount: newCount, violationsLog: nextList }),
          { merge: true }
        ).catch((err) => console.warn("[Firebase] Error recording violation:", err));

        // 4. Auto-disqualify if limit reached
        if (newCount >= examConfig.maxAllowedViolations) {
          submitExam("Batas maksimal pelanggaran terlampaui. Ujian disubmit otomatis!", true);
        }

        return nextList;
      });
    },
    [currentUser, examStarted, examSubmitted, examConfig.maxAllowedViolations, submitExam]
  );

  // =========================================================================
  // CLASS / ROMBEL MANAGEMENT IN FIREBASE FIRESTORE
  // =========================================================================
  const addClasses = useCallback(
    async (newClasses: string[], openStudentModalForClass?: string) => {
      const trimmed = (newClasses || []).map((c) => (c || "").trim()).filter(Boolean);
      const updated = Array.from(new Set([...customClasses, ...trimmed])).sort();
      setCustomClasses(updated);

      try {
        await setDoc(doc(db, "settings", "classes"), { list: updated }, { merge: true });
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      } catch (err) {
        console.error("[Firebase] Error saving new classes to Firestore:", err);
      }
    },
    [customClasses]
  );

  const deleteClass = useCallback(
    async (className: string, deleteStudentsInClass = true) => {
      const trimmedTarget = (className || "").trim();
      const normalized = trimmedTarget.toLowerCase();

      // 1. Remove from customClasses
      const updatedCustom = (customClasses || []).filter(
        (c) => (c || "").trim().toLowerCase() !== normalized
      );
      setCustomClasses(updatedCustom);

      // 2. Identify students to delete if requested
      let studentIdsToDelete: string[] = [];
      if (deleteStudentsInClass) {
        studentIdsToDelete = students
          .filter((s) => (s?.className || "").trim().toLowerCase() === normalized)
          .map((s) => s.id);

        if (studentIdsToDelete.length > 0) {
          const idSet = new Set(studentIdsToDelete);
          setStudents((prev) => prev.filter((s) => !idSet.has(s.id)));
        }
      }

      try {
        // Save classes list to Firestore
        await setDoc(doc(db, "settings", "classes"), { list: updatedCustom });

        // Batch delete students in Firestore
        if (studentIdsToDelete.length > 0) {
          const ops = studentIdsToDelete.map((id) => ({
            type: "delete" as const,
            ref: doc(db, "students", id),
          }));
          await commitBatchOperations(ops);
        }

        // Remove from activeClasses in examConfig if present
        if (
          examConfig.activeClasses &&
          examConfig.activeClasses.some((c) => (c || "").trim().toLowerCase() === normalized)
        ) {
          const updatedActive = examConfig.activeClasses.filter(
            (c) => (c || "").trim().toLowerCase() !== normalized
          );
          const updatedConfig = { ...examConfig, activeClasses: updatedActive };
          setExamConfig(updatedConfig);
          await setDoc(doc(db, "settings", "examConfig"), cleanForFirestore(updatedConfig), { merge: true });
        }

        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      } catch (err) {
        console.error("[Firebase] Error deleting class from Firestore:", err);
      }
    },
    [customClasses, students, examConfig]
  );

  const emptyClass = useCallback(
    async (className: string) => {
      const trimmedTarget = (className || "").trim();
      const normalized = trimmedTarget.toLowerCase();

      const studentIdsToDelete = students
        .filter((s) => (s?.className || "").trim().toLowerCase() === normalized)
        .map((s) => s.id);

      if (studentIdsToDelete.length > 0) {
        const idSet = new Set(studentIdsToDelete);
        setStudents((prev) => prev.filter((s) => !idSet.has(s.id)));

        try {
          const ops = studentIdsToDelete.map((id) => ({
            type: "delete" as const,
            ref: doc(db, "students", id),
          }));
          await commitBatchOperations(ops);
          setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
        } catch (err) {
          console.error("[Firebase] Error emptying class in Firestore:", err);
        }
      }

      // Ensure class name remains registered
      if (!(customClasses || []).some((c) => (c || "").trim().toLowerCase() === normalized)) {
        const updated = [...customClasses, trimmedTarget].sort();
        setCustomClasses(updated);
        await setDoc(doc(db, "settings", "classes"), { list: updated }, { merge: true });
      }
    },
    [customClasses, students]
  );

  const deleteCustomClass = useCallback(
    (className: string) => {
      deleteClass(className, false);
    },
    [deleteClass]
  );

  // =========================================================================
  // STUDENT MANAGEMENT IN FIREBASE FIRESTORE & LOCAL STORAGE & SERVER DB
  // =========================================================================
  const editStudent = useCallback(async (id: string, updates: Partial<Student>) => {
    let nextList: Student[] = [];
    let updatedTarget: Student | null = null;
    setStudents((prev) => {
      nextList = prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, ...updates };
          // If className or NISN changed and token was not explicitly overridden, keep token unique & synchronized
          if (
            (updates.className || updates.nisn) &&
            !updates.startBarcodeToken
          ) {
            updated.startBarcodeToken = generateUniqueStudentToken(
              updated.className,
              updated.nisn,
              updated.id
            );
          }
          updatedTarget = updated;
          return updated;
        }
        return s;
      });
      safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(nextList));
      storageEngine.saveStudentsAsync(nextList).catch(() => {});
      return nextList;
    });

    try {
      const dataToSave = updatedTarget ? cleanForFirestore(updatedTarget) : cleanForFirestore(updates);
      await setDoc(doc(db, "students", id), dataToSave, { merge: true });
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error editing student in Firestore:", err);
    }

    syncToServerDb({ students: nextList, label: "edit_student" });
  }, []);

  const addStudent = useCallback(async (newStudent: Omit<Student, "id">) => {
    const rawNisn = newStudent.nisn ? String(newStudent.nisn).trim() : "";
    const validNisn = normalizeNisn(rawNisn);
    const cleanCls = (newStudent.className || "").trim() || "XII RPL 1";
    const cleanName = (newStudent.name || "").trim();
    const clsKey = normalizeClassKey(cleanCls);
    const nameKey = normalizeNameKey(cleanName);

    // Auto-generate clean unique username if empty
    let username = (newStudent.username || "").trim();
    if (!username) {
      const clsPart = cleanCls.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      const namePart = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
      username = validNisn ? `s_${validNisn.slice(-6)}` : `${clsPart || "user"}_${namePart || Date.now().toString().slice(-4)}`;
    }

    // Check if duplicate student exists:
    // Only match by valid non-placeholder NISN OR by exact (same class + same name)
    const existing = students.find((s) => {
      if (validNisn && normalizeNisn(s.nisn) === validNisn) return true;
      if (clsKey && nameKey) {
        if (normalizeClassKey(s.className) === clsKey && normalizeNameKey(s.name) === nameKey) {
          return true;
        }
      }
      return false;
    });

    if (existing) {
      await editStudent(existing.id, {
        ...newStudent,
        name: cleanName,
        className: cleanCls,
        nisn: rawNisn,
        username,
      });
      return;
    }

    const newId = "std-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const existingTokens = new Set(students.map((s) => (s.startBarcodeToken || "").toLowerCase()));
    let token = (newStudent.startBarcodeToken || "").trim();
    if (!token || existingTokens.has(token.toLowerCase())) {
      token = generateUniqueStudentToken(cleanCls, rawNisn, newId, existingTokens);
    }
    const studentWithId: Student = {
      ...newStudent,
      name: cleanName,
      className: cleanCls,
      nisn: rawNisn,
      username,
      password: newStudent.password || "siswa123",
      id: newId,
      loginCount: 0,
      isLocked: false,
      examStatus: "not_started",
      mcqScore: 0,
      essayScore: 0,
      totalScore: 0,
      violationsCount: 0,
      violationsLog: [],
      answers: {},
      startBarcodeToken: token,
      isSample: false,
    };

    let nextList: Student[] = [];
    setStudents((prev) => {
      nextList = [studentWithId, ...prev];
      safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(nextList));
      storageEngine.saveStudentsAsync(nextList).catch(() => {});
      return nextList;
    });

    // Automatically register class if new
    if (cleanCls) {
      addClasses([cleanCls]);
    }

    try {
      await setDoc(doc(db, "students", studentWithId.id), cleanForFirestore(studentWithId));
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error adding student to Firestore:", err);
    }

    syncToServerDb({ students: nextList, label: "add_student" });
  }, [students, editStudent, addClasses]);

  const deleteStudent = useCallback(async (id: string) => {
    let nextList: Student[] = [];
    setStudents((prev) => {
      nextList = prev.filter((s) => s.id !== id);
      safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(nextList));
      storageEngine.saveStudentsAsync(nextList).catch(() => {});
      return nextList;
    });

    try {
      await deleteDoc(doc(db, "students", id));
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error deleting student from Firestore:", err);
    }

    syncToServerDb({ students: nextList, label: "delete_student" });
  }, []);

  const bulkDeleteStudents = useCallback(async (ids: string[]) => {
    const idSet = new Set(ids);
    let nextList: Student[] = [];
    setStudents((prev) => {
      nextList = prev.filter((s) => !idSet.has(s.id));
      safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(nextList));
      storageEngine.saveStudentsAsync(nextList).catch(() => {});
      return nextList;
    });

    try {
      const ops = ids.map((id) => ({
        type: "delete" as const,
        ref: doc(db, "students", id),
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error bulk deleting students from Firestore:", err);
    }

    syncToServerDb({ students: nextList, label: "bulk_delete_students" });
  }, []);

  const bulkAddStudents = useCallback(async (newStudents: Student[]) => {
    if (!newStudents || newStudents.length === 0) return;
    const sanitizedStudents = newStudents.map((s) => ({
      ...s,
      isSample: s.isSample === true ? true : false,
    }));

    // Automatically register any new classes
    const incomingClasses = Array.from(
      new Set(sanitizedStudents.map((s) => (s?.className || "").trim()).filter(Boolean))
    );
    if (incomingClasses.length > 0) {
      addClasses(incomingClasses);
    }

    let finalMergedList: Student[] = [];
    let studentsToCommit: Student[] = [];

    setStudents((prev) => {
      const { mergedStudents } = mergeImportedStudents(prev, sanitizedStudents);
      const { students: uniqueTokenStudents } = ensureUniqueStudentTokens(mergedStudents);
      finalMergedList = uniqueTokenStudents;

      // Identify the exact students from the incoming batch within the merged array
      const incomingIds = new Set(sanitizedStudents.map((s) => s.id));
      studentsToCommit = uniqueTokenStudents.filter((s) => incomingIds.has(s.id));
      if (studentsToCommit.length === 0) {
        studentsToCommit = sanitizedStudents;
      }

      safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(uniqueTokenStudents));
      storageEngine.saveStudentsAsync(uniqueTokenStudents).catch(() => {});
      return uniqueTokenStudents;
    });

    try {
      // Commit the newly added students to Firestore
      const ops = studentsToCommit.map((st) => ({
        type: "set" as const,
        ref: doc(db, "students", st.id),
        data: cleanForFirestore(st),
        options: { merge: true },
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error bulk adding students to Firestore:", err);
    }

    syncToServerDb({
      students: finalMergedList.length > 0 ? finalMergedList : sanitizedStudents,
      label: "bulk_add_students",
    });
  }, [addClasses]);

  const bulkUpdateStudents = useCallback(
    async (updates: Array<{ id: string } & Partial<Student>>) => {
      if (!updates || updates.length === 0) return;

      const updateMap = new Map(updates.map((u) => [u.id, u]));
      let nextList: Student[] = [];

      setStudents((prev) => {
        const rawList = prev.map((s) => {
          const u = updateMap.get(s.id);
          if (!u) return s;
          const merged = { ...s, ...u };
          // If className or nisn changed without explicit token, synchronize barcode token
          if ((u.className || u.nisn) && !u.startBarcodeToken) {
            merged.startBarcodeToken = generateUniqueStudentToken(
              merged.className,
              merged.nisn,
              merged.id
            );
          }
          return merged;
        });
        const { students: sanitizedList } = ensureUniqueStudentTokens(rawList);
        nextList = sanitizedList;
        safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(nextList));
        storageEngine.saveStudentsAsync(nextList).catch(() => {});
        return nextList;
      });

      try {
        const ops = updates.map((u) => {
          const updatedRecord = nextList.find((s) => s.id === u.id);
          const { id, ...data } = u;
          const dataToSave = updatedRecord
            ? cleanForFirestore({
                ...data,
                ...(updatedRecord.startBarcodeToken ? { startBarcodeToken: updatedRecord.startBarcodeToken } : {}),
              })
            : cleanForFirestore(data);

          return {
            type: "set" as const,
            ref: doc(db, "students", id),
            data: dataToSave,
            options: { merge: true },
          };
        });
        await commitBatchOperations(ops);
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      } catch (err) {
        console.error("[Firebase] Error bulk updating students in Firestore:", err);
      }

      syncToServerDb({ students: nextList, label: "bulk_update_students" });
    },
    []
  );

  const cleanupDuplicateStudents = useCallback(async () => {
    const { unique, duplicates, duplicatesCount } = deduplicateStudents(students);
    if (duplicatesCount === 0) {
      return { totalCleaned: 0, remainingCount: unique.length };
    }

    setStudents(unique);
    safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(unique));

    try {
      const ops = duplicates.map((d) => ({
        type: "delete" as const,
        ref: doc(db, "students", d.id),
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error cleaning duplicate students in Firestore:", err);
    }

    return { totalCleaned: duplicatesCount, remainingCount: unique.length };
  }, [students]);

  const deleteSampleStudents = useCallback(async () => {
    const sampleIds = students.filter(isSampleStudent).map((s) => s.id);
    setStudents((prev) => prev.filter((s) => !isSampleStudent(s)));

    try {
      const ops = sampleIds.map((id) => ({
        type: "delete" as const,
        ref: doc(db, "students", id),
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error deleting sample students from Firestore:", err);
    }
  }, [students]);

  // =========================================================================
  // QUESTION MANAGEMENT IN FIREBASE FIRESTORE
  // =========================================================================
  const addQuestion = useCallback(async (q: Omit<Question, "id">, modifierInfo?: string) => {
    const creator =
      modifierInfo ||
      (currentUser?.name ? `${currentUser.name} (${currentUser.role})` : "Admin/Guru");

    const initialRev: QuestionRevision = {
      id: "rev-" + Date.now(),
      timestamp: new Date().toISOString(),
      modifiedBy: creator,
      role: (currentUser?.role as "admin" | "guru") || "admin",
      changeType: "CREATE",
      summary: "Pembuatan butir soal baru",
    };

    const newQ: Question = {
      ...q,
      id: "q-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      lastModifiedBy: creator,
      lastModifiedAt: new Date().toISOString(),
      revisionHistory: [initialRev],
    };

    setQuestions((prev) => [...prev, newQ]);

    try {
      await setDoc(doc(db, "questions", newQ.id), cleanForFirestore(newQ));
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error adding question to Firestore:", err);
    }
  }, [currentUser]);

  const bulkAddQuestions = useCallback(async (newQs: Omit<Question, "id">[]) => {
    const creator = currentUser?.name ? `${currentUser.name} (${currentUser.role})` : "Admin/Guru";
    const nowIso = new Date().toISOString();

    const questionsWithIds: Question[] = newQs.map((q, idx) => ({
      ...q,
      id: "q-" + Date.now() + "-" + idx + "-" + Math.random().toString(36).slice(2, 6),
      lastModifiedBy: creator,
      lastModifiedAt: nowIso,
      revisionHistory: [
        {
          id: "rev-" + Date.now() + "-" + idx,
          timestamp: nowIso,
          modifiedBy: creator,
          role: (currentUser?.role as "admin" | "guru") || "admin",
          changeType: "CREATE",
          summary: "Impor butir soal dokumen Word/Excel",
        },
      ],
    }));

    setQuestions((prev) => [...prev, ...questionsWithIds]);

    try {
      const ops = questionsWithIds.map((q) => ({
        type: "set" as const,
        ref: doc(db, "questions", q.id),
        data: cleanForFirestore(q),
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error bulk adding questions to Firestore:", err);
    }
  }, [currentUser]);

  const deleteQuestion = useCallback(async (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));

    try {
      await deleteDoc(doc(db, "questions", id));
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error deleting question from Firestore:", err);
    }
  }, []);

  const updateQuestion = useCallback(
    async (id: string, updates: Partial<Question>, modifierInfo?: string) => {
      const modifier =
        modifierInfo ||
        (currentUser?.name ? `${currentUser.name} (${currentUser.role})` : "Admin/Guru");

      const nowIso = new Date().toISOString();

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== id) return q;

          // Track specific changed fields for version history
          const changes: string[] = [];
          let changeType: QuestionRevision["changeType"] = "GENERAL_UPDATE";

          if (updates.question && updates.question !== q.question) {
            changes.push("Naskah soal");
            changeType = "UPDATE_TEXT";
          }
          if (
            (updates.correctAnswer !== undefined && updates.correctAnswer !== q.correctAnswer) ||
            (updates.correctBool !== undefined && updates.correctBool !== q.correctBool) ||
            (updates.correctAnswers !== undefined &&
              JSON.stringify(updates.correctAnswers) !== JSON.stringify(q.correctAnswers))
          ) {
            changes.push("Kunci jawaban");
            changeType = "UPDATE_KEY";
          }
          if (updates.keyAnswer !== undefined && updates.keyAnswer !== q.keyAnswer) {
            changes.push(q.type === "essay" ? "Rubrik esai" : "Kunci jawaban isian");
            changeType = "UPDATE_RUBRIC";
          }
          if (updates.points !== undefined && updates.points !== q.points) {
            changes.push(`Bobot poin (${q.points} -> ${updates.points})`);
            changeType = "UPDATE_POINTS";
          }
          if (
            updates.options !== undefined &&
            JSON.stringify(updates.options) !== JSON.stringify(q.options)
          ) {
            changes.push("Pilihan jawaban");
            changeType = "UPDATE_OPTIONS";
          }
          if (updates.mediaUrl !== undefined && updates.mediaUrl !== q.mediaUrl) {
            changes.push("Lampiran media");
            changeType = "UPDATE_MEDIA";
          }
          if (updates.type !== undefined && updates.type !== q.type) {
            changes.push(`Tipe soal (${q.type} -> ${updates.type})`);
          }

          const summary =
            changes.length > 0 ? `Perubahan: ${changes.join(", ")}` : "Pembaruan butir soal";

          const newRev: QuestionRevision = {
            id: "rev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
            timestamp: nowIso,
            modifiedBy: modifier,
            role: (currentUser?.role as "admin" | "guru") || "admin",
            changeType,
            summary,
            previousState: {
              question: q.question,
              type: q.type,
              correctAnswer: q.correctAnswer,
              correctAnswers: q.correctAnswers,
              correctBool: q.correctBool,
              keyAnswer: q.keyAnswer,
              points: q.points,
              options: q.options ? [...q.options] : undefined,
            },
          };

          const updatedQ: Question = {
            ...q,
            ...updates,
            lastModifiedBy: modifier,
            lastModifiedAt: nowIso,
            revisionHistory: [newRev, ...(q.revisionHistory || [])],
          };

          setDoc(doc(db, "questions", id), cleanForFirestore(updatedQ), { merge: true }).catch(
            (err) => console.error("[Firebase] Error updating question in Firestore:", err)
          );

          return updatedQ;
        })
      );

      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    },
    [currentUser]
  );

  const restoreQuestionRevision = useCallback(
    async (questionId: string, revisionId: string) => {
      const modifier = currentUser?.name ? `${currentUser.name} (${currentUser.role})` : "Admin/Guru";
      const nowIso = new Date().toISOString();

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;

          const targetRev = q.revisionHistory?.find((r) => r.id === revisionId);
          if (!targetRev || !targetRev.previousState) return q;

          const prev = targetRev.previousState;

          const rollbackRev: QuestionRevision = {
            id: "rev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
            timestamp: nowIso,
            modifiedBy: modifier,
            role: (currentUser?.role as "admin" | "guru") || "admin",
            changeType: "GENERAL_UPDATE",
            summary: `Memulihkan (Rollback) ke versi: ${new Date(targetRev.timestamp).toLocaleString("id-ID")}`,
            previousState: {
              question: q.question,
              type: q.type,
              correctAnswer: q.correctAnswer,
              correctAnswers: q.correctAnswers,
              correctBool: q.correctBool,
              keyAnswer: q.keyAnswer,
              points: q.points,
              options: q.options ? [...q.options] : undefined,
            },
          };

          const restoredQ: Question = {
            ...q,
            question: prev.question ?? q.question,
            type: prev.type ?? q.type,
            correctAnswer: prev.correctAnswer ?? q.correctAnswer,
            correctAnswers: prev.correctAnswers ?? q.correctAnswers,
            correctBool: prev.correctBool ?? q.correctBool,
            keyAnswer: prev.keyAnswer ?? q.keyAnswer,
            points: prev.points ?? q.points,
            options: prev.options ?? q.options,
            lastModifiedBy: modifier,
            lastModifiedAt: nowIso,
            revisionHistory: [rollbackRev, ...(q.revisionHistory || [])],
          };

          setDoc(doc(db, "questions", questionId), cleanForFirestore(restoredQ), { merge: true }).catch(
            (err) => console.error("[Firebase] Error restoring question revision:", err)
          );

          return restoredQ;
        })
      );

      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    },
    [currentUser]
  );

  // =========================================================================
  // EXAM CONFIG & STAFF MANAGEMENT IN FIREBASE FIRESTORE
  // =========================================================================
  const updateExamConfig = useCallback(async (updates: Partial<ExamConfig>) => {
    setExamConfig((prev) => {
      const next = { ...prev, ...updates };
      setDoc(doc(db, "settings", "examConfig"), cleanForFirestore(next), { merge: true }).catch(
        (err) => console.error("[Firebase] Error updating exam config in Firestore:", err)
      );
      return next;
    });
    setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
  }, []);

  const updateStaffProfile = useCallback(
    (
      staffId: string,
      updates: { name?: string; username?: string; email?: string; password?: string }
    ): { success: boolean; message?: string } => {
      setStaffUsers((prev) => {
        const next = prev.map((s) => (s.id === staffId ? { ...s, ...updates } : s));
        setDoc(doc(db, "settings", "staff"), { list: cleanForFirestore(next) }).catch((err) =>
          console.error("[Firebase] Error updating staff profile in Firestore:", err)
        );
        return next;
      });

      setCurrentUser((curr) => {
        if (curr && curr.id === staffId) {
          return { ...curr, ...updates } as TeacherOrAdmin;
        }
        return curr;
      });

      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      return { success: true, message: "Profil dan password staf berhasil disimpan ke cloud Firebase!" };
    },
    []
  );

  const resetAllExamData = useCallback(async () => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        loginCount: 0,
        isLocked: false,
        examStatus: "not_started",
        mcqScore: 0,
        essayScore: 0,
        totalScore: 0,
        violationsCount: 0,
        violationsLog: [],
        answers: {},
        essayEvaluations: {},
        startedAt: undefined,
        submittedAt: undefined,
      }))
    );

    try {
      const ops = students.map((s) => ({
        type: "set" as const,
        ref: doc(db, "students", s.id),
        data: cleanForFirestore({
          loginCount: 0,
          isLocked: false,
          examStatus: "not_started",
          mcqScore: 0,
          essayScore: 0,
          totalScore: 0,
          violationsCount: 0,
          violationsLog: [],
          answers: {},
          essayEvaluations: {},
          startedAt: null,
          submittedAt: null,
        }),
        options: { merge: true },
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error resetting all exam data in Firestore:", err);
    }
  }, [students]);

  const restoreDefaultExamConfig = useCallback(async () => {
    setExamConfig(INITIAL_EXAM_CONFIG);
    try {
      await setDoc(doc(db, "settings", "examConfig"), cleanForFirestore(INITIAL_EXAM_CONFIG));
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error restoring default config in Firestore:", err);
    }
  }, []);

  const generate1000SimulatedStudents = useCallback(
    async (count: number = 1000) => {
      const newSim = generateSimulationStudents(count, true);
      setStudents(newSim);

      try {
        setIsSyncing(true);
        const ops = newSim.map((st) => ({
          type: "set" as const,
          ref: doc(db, "students", st.id),
          data: cleanForFirestore(st),
          options: { merge: true },
        }));
        await commitBatchOperations(ops);
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      } catch (err) {
        console.error("[Firebase] Error syncing simulated students to Firestore:", err);
      } finally {
        setIsSyncing(false);
      }

      return newSim.length;
    },
    []
  );

  const restoreInitialStudents = useCallback(async () => {
    setStudents(INITIAL_STUDENTS);

    try {
      setIsSyncing(true);
      const ops = INITIAL_STUDENTS.map((st) => ({
        type: "set" as const,
        ref: doc(db, "students", st.id),
        data: cleanForFirestore(st),
      }));
      await commitBatchOperations(ops);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (err) {
      console.error("[Firebase] Error restoring initial students in Firestore:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Database Export & Import
  const exportDatabase = useCallback(() => {
    try {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(
          JSON.stringify(
            {
              version: 3,
              source: "Firebase Firestore",
              exportedAt: new Date().toISOString(),
              customClasses,
              students,
              questions,
              examConfig,
              staffUsers,
            },
            null,
            2
          )
        );
      const dlAnchor = document.createElement("a");
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute(
        "download",
        `cbt_firebase_backup_${new Date().toISOString().split("T")[0]}.json`
      );
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
      return true;
    } catch (err) {
      console.error("Export error:", err);
      return false;
    }
  }, [students, questions, examConfig, staffUsers, customClasses]);

  const importDatabase = useCallback(
    async (jsonContent: string): Promise<{ success: boolean; message: string }> => {
      try {
        const parsed = JSON.parse(jsonContent);
        setIsSyncing(true);

        if (Array.isArray(parsed.students) && parsed.students.length > 0) {
          setStudents(parsed.students);
          const ops = parsed.students.map((st: Student) => ({
            type: "set" as const,
            ref: doc(db, "students", st.id),
            data: cleanForFirestore(st),
            options: { merge: true },
          }));
          await commitBatchOperations(ops);
        }

        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          setQuestions(parsed.questions);
          const ops = parsed.questions.map((q: Question) => ({
            type: "set" as const,
            ref: doc(db, "questions", q.id),
            data: cleanForFirestore(q),
          }));
          await commitBatchOperations(ops);
        }

        if (parsed.examConfig) {
          setExamConfig(parsed.examConfig);
          await setDoc(doc(db, "settings", "examConfig"), cleanForFirestore(parsed.examConfig));
        }

        if (Array.isArray(parsed.customClasses)) {
          setCustomClasses(parsed.customClasses);
          await setDoc(doc(db, "settings", "classes"), { list: parsed.customClasses });
        }

        if (Array.isArray(parsed.staffUsers)) {
          setStaffUsers(parsed.staffUsers);
          await setDoc(doc(db, "settings", "staff"), { list: cleanForFirestore(parsed.staffUsers) });
        }

        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
        return { success: true, message: "Seluruh data berhasil diimpor langsung ke Firebase Firestore!" };
      } catch (err: any) {
        return { success: false, message: err.message || "Format file cadangan tidak valid." };
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  const fetchBackups = useCallback(async (): Promise<BackupFileInfo[]> => {
    try {
      const res = await fetch("/api/data/backups");
      const json = await res.json();
      if (json.success && Array.isArray(json.backups)) return json.backups;
      return [];
    } catch {
      return [];
    }
  }, []);

  const restoreBackup = useCallback(
    async (filename: string): Promise<{ success: boolean; message: string }> => {
      try {
        const res = await fetch("/api/data/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename }),
        });
        const result = await res.json();
        if (result.success && result.db) {
          const imported = result.db;
          if (Array.isArray(imported.students)) {
            setStudents(imported.students);
            const ops = imported.students.map((st: Student) => ({
              type: "set" as const,
              ref: doc(db, "students", st.id),
              data: cleanForFirestore(st),
            }));
            await commitBatchOperations(ops);
          }
          if (Array.isArray(imported.questions)) {
            setQuestions(imported.questions);
            const ops = imported.questions.map((q: Question) => ({
              type: "set" as const,
              ref: doc(db, "questions", q.id),
              data: cleanForFirestore(q),
            }));
            await commitBatchOperations(ops);
          }
          if (imported.examConfig) {
            setExamConfig(imported.examConfig);
            await setDoc(doc(db, "settings", "examConfig"), cleanForFirestore(imported.examConfig));
          }
          setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
          return { success: true, message: result.message };
        }
        return { success: false, message: result.message || "Gagal memulihkan snapshot." };
      } catch (err: any) {
        return { success: false, message: err.message || "Gagal menghubungi server snapshot." };
      }
    },
    []
  );

  const createManualBackup = useCallback(
    async (label: string = "manual_backup"): Promise<boolean> => {
      try {
        setIsSyncing(true);
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            students,
            questions,
            examConfig,
            staffUsers,
            label,
          }),
        });
        const json = await res.json();
        return Boolean(json.success);
      } catch {
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [students, questions, examConfig, staffUsers]
  );

  const refreshAllStudentsFromDatabase = useCallback(async (): Promise<number> => {
    setIsSyncing(true);
    try {
      // 1. Fetch directly from Firestore
      const snap = await getDocs(collection(db, "students"));
      const fsStudents: Student[] = [];
      const fsIds = new Set<string>();
      snap.forEach((d) => {
        const data = d.data() as Student;
        const s = { ...data, id: data.id || d.id };
        fsStudents.push(s);
        fsIds.add(s.id);
      });

      // 2. Fetch directly from Server Disk Database (/api/data)
      let apiStudents: Student[] = [];
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.students && Array.isArray(json.data.students)) {
            apiStudents = json.data.students;
          }
        }
      } catch (err) {
        console.warn("[refreshAllStudentsFromDatabase] API fetch notice:", err);
      }

      // 3. Fetch from Local IndexedDB Engine
      let idbStudents: Student[] = [];
      try {
        const idb = await storageEngine.loadStudentsAsync();
        if (idb && Array.isArray(idb)) {
          idbStudents = idb;
        }
      } catch (err) {
        console.warn("[refreshAllStudentsFromDatabase] IDB load notice:", err);
      }

      // 4. Combine all sources without losing any student
      const combinedPool: Student[] = [
        ...fsStudents,
        ...apiStudents,
        ...idbStudents,
        ...students,
      ];

      // 5. Deduplicate and ensure unique barcode tokens
      const { unique } = deduplicateStudents(combinedPool);
      const { students: cleanStudents } = ensureUniqueStudentTokens(unique);
      cleanStudents.sort((a, b) => {
        const cCmp = (a.className || "").localeCompare(b.className || "");
        if (cCmp !== 0) return cCmp;
        return (a.name || "").localeCompare(b.name || "");
      });

      // 6. Push missing students to Firestore so Cloud is fully up to date
      const missingInFs = cleanStudents.filter((s) => !fsIds.has(s.id));
      if (missingInFs.length > 0) {
        const missingOps = missingInFs.map((s) => ({
          type: "set" as const,
          ref: doc(db, "students", s.id),
          data: cleanForFirestore(s),
          options: { merge: true },
        }));
        await commitBatchOperations(missingOps);
      }

      // 7. Sync back to Server Disk DB (/api/data)
      await syncToServerDb({
        students: cleanStudents,
        label: "sync_all_database_students",
      });

      // 8. Update classes
      const allClassNames = Array.from(
        new Set(cleanStudents.map((s) => (s?.className || "").trim()).filter(Boolean))
      ).sort();
      setCustomClasses(allClassNames);
      try {
        safeStorage.setItem("gpp_registered_classes", JSON.stringify(allClassNames));
        await setDoc(doc(db, "settings", "classes"), { list: allClassNames }, { merge: true });
      } catch {}

      // 9. Update state & storage
      setStudents(cleanStudents);
      safeStorage.setItem("GPP_EXAM_STUDENTS_V1", JSON.stringify(cleanStudents));
      storageEngine.saveStudentsAsync(cleanStudents).catch(() => {});
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      setIsSyncing(false);
      return cleanStudents.length;
    } catch (err) {
      console.error("[refreshAllStudentsFromDatabase] Sync error:", err);
      setIsSyncing(false);
      return students.length;
    }
  }, [students]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setExamStarted(false);
    setExamSubmitted(false);
    setIsDisqualified(false);
    setStudentAnswers({});
    setActiveViolations([]);
  }, []);

  return {
    students,
    questions,
    examConfig,
    staffUsers,
    customClasses,
    currentUser,
    examStarted,
    examSubmitted,
    studentAnswers,
    activeViolations,
    isDisqualified,
    isGrading,
    firebaseStatus,
    login,
    loginWithBarcode,
    logout,
    resetStudentLogin,
    resetMultipleStudentsLogin,
    resetAllStudentsLogin,
    startExamWithBarcode,
    recordAnswer,
    submitExam,
    recordViolation,
    addClasses,
    deleteClass,
    deleteCustomClass,
    emptyClass,
    addStudent,
    editStudent,
    bulkUpdateStudents,
    deleteStudent,
    bulkDeleteStudents,
    bulkAddStudents,
    cleanupDuplicateStudents,
    deleteSampleStudents,
    addQuestion,
    bulkAddQuestions,
    deleteQuestion,
    updateQuestion,
    restoreQuestionRevision,
    setExamConfig,
    updateExamConfig,
    updateStaffProfile,
    resetAllExamData,
    restoreDefaultExamConfig,
    generate1000SimulatedStudents,
    restoreInitialStudents,
    hasAdminCustomData,
    lastSyncTime,
    isSyncing,
    exportDatabase,
    importDatabase,
    fetchBackups,
    restoreBackup,
    createManualBackup,
    refreshAllStudentsFromDatabase,
  };
}
