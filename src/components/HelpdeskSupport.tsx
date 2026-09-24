import React, { useState } from "react";
import { MessageSquare, Phone, Copy, Check, ExternalLink, HelpCircle, X, ShieldAlert, LifeBuoy } from "lucide-react";

interface HelpdeskSupportProps {
  phoneNumber?: string;
  adminName?: string;
  variant?: "pill" | "card" | "compact" | "banner";
  context?: "login" | "locked" | "exam" | "disqualified" | "general";
  studentName?: string;
  studentNisn?: string;
  className?: string;
}

export const HelpdeskSupport: React.FC<HelpdeskSupportProps> = ({
  phoneNumber = "085240195357",
  adminName = "Admin CBT (Gusthy Palin Patanda)",
  variant = "pill",
  context = "general",
  studentName,
  studentNisn,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Clean phone number for WhatsApp international format (e.g. 085240195357 -> 6285240195357)
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  const waNumber = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;

  // Format display phone number e.g. 0852-4019-5357
  const displayPhone =
    cleanPhone.length >= 10
      ? `${cleanPhone.slice(0, 4)}-${cleanPhone.slice(4, 8)}-${cleanPhone.slice(8)}`
      : phoneNumber;

  // Formulate pre-filled WhatsApp message based on student context
  const getWaMessage = () => {
    let msg = `Halo ${adminName}, saya butuh bantuan terkait aplikasi ujian GusthyPalinPatandaExam.\n\n`;
    if (studentName) msg += `*Nama Siswa:* ${studentName}\n`;
    if (studentNisn) msg += `*NISN:* ${studentNisn}\n`;

    if (context === "locked") {
      msg += `*Kendala:* Akun saya terkunci karena sudah pernah login. Mohon bantuan untuk reset sesi login agar saya dapat melanjutkan ujian. Terima kasih.`;
    } else if (context === "login") {
      msg += `*Kendala:* Saya mengalami kesulitan saat login ke portal ujian.`;
    } else if (context === "exam") {
      msg += `*Kendala:* Saya mengalami kendala teknis saat mengerjakan soal ujian.`;
    } else if (context === "disqualified") {
      msg += `*Kendala:* Sesi ujian saya terhenti karena sistem anti-kecurangan. Mohon arahan pengawas/admin.`;
    } else {
      msg += `*Kendala:* Saya membutuhkan informasi/bantuan teknis ujian.`;
    }
    return encodeURIComponent(msg);
  };

  const waUrl = `https://wa.me/${waNumber}?text=${getWaMessage()}`;

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 1. Variant: Compact Pill (for Navbar or Header)
  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition cursor-pointer ${className}`}
          title={`Helpdesk WA Admin: ${displayPhone}`}
          aria-label="Helpdesk WhatsApp Admin"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Helpdesk WA:</span>
          <span className="font-mono">{displayPhone}</span>
        </button>

        {showModal && renderModal()}
      </>
    );
  }

  // 2. Variant: Pill Button
  if (variant === "pill") {
    return (
      <>
        <div className={`inline-flex items-center space-x-2 ${className}`}>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer group"
          >
            <MessageSquare className="w-4 h-4 fill-white/20 group-hover:scale-110 transition-transform" />
            <span>WA Helpdesk: {displayPhone}</span>
          </a>
          <button
            type="button"
            onClick={handleCopyNumber}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="Salin nomor WhatsApp"
            aria-label="Salin nomor WhatsApp"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showModal && renderModal()}
      </>
    );
  }

  // 3. Variant: Banner (e.g. for Locked Account or Urgent Support)
  if (variant === "banner") {
    return (
      <div className={`p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-sm text-white flex items-center space-x-2">
              <span>Pusat Bantuan &amp; Helpdesk Ujian</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase">
                WhatsApp Siaga
              </span>
            </h5>
            <p className="text-xs text-emerald-200/90 mt-0.5">
              Kendala akun terkunci, lupa token, atau gangguan teknis? Hubungi Admin Helpdesk:{" "}
              <strong className="text-white font-mono">{displayPhone}</strong> ({adminName})
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat WA Admin</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
          <button
            type="button"
            onClick={handleCopyNumber}
            className="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
            title="Salin nomor"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 4. Default Variant: Card (for Login Screen, Gate, or Results)
  return (
    <div className={`p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/40 text-left relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h5 className="font-extrabold text-xs sm:text-sm text-white">
                Helpdesk WhatsApp Admin CBT
              </h5>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                Online
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Jika akun Anda terkunci, lupa NISN/password, atau token bermasalah, segera hubungi:
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-black text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                {displayPhone}
              </span>
              <span className="text-[11px] text-slate-400">
                ({adminName})
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          Klik tombol di samping untuk kirim pesan otomatis
        </span>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopyNumber}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin No. WA</span>
              </>
            )}
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat WhatsApp</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );

  // Helpdesk Info Modal
  function renderModal() {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl text-left animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center space-x-2.5 text-emerald-400">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-base text-white">Helpdesk Admin Ujian</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Pusat bantuan teknis pelaksanaan ujian untuk siswa, guru, dan pengawas. Hubungi nomor WhatsApp resmi administrator di bawah ini:
          </p>

          <div className="my-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold">Nomor WhatsApp Admin:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                Aktif &amp; Siaga
              </span>
            </div>
            <p className="text-lg font-black font-mono text-emerald-400 tracking-wide">
              {displayPhone}
            </p>
            <p className="text-xs text-slate-400">
              Penanggung Jawab: <strong className="text-slate-200">{adminName}</strong>
            </p>
          </div>

          <div className="space-y-2 mb-5">
            <p className="text-xs font-bold text-slate-200">Layanan Bantuan Meliputi:</p>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Buka kunci akun (reset status login siswa yang terkunci)</li>
              <li>Konfirmasi token ujian dan kartu barcode NISN</li>
              <li>Kendala perizinan kamera AI proctoring</li>
              <li>Penanganan gangguan jaringan / koneksi ujian</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyNumber}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Nomor Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Nomor WA</span>
                </>
              )}
            </button>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Buka WhatsApp</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }
};
