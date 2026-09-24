import { useState, useEffect } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  clearWasOffline: () => void;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date());
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      // Flag that we recovered from offline so UI can show sync confirmation
      setWasOffline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Optional heartbeat to verify real network connectivity
    const interval = setInterval(async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        const res = await fetch("/api/health", { method: "HEAD", cache: "no-store" });
        if (res.ok) {
          setIsOnline(true);
        }
      } catch {
        // If network request failed, user lost connection
        setIsOnline(false);
      }
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const clearWasOffline = () => {
    setWasOffline(false);
  };

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    lastOfflineAt,
    clearWasOffline,
  };
}
