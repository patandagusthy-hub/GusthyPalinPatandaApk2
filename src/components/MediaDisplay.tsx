import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  Image as ImageIcon,
  Headphones,
  Video as VideoIcon,
  AlertCircle,
} from "lucide-react";

interface MediaDisplayProps {
  mediaType?: "none" | "image" | "audio" | "video";
  mediaUrl?: string;
  mediaCaption?: string;
  audioPlayLimit?: number; // 0 or undefined = unlimited
  questionId?: string;
  readOnly?: boolean; // e.g. in preview mode
}

export const MediaDisplay: React.FC<MediaDisplayProps> = ({
  mediaType,
  mediaUrl,
  mediaCaption,
  audioPlayLimit = 0,
  questionId = "default",
  readOnly = false,
}) => {
  // Image lightbox modal
  const [isZoomed, setIsZoomed] = useState(false);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // Play count tracking for Listening Tests
  const [playCount, setPlayCount] = useState<number>(() => {
    if (readOnly || !questionId) return 0;
    try {
      const stored = localStorage.getItem(`audio_plays_${questionId}`);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (!readOnly && questionId) {
      try {
        localStorage.setItem(`audio_plays_${questionId}`, playCount.toString());
      } catch {
        // ignore
      }
    }
  }, [playCount, questionId, readOnly]);

  // Video embed helper
  const getEmbedUrl = (url: string): { isEmbed: boolean; url: string } => {
    if (!url) return { isEmbed: false, url: "" };
    // YouTube detect
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch) {
      return { isEmbed: true, url: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }
    // Google Drive video embed
    if (url.includes("drive.google.com/file/d/")) {
      const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        return { isEmbed: true, url: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
      }
    }
    return { isEmbed: false, url };
  };

  if (!mediaType || mediaType === "none" || !mediaUrl) {
    return null;
  }

  // Format seconds mm:ss
  const formatTime = (timeInSec: number) => {
    if (isNaN(timeInSec)) return "00:00";
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Check play limit
      if (audioPlayLimit > 0 && playCount >= audioPlayLimit) {
        return; // Limit reached
      }

      // If starting from beginning or uncounted play
      if (currentTime === 0 || audioRef.current.ended) {
        setPlayCount((prev) => prev + 1);
      }

      audioRef.current.play().catch((err) => {
        console.warn("Audio play blocked or failed:", err);
        setAudioError(true);
      });
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const isLimitReached = audioPlayLimit > 0 && playCount >= audioPlayLimit;

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 p-3 sm:p-4 shadow-md transition">
      {/* 1. IMAGE DISPLAY */}
      {mediaType === "image" && (
        <div className="space-y-2">
          <div className="group relative flex justify-center overflow-hidden rounded-xl bg-slate-900/60 p-2">
            <img
              src={mediaUrl}
              alt={mediaCaption || "Gambar Soal Ujian"}
              className="max-h-72 w-auto max-w-full rounded-lg object-contain shadow-sm transition hover:opacity-95"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setIsZoomed(true)}
              className="absolute right-3 top-3 flex items-center space-x-1 rounded-lg bg-slate-950/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 backdrop-blur-md opacity-90 transition hover:bg-blue-600 hover:text-white"
              title="Perbesar Gambar"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Perbesar</span>
            </button>
          </div>
          {mediaCaption && (
            <p className="text-center text-xs font-medium text-slate-400 italic">
              {mediaCaption}
            </p>
          )}

          {/* Lightbox Zoom Modal */}
          {isZoomed && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
              onClick={() => setIsZoomed(false)}
            >
              <div
                className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <span>Tampilan Gambar Diperbesar</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsZoomed(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <img
                  src={mediaUrl}
                  alt={mediaCaption || "Gambar Diperbesar"}
                  className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
                {mediaCaption && (
                  <p className="mt-2 text-center text-xs font-semibold text-slate-300">
                    {mediaCaption}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. AUDIO DISPLAY (LISTENING TEST) */}
      {mediaType === "audio" && (
        <div className="space-y-3">
          <audio
            ref={audioRef}
            src={mediaUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleAudioEnded}
            onError={() => setAudioError(true)}
            preload="metadata"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30">
                <Headphones className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-200">
                  Audio Sesi Listening (Tes Mendengarkan)
                </h4>
                <p className="text-[11px] text-slate-400">
                  {mediaCaption || "Dengarkan audio dengan saksama untuk menjawab butir soal ini."}
                </p>
              </div>
            </div>

            {/* Play Limit Badge */}
            {audioPlayLimit > 0 ? (
              <div
                className={`flex items-center space-x-1.5 self-start sm:self-auto rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                  isLimitReached
                    ? "bg-rose-950/80 text-rose-300 border-rose-500/50"
                    : "bg-purple-950/80 text-purple-300 border-purple-500/40"
                }`}
              >
                <span>Batas Putar:</span>
                <span className="font-extrabold">
                  {playCount} / {audioPlayLimit} Kali
                </span>
                {isLimitReached && (
                  <span className="text-[10px] text-rose-400 font-semibold">(Habis)</span>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-800">
                <span>Putaran Bebas ({playCount}x didengar)</span>
              </div>
            )}
          </div>

          {audioError ? (
            <div className="flex items-center space-x-2 rounded-xl bg-rose-950/50 p-3 text-xs text-rose-300 border border-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>Gagal memuat berkas audio. Pastikan URL berkas audio valid atau berformat MP3/WAV/OGG.</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              {/* Play / Pause button */}
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={isLimitReached && !isPlaying}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition cursor-pointer ${
                  isLimitReached && !isPlaying
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : isPlaying
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20"
                    : "bg-purple-600 text-white hover:bg-purple-500 shadow-purple-600/30"
                }`}
                title={
                  isLimitReached && !isPlaying
                    ? "Batas pemutaran audio listening telah habis"
                    : isPlaying
                    ? "Jeda Audio"
                    : "Putar Audio"
                }
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>

              {/* Progress Slider */}
              <div className="w-full flex-1 space-y-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={isLimitReached && !isPlaying}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-purple-500 transition focus:outline-none"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Mute toggle */}
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                title={isMuted ? "Aktifkan Suara" : "Bisukan"}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. VIDEO DISPLAY */}
      {mediaType === "video" && (
        <div className="space-y-2">
          {(() => {
            const embedInfo = getEmbedUrl(mediaUrl);
            if (embedInfo.isEmbed) {
              return (
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
                  <iframe
                    src={embedInfo.url}
                    title={mediaCaption || "Video Ujian"}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }
            return (
              <div className="overflow-hidden rounded-xl bg-black shadow-lg">
                <video
                  src={mediaUrl}
                  controls
                  controlsList="nodownload"
                  className="max-h-80 w-full rounded-xl object-contain mx-auto"
                >
                  Browser Anda tidak mendukung pemutar video HTML5.
                </video>
              </div>
            );
          })()}

          {mediaCaption && (
            <p className="text-center text-xs font-semibold text-slate-300 italic">
              {mediaCaption}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
