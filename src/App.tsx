import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { LoginView } from "./components/LoginView";
import { ExamStartBarcodeModal } from "./components/ExamStartBarcodeModal";
import { AntiCheatingGuard } from "./components/AntiCheatingGuard";
import { ExamScreen } from "./components/ExamScreen";
import { ExamResultView } from "./components/ExamResultView";
import { AdminDashboard } from "./components/AdminDashboard";
import { DuckRaceLive } from "./components/DuckRaceLive";
import { OfflineStatusBanner } from "./components/OfflineStatusBanner";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useExamStore } from "./store/examStore";
import { Student, TeacherOrAdmin } from "./types";
import { extractTokenFromScan } from "./utils/barcodeUtils";
import { LoginPortalQrModal } from "./components/LoginPortalQrModal";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

export default function App() {
  const network = useNetworkStatus();
  const {
    students,
    questions,
    examConfig,
    currentUser,
    studentAnswers,
    isGrading,
    login,
    loginWithBarcode,
    logout,
    startExamWithBarcode,
    recordAnswer,
    submitExam,
    recordViolation,
    resetStudentLogin,
    resetMultipleStudentsLogin,
    resetAllStudentsLogin,
    addStudent,
    editStudent,
    bulkUpdateStudents,
    deleteStudent,
    bulkDeleteStudents,
    bulkAddStudents,
    cleanupDuplicateStudents,
    deleteSampleStudents,
    addQuestion,
    updateQuestion,
    restoreQuestionRevision,
    bulkAddQuestions,
    deleteQuestion,
    updateStaffProfile,
    updateExamConfig,
    resetAllExamData,
    restoreDefaultExamConfig,
    generate1000SimulatedStudents,
    restoreInitialStudents,
    hasAdminCustomData,
    lastSyncTime,
    isSyncing,
    firebaseStatus,
    customClasses,
    addClasses,
    deleteClass,
    deleteCustomClass,
    emptyClass,
    exportDatabase,
    importDatabase,
    fetchBackups,
    restoreBackup,
    createManualBackup,
    refreshAllStudentsFromDatabase,
  } = useExamStore();

  const [showDuckRaceModal, setShowDuckRaceModal] = useState(false);
  const [showLoginPortalQrModal, setShowLoginPortalQrModal] = useState(false);
  const [lensScanNotice, setLensScanNotice] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Auto-login or welcome notification if accessed via Google Lens QR Scan URL query parameters
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location && window.location.search) {
        const search = window.location.search;
        const rawToken = extractTokenFromScan(search);
        if (rawToken || search.includes("token=") || search.includes("id=") || search.includes("nisn=")) {
          // Pass search first to retain all URL query parameters (id, nisn, token, cls)
          let res = loginWithBarcode(search);
          if (!res.success && rawToken) {
            res = loginWithBarcode(rawToken);
          }
          if (res.success) {
            setLensScanNotice({
              success: true,
              message: "Berhasil masuk otomatis dari pemindaian QR Code / Google Lens!",
            });
            // Clean search query from address bar so it doesn't re-trigger on refresh
            try {
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname || "/");
              }
            } catch {
              // ignore
            }
            const timer = setTimeout(() => setLensScanNotice(null), 4000);
            return () => clearTimeout(timer);
          } else {
            setLensScanNotice({
              success: false,
              message: res.message || "Gagal masuk dari QR Code.",
            });
            const timer = setTimeout(() => setLensScanNotice(null), 5000);
            return () => clearTimeout(timer);
          }
        } else if (search.includes("portal=login") || search.includes("tab=")) {
          setLensScanNotice({
            success: true,
            message: "Portal Laman Login Ujian Berhasil Dibuka via Google Lens / QR Code!",
          });
          const timer = setTimeout(() => setLensScanNotice(null), 4000);
          return () => clearTimeout(timer);
        }
      }
    } catch {
      // Ignore location access error
    }
  }, [loginWithBarcode]);

  // If currentUser is a student, get the fresh student object from students state
  const currentStudent =
    currentUser && currentUser.role === "siswa"
      ? students.find((s) => s.id === currentUser.id) || (currentUser as Student)
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onLogout={logout}
        onOpenDuckRace={() => setShowDuckRaceModal(true)}
        onOpenLoginQrModal={() => setShowLoginPortalQrModal(true)}
      />

      {/* Google Lens Scan Flash Toast */}
      {lensScanNotice && (
        <div
          className={`py-2.5 px-4 text-xs font-bold flex items-center justify-center space-x-2 animate-in slide-in-from-top duration-300 ${
            lensScanNotice.success
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {lensScanNotice.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{lensScanNotice.message}</span>
        </div>
      )}

      {/* Offline Network Resilience Status Banner */}
      <OfflineStatusBanner network={network} />

      {/* Main Content Router based on Auth & Role */}
      <main className="flex-1">
        {!currentUser ? (
          /* Login Screen for Admin, Guru, & Siswa with Barcode Scanner */
          <LoginView
            students={students}
            onLogin={login}
            onBarcodeLogin={loginWithBarcode}
            onOpenLoginQrModal={() => setShowLoginPortalQrModal(true)}
          />
        ) : currentUser.role === "admin" || currentUser.role === "guru" ? (
          /* Admin / Guru Management Suite */
          <AdminDashboard
            currentUser={currentUser as TeacherOrAdmin}
            students={students}
            questions={questions}
            config={examConfig}
            customClasses={customClasses}
            onAddClasses={addClasses}
            onDeleteClass={deleteClass}
            onDeleteCustomClass={deleteCustomClass}
            onEmptyClass={emptyClass}
            firebaseStatus={firebaseStatus}
            onResetStudentLogin={resetStudentLogin}
            onResetMultipleStudentsLogin={resetMultipleStudentsLogin}
            onResetAllStudentsLogin={resetAllStudentsLogin}
            onAddStudent={addStudent}
            onEditStudent={editStudent}
            onBulkUpdateStudents={bulkUpdateStudents}
            onDeleteStudent={deleteStudent}
            onBulkDeleteStudents={bulkDeleteStudents}
            onBulkAddStudents={bulkAddStudents}
            onCleanupDuplicateStudents={cleanupDuplicateStudents}
            onDeleteSampleStudents={deleteSampleStudents}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onRestoreQuestionRevision={restoreQuestionRevision}
            onBulkAddQuestions={bulkAddQuestions}
            onDeleteQuestion={deleteQuestion}
            onOpenDuckRace={() => setShowDuckRaceModal(true)}
            onUpdateAdminProfile={updateStaffProfile}
            onUpdateExamConfig={updateExamConfig}
            onResetAllExamData={resetAllExamData}
            onRestoreDefaultExamConfig={restoreDefaultExamConfig}
            onGenerate1000Students={generate1000SimulatedStudents}
            onRestoreInitialStudents={restoreInitialStudents}
            hasAdminCustomData={hasAdminCustomData}
            lastSyncTime={lastSyncTime}
            isSyncing={isSyncing}
            onExportDatabase={exportDatabase}
            onImportDatabase={importDatabase}
            onFetchBackups={fetchBackups}
            onRestoreBackup={restoreBackup}
            onCreateManualBackup={createManualBackup}
            onRefreshAllData={refreshAllStudentsFromDatabase}
          />
        ) : currentStudent ? (
          /* Student Flow */
          currentStudent.examStatus === "not_started" ? (
            /* 1. Barcode Gate: Sajikan barcode per siswa + Scan barcode lagi untuk mulai ujian */
            <ExamStartBarcodeModal
              student={currentStudent}
              examConfig={examConfig}
              onStartExam={startExamWithBarcode}
            />
          ) : currentStudent.examStatus === "in_progress" ? (
            /* 2. Active Exam Screen with Anti-Cheating Guardian & AI Webcam Proctoring */
            <AntiCheatingGuard
              examActive={true}
              violationsCount={currentStudent.violationsCount}
              maxAllowedViolations={examConfig.maxAllowedViolations}
              onRecordViolation={recordViolation}
            >
              <ExamScreen
                student={currentStudent}
                questions={questions}
                config={examConfig}
                answers={studentAnswers || currentStudent.answers || {}}
                violationsCount={currentStudent.violationsCount}
                isGrading={isGrading}
                onRecordAnswer={recordAnswer}
                onSubmitExam={submitExam}
                onRecordViolation={recordViolation}
              />
            </AntiCheatingGuard>
          ) : (
            /* 3. Completed or Disqualified Result View */
            <ExamResultView
              student={currentStudent}
              questions={questions}
              config={examConfig}
              onOpenDuckRace={() => setShowDuckRaceModal(true)}
              onLogout={logout}
            />
          )
        ) : (
          <div className="p-8 text-center text-slate-400">
            Sesi tidak valid. Silakan login kembali.
          </div>
        )}
      </main>

      {/* Floating / Standalone Duck Race Modal */}
      {showDuckRaceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-5xl my-auto animate-in fade-in zoom-in duration-200">
            <DuckRaceLive
              students={students}
              config={examConfig}
              questions={questions}
              onClose={() => setShowDuckRaceModal(false)}
              onUpdateExamConfig={updateExamConfig}
            />
          </div>
        </div>
      )}

      {/* Global Login Portal Barcode Modal for Google Lens / Smartphone Scanner */}
      <LoginPortalQrModal
        isOpen={showLoginPortalQrModal}
        onClose={() => setShowLoginPortalQrModal(false)}
      />
    </div>
  );
}
