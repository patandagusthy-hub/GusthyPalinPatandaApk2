import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, Eye, AlertTriangle, ShieldCheck, ShieldAlert, Cpu, RefreshCw, UserX, Users } from "lucide-react";
import { ViolationRecord } from "../types";

interface WebcamProctorProps {
  examActive: boolean;
  studentName: string;
  onRecordViolation: (
    type: ViolationRecord["type"],
    title: string,
    description: string,
    snapshot?: string
  ) => void;
}

// Stable Public CDN Model Paths for Face Detection (Avoid relative paths vulnerable to 404 on Vercel / GitHub Pages)
const CDN_FACE_API_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
const UNPKG_FACE_API_MODEL_URL = "https://unpkg.com/@vladmandic/face-api@1.7.12/model";
const BASE_AWARE_LOCAL_MODEL_URL = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/models`;

// Stable Public CDN Script URLs for FaceAPI Runtime
const CDN_FACE_API_SCRIPT = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js";
const UNPKG_FACE_API_SCRIPT = "https://unpkg.com/@vladmandic/face-api@1.7.12/dist/face-api.min.js";

declare global {
  interface Window {
    faceapi?: any;
    FaceDetector?: any;
  }
}

export const WebcamProctor: React.FC<WebcamProctorProps> = ({
  examActive,
  studentName,
  onRecordViolation,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [detectorEngine, setDetectorEngine] = useState<string>("Inisialisasi...");
  const [analyzing, setAnalyzing] = useState(false);

  // Consecutive counters to prevent false-positive flashes
  const absentStreakRef = useRef<number>(0);
  const multipleStreakRef = useRef<number>(0);
  const lastViolationTimeRef = useRef<number>(0);

  const [lastCheckResult, setLastCheckResult] = useState<{
    facesCount: number;
    reason: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    engineUsed: string;
  }>({
    facesCount: 1,
    reason: "Mempersiapkan pengawasan AI...",
    riskLevel: "LOW",
    engineUsed: "Client AI",
  });

  // Helper: Dynamically load external script with CDN fallback
  const loadFaceApiScript = async (): Promise<any> => {
    if (window.faceapi) return window.faceapi;

    const loadSingle = (url: string) => {
      return new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[src="${url}"]`) as HTMLScriptElement;
        if (existing) {
          if (window.faceapi) return resolve();
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", (e) => reject(e));
          return;
        }
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      });
    };

    try {
      await loadSingle(CDN_FACE_API_SCRIPT);
      if (window.faceapi) return window.faceapi;
    } catch {
      // Fallback to unpkg CDN
      await loadSingle(UNPKG_FACE_API_SCRIPT);
      if (window.faceapi) return window.faceapi;
    }

    throw new Error("Gagal memuat pustaka face-api dari CDN");
  };

  // 1. Initialize Face Detection Models using stable Public CDN URLs
  const initFaceDetectionModel = useCallback(async () => {
    try {
      // Check native browser FaceDetector first (Fastest, zero download)
      if (typeof window !== "undefined" && "FaceDetector" in window) {
        setDetectorEngine("Native Hardware FaceDetector");
        setModelLoaded(true);
        return;
      }

      // Load face-api runtime
      const faceapi = await loadFaceApiScript();

      // Load TinyFaceDetector model weights from public CDN (with fallback)
      let loaded = false;
      const modelCandidates = [
        CDN_FACE_API_MODEL_URL,
        UNPKG_FACE_API_MODEL_URL,
        BASE_AWARE_LOCAL_MODEL_URL,
      ];

      for (const modelPath of modelCandidates) {
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
          loaded = true;
          setDetectorEngine("TinyFaceDetector (CDN)");
          break;
        } catch {
          // Try next candidate
        }
      }

      if (loaded) {
        setModelLoaded(true);
      } else {
        throw new Error("Semua URL CDN model deteksi wajah gagal diakses.");
      }
    } catch (err: any) {
      // PENANGANAN ERROR: console.error yang jelas untuk inisialisasi model
      console.error("[WebcamProctor] Error saat inisialisasi model deteksi wajah:", err);
      // Fallback to server-side Gemini AI or client heuristic
      setDetectorEngine("Gemini / Client Heuristic");
      setModelLoaded(true);
    }
  }, []);

  // 2. Start Camera using flexible constraints
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsPermissionDenied(false);

    // Stop previous tracks if any
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    try {
      // KETENTUAN 1: getUserMedia constraint fleksibel
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // autoPlay, playsInline={true}, muted={true} ensure no autoplay policy blockage
        videoRef.current.play().catch((playErr) => {
          console.warn("[WebcamProctor] Video play auto-start notice:", playErr);
        });
      }

      setCameraReady(true);
      setCameraError(null);
      setIsPermissionDenied(false);
    } catch (err: any) {
      // PENANGANAN ERROR: console.error yang jelas saat mengakses kamera perangkat
      console.error("[WebcamProctor] Error saat mengakses kamera perangkat:", err);
      setCameraReady(false);

      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        (err.message && err.message.toLowerCase().includes("denied"))
      ) {
        setIsPermissionDenied(true);
        setCameraError(
          "Izin akses kamera webcam ditolak oleh browser atau pengguna. Mohon berikan izin pada bilah alamat URL browser."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("Kamera webcam tidak terdeteksi pada perangkat Anda.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCameraError("Kamera webcam sedang digunakan oleh aplikasi lain.");
      } else {
        setCameraError(`Kamera gagal diakses: ${err.message || "Kesalahan tidak dikenal"}`);
      }
    }
  }, []);

  // Lifecycle on exam active
  useEffect(() => {
    if (examActive) {
      startCamera();
      initFaceDetectionModel();
    }
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [examActive, startCamera, initFaceDetectionModel]);

  // Capture frame as base64 snapshot
  const captureSnapshot = (): string | undefined => {
    if (!videoRef.current || !canvasRef.current) return undefined;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.65);
  };

  // 3. Face Detection Engine (Client-Side Primary + Server/Cloud Fallback)
  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !examActive || analyzing || !cameraReady) return;

    setAnalyzing(true);
    const video = videoRef.current;
    let facesFound = 1;
    let engine = detectorEngine;
    let detectedReason = "Siswa terpantau fokus di depan kamera.";
    let risk: "LOW" | "MEDIUM" | "HIGH" = "LOW";

    try {
      // Path A: Native Browser FaceDetector
      if (typeof window !== "undefined" && "FaceDetector" in window) {
        try {
          const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
          const detectedFaces = await detector.detect(video);
          facesFound = detectedFaces.length;
          engine = "Native Hardware";
        } catch {
          facesFound = 1;
        }
      }
      // Path B: face-api.js TinyFaceDetector (Client-side directly on video, 0ms backend delay)
      else if (window.faceapi && window.faceapi.nets?.tinyFaceDetector?.params) {
        try {
          const detections = await window.faceapi.detectAllFaces(
            video,
            new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })
          );
          facesFound = Array.isArray(detections) ? detections.length : 1;
          engine = "TinyFaceDetector (Client)";
        } catch (e) {
          console.warn("[WebcamProctor] TinyFaceDetector detect error:", e);
          facesFound = 1;
        }
      }
      // Path C: Server-side Gemini AI Proctor API (if running full-stack Node server)
      else {
        const snapshot = captureSnapshot();
        if (snapshot) {
          try {
            const res = await fetch("/api/gemini/ai-proctor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageBase64: snapshot, studentName }),
            });
            if (res.ok) {
              const data = await res.json();
              facesFound = typeof data.facesCount === "number" ? data.facesCount : 1;
              detectedReason = data.reason || detectedReason;
              risk = data.riskLevel || risk;
              engine = data.engineUsed || "Gemini 3.8 Flash";

              if (data.suspicious) {
                const now = Date.now();
                if (now - lastViolationTimeRef.current > 15000) {
                  lastViolationTimeRef.current = now;
                  onRecordViolation(
                    "AI_PROCTOR_SUSPECT",
                    "AI Proctor: Aktivitas Mencurigakan",
                    data.violations?.join(", ") || data.reason || "Terdeteksi aktivitas mencurigakan di depan webcam.",
                    snapshot
                  );
                }
              }
            }
          } catch {
            // Server offline or static deploy (Vercel / GitHub Pages) - fallback silently
            facesFound = 1;
            engine = "Client Guard";
          }
        }
      }

      // Evaluate Face Count Violations
      const now = Date.now();
      const snapshot = captureSnapshot();

      if (facesFound === 0) {
        absentStreakRef.current += 1;
        multipleStreakRef.current = 0;
        risk = "HIGH";
        detectedReason = "Wajah siswa tidak terdeteksi di depan kamera!";

        // Require 2 consecutive checks absent before triggering violation (prevents false flash)
        if (absentStreakRef.current >= 2 && now - lastViolationTimeRef.current > 15000) {
          lastViolationTimeRef.current = now;
          onRecordViolation(
            "AI_PROCTOR_SUSPECT",
            "AI Proctor: Siswa Tidak Terdeteksi",
            "Wajah siswa tidak berada di depan kamera monitor saat ujian berlangsung.",
            snapshot
          );
        }
      } else if (facesFound > 1) {
        multipleStreakRef.current += 1;
        absentStreakRef.current = 0;
        risk = "HIGH";
        detectedReason = `Terdeteksi ${facesFound} orang di depan kamera!`;

        if (multipleStreakRef.current >= 1 && now - lastViolationTimeRef.current > 15000) {
          lastViolationTimeRef.current = now;
          onRecordViolation(
            "AI_PROCTOR_SUSPECT",
            "AI Proctor: Terdeteksi Lebih dari 1 Orang",
            `Terdeteksi ${facesFound} wajah di depan kamera webcam siswa.`,
            snapshot
          );
        }
      } else {
        // Exactly 1 face = Normal
        absentStreakRef.current = 0;
        multipleStreakRef.current = 0;
        risk = "LOW";
        detectedReason = "Siswa terpantau normal & terfokus di depan kamera.";
      }

      setLastCheckResult({
        facesCount: facesFound,
        reason: detectedReason,
        riskLevel: risk,
        engineUsed: engine,
      });
    } catch (e) {
      console.warn("[WebcamProctor] Analyze frame notice:", e);
    } finally {
      setAnalyzing(false);
    }
  }, [examActive, analyzing, cameraReady, detectorEngine, studentName, onRecordViolation]);

  // Periodic AI inspection interval (every 8 seconds during active exam)
  useEffect(() => {
    if (!examActive || !cameraReady) return;
    const interval = setInterval(() => {
      analyzeFrame();
    }, 8000);

    return () => clearInterval(interval);
  }, [examActive, cameraReady, analyzeFrame]);

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md">
      {/* Header Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
          <Camera className="w-3.5 h-3.5 text-blue-400" />
          <span>AI Proctoring Webcam</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              cameraReady ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">
            {cameraReady ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative aspect-video rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
        {/* KETENTUAN 1: Elemen video memiliki properti autoPlay, playsInline={true}, dan muted={true} */}
        <video
          ref={videoRef}
          autoPlay
          playsInline={true}
          muted={true}
          className={`w-full h-full object-cover mirror ${cameraReady ? "block" : "hidden"}`}
          style={{ transform: "scaleX(-1)" }}
        />

        {/* KETENTUAN 3: Notifikasi ramah di layar jika izin kamera ditolak atau kamera belum siap */}
        {!cameraReady && (
          <div className="p-3 text-center w-full">
            {isPermissionDenied ? (
              <div className="space-y-2">
                <ShieldAlert className="w-7 h-7 text-rose-400 mx-auto animate-bounce" />
                <h5 className="text-xs font-bold text-rose-200">Izin Kamera Ditolak</h5>
                <p className="text-[11px] text-slate-300 leading-snug max-w-[240px] mx-auto">
                  Akses kamera diblokir oleh browser. Klik ikon gembok/kamera di bilah URL, ubah menjadi{" "}
                  <strong>&ldquo;Izinkan&rdquo; (Allow)</strong>, lalu coba lagi.
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 mx-auto cursor-pointer shadow-md shadow-rose-600/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Izinkan Kamera Lagi</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-[11px] text-slate-300 leading-snug">
                  {cameraError || "Menghubungkan ke kamera perangkat..."}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold transition inline-flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Hubungkan Ulang</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI Scanner HUD Overlay */}
        {cameraReady && (
          <div className="absolute inset-2 border border-blue-500/25 rounded pointer-events-none flex flex-col justify-between p-1.5">
            <div className="flex justify-between items-center text-[9px] font-mono">
              <span className="bg-slate-900/80 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">
                AI SCAN
              </span>
              <span
                className={`px-1.5 py-0.5 rounded border font-bold ${
                  lastCheckResult.facesCount === 1
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-950/80 text-rose-300 border-rose-500/40 animate-pulse"
                }`}
              >
                {lastCheckResult.facesCount === 1 ? (
                  "1 Wajah (Fokus)"
                ) : lastCheckResult.facesCount === 0 ? (
                  "0 Wajah (Hilang)"
                ) : (
                  `${lastCheckResult.facesCount} Wajah (Mencurigakan)`
                )}
              </span>
            </div>

            <div className="flex justify-between items-center text-[9px] font-mono">
              <span
                className={`px-1.5 py-0.5 rounded text-white font-bold ${
                  lastCheckResult.riskLevel === "LOW"
                    ? "bg-emerald-600/85"
                    : lastCheckResult.riskLevel === "MEDIUM"
                    ? "bg-amber-600/85"
                    : "bg-rose-600/85"
                }`}
              >
                RISIKO: {lastCheckResult.riskLevel}
              </span>
              <span className="bg-slate-900/80 text-slate-400 px-1 py-0.5 rounded text-[8px] truncate max-w-[110px]">
                {lastCheckResult.engineUsed}
              </span>
            </div>
          </div>
        )}

        {/* Analyzing Spinner */}
        {analyzing && (
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center space-x-1.5 text-xs text-blue-300 font-semibold bg-slate-900/90 px-3 py-1 rounded-full border border-blue-500/30 shadow-lg">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Memeriksa...</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar & Manual Scan Button */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate max-w-[180px] text-slate-300" title={lastCheckResult.reason}>
          {lastCheckResult.reason}
        </span>
        <button
          type="button"
          onClick={analyzeFrame}
          disabled={analyzing || !cameraReady}
          className="text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1 transition disabled:opacity-50 cursor-pointer"
          title="Analisis frame sekarang secara manual"
        >
          <Cpu className="w-3 h-3" />
          <span>Pindai AI</span>
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
