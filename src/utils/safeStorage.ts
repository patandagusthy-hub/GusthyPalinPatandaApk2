/**
 * Safe localStorage wrapper that gracefully handles:
 * - Sandboxed iframes (Google AI Studio preview) where localStorage access may throw SecurityError
 * - Incognito/private browsing with blocked third-party cookies & storage
 * - Server-side rendering (SSR) environments where window is undefined
 * - QuotaExceeded errors
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Sandbox security restrictions or disabled storage
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Sandbox security restrictions or quota exceeded
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  },
};
