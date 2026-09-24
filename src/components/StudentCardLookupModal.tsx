import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  QrCode,
  Sparkles,
  Copy,
  Check,
  Download,
  Printer,
  Maximize2,
  Minimize2,
  GraduationCap,
  Lock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Filter,
} from "lucide-react";
import { Student } from "../types";
import { generateQRCode, getStudentQrPayload } from "../utils/barcodeUtils";

interface StudentCardLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onSelectStudentLogin?: (tokenOrBarcode: string) => void;
  institutionName?: string;
  academicYear?: string;
}

export const StudentCardLookupModal: React.FC<StudentCardLookupModalProps> = ({
  isOpen,
  onClose,
  students,
  onSelectStudentLogin,
  institutionName = "SMK / SMA Ujian Berstandar Nasional",
  academicYear = "2025/2026",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loadingQr, setLoadingQr] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isFullscreenZoom, setIsFullscreenZoom] = useState(false);

  // Extract unique classes
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.className && s.className.trim()) set.add(s.className.trim());
    });
    return Array.from(set).sort();
  }, [students]);

  // Filter students based on query and class
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      if (selectedClass !== "ALL" && s.className !== selectedClass) {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q) ||
        (s.startBarcodeToken && s.startBarcodeToken.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q))
      );
    });
  }, [students, searchQuery, selectedClass]);

  // Select first student if only one matches or pick default
  useEffect(() => {
    if (!isOpen) {
      setSelectedStudent(null);
      setSearchQuery("");
      setSelectedClass("ALL");
      setIsFullscreenZoom(false);
      return;
    }
    if (students.length > 0 && !selectedStudent) {
      setSelectedStudent(students[0]);
    }
  }, [isOpen]);

  // When search yields a single exact match, auto-select it
  useEffect(() => {
    if (searchQuery.trim().length >= 3 && filteredStudents.length === 1) {
      setSelectedStudent(filteredStudents[0]);
    }
  }, [searchQuery, filteredStudents]);

  // Generate QR Code for the currently selected student
  useEffect(() => {
    if (!selectedStudent) {
      setQrDataUrl("");
      return;
    }

    let isMounted = true;
    setLoadingQr(true);

    const payload = getStudentQrPayload(
      selectedStudent.startBarcodeToken,
      selectedStudent.nisn,
      "url",
      selectedStudent.id,
      selectedStudent.className
    );

    generateQRCode(payload, {
      width: isFullscreenZoom ? 560 : 420,
      margin: 4, // ISO 4-module quiet zone ensures 100% Google Lens recognition
      errorCorrectionLevel: "M",
      darkColor: "#000000",
      lightColor: "#ffffff",
    }).then((url) => {
      if (isMounted) {
        setQrDataUrl(url);
        setLoadingQr(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedStudent, isFullscreenZoom]);

  if (!isOpen) return null;

  const handleCopyToken = () => {
    if (!selectedStudent) return;
    navigator.clipboard.writeText(selectedStudent.startBarcodeToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!selectedStudent || !qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `Kartu_QR_${selectedStudent.className.replace(/\s+/g, "_")}_${selectedStudent.nisn}_${selectedStudent.name.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Cari &amp; Buka Kartu Barcode Siswa
                </h3>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase">
                  Google Lens Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Akses mandiri kartu ujian resmi: Tampilkan QR di HP, salin token barcode, atau login instan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800/80">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik Nama Siswa atau NISN Anda..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="sm:col-span-4 flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Body: Two columns on desktop, stacked on mobile */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Student Matching List */}
          <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 sm:p-4 flex flex-col max-h-[380px] lg:max-h-[520px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs text-slate-400">
              <span className="font-bold text-slate-300">
                Pilih Nama Siswa ({filteredStudents.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Ketuk untuk melihat kartu
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-10 px-4 text-slate-500 text-xs">
                  <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-semibold text-slate-300">Siswa tidak ditemukan</p>
                  <p className="mt-1">Coba periksa ejaan nama atau ubah filter kelas.</p>
                </div>
              ) : (
                filteredStudents.map((st) => {
                  const isSelected = selectedStudent?.id === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStudent(st)}
                      className={`w-full text-left p-2.5 sm:p-3 rounded-xl transition flex items-center justify-between cursor-pointer border ${
                        isSelected
                          ? "bg-blue-600/20 border-blue-500/50 text-white shadow-sm"
                          : "bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80 text-slate-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={`font-bold text-xs sm:text-sm truncate ${isSelected ? "text-blue-300" : "text-slate-200"}`}>
                          {st.name}
                        </p>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                          <span>NISN: <strong className="text-slate-300 font-mono">{st.nisn}</strong></span>
                          <span>&bull;</span>
                          <span>{st.className}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                          {st.startBarcodeToken.split("-").slice(-1)[0]}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Student's Official Exam Card */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-inner flex flex-col justify-between">
            {selectedStudent ? (
              <div className="space-y-4">
                
                {/* Official Card Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider">
                        Kartu Peserta Ujian Digital
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        &bull; {academicYear}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-base sm:text-lg text-white mt-0.5">
                      {selectedStudent.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      NISN: <strong className="text-slate-200 font-mono">{selectedStudent.nisn}</strong> &bull; Rombel: <strong className="text-slate-200">{selectedStudent.className}</strong>
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-sm shrink-0">
                    {selectedStudent.name.charAt(0)}
                  </div>
                </div>

                {/* Peruntukan Badge */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-950/60 to-indigo-950/50 border border-blue-500/30 flex items-center space-x-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-[11px] leading-relaxed text-slate-300">
                    <strong className="text-blue-300">Peruntukan:</strong> Barcode Identitas &amp; Login Pribadi Siswa. Bebas duplikat dan unik khusus untuk akun Anda.
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <div className="relative inline-block mx-auto max-w-full">
                    <div
                      onClick={() => setIsFullscreenZoom(true)}
                      className="w-40 h-40 sm:w-48 sm:h-48 mx-auto bg-white rounded-2xl p-2.5 flex items-center justify-center shadow-lg cursor-pointer hover:ring-4 hover:ring-blue-500/40 transition-all overflow-hidden"
                      title="Ketuk untuk perbesar QR Code layar penuh"
                    >
                      {loadingQr || !qrDataUrl ? (
                        <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-xs font-semibold">
                          Membuat QR...
                        </div>
                      ) : (
                        <img
                          src={qrDataUrl}
                          alt={`QR Code ${selectedStudent.name}`}
                          className="w-full h-full object-contain select-none"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsFullscreenZoom(true)}
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-950/90 hover:bg-blue-600 text-white shadow transition cursor-pointer border border-slate-700/80"
                      title="Perbesar Layar Penuh"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Token string badge & copy */}
                  <div className="mt-3 flex items-center justify-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-mono text-xs sm:text-sm font-bold text-cyan-300 bg-slate-950 px-3 py-1 rounded-xl border border-cyan-500/30">
                      {selectedStudent.startBarcodeToken}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                      title="Salin string token"
                    >
                      {copiedToken ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-emerald-400 font-semibold mt-2 flex items-center justify-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Dapat dipindai langsung via Google Lens atau kamera ponsel</span>
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-1">
                  {onSelectStudentLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectStudentLogin(selectedStudent.startBarcodeToken);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/25 transition cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Masuk Sekarang dengan Kartu Ini</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintCard}
                      className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Kartu</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                Pilih salah satu siswa di sebelah kiri untuk melihat kartu peserta.
              </div>
            )}
          </div>

        </div>

        {/* Footer info note */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            💡 <strong>Petunjuk:</strong> Siswa hanya perlu memperlihatkan QR ini ke kamera proktor atau Google Lens untuk autentikasi otomatis.
          </span>
          <span className="text-slate-500 font-mono text-[10px]">
            {institutionName}
          </span>
        </div>

      </div>

      {/* Fullscreen Zoom Modal (For scanning across room or projector) */}
      {isFullscreenZoom && selectedStudent && qrDataUrl && (
        <div
          onClick={() => setIsFullscreenZoom(false)}
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-6 rounded-3xl max-w-sm sm:max-w-md w-full text-center shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setIsFullscreenZoom(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
              aria-label="Tutup Zoom"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-slate-900 font-black text-lg mb-1">
              {selectedStudent.name}
            </div>
            <div className="text-slate-600 text-xs font-medium mb-3">
              NISN: <strong>{selectedStudent.nisn}</strong> &bull; Kelas: <strong>{selectedStudent.className}</strong>
            </div>

            <div className="w-64 h-64 sm:w-80 sm:h-80 mx-auto bg-white p-2 flex items-center justify-center">
              <img
                src={qrDataUrl}
                alt="QR Code Zoom"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="mt-4 font-mono font-bold text-sm bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-300 text-slate-900 inline-block">
              {selectedStudent.startBarcodeToken}
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              Ketuk di luar kotak atau tekan tombol tutup untuk kembali.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
