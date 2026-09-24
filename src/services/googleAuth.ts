import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import firebaseAppletConfig from "../../firebase-applet-config.json";

// Configured Drive Scopes as requested
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.activity",
  "https://www.googleapis.com/auth/drive.activity.readonly",
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/drive.apps.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.install",
  "https://www.googleapis.com/auth/drive.meet.readonly",
  "https://www.googleapis.com/auth/drive.metadata",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.photos.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.scripts",
];

// Initialize dedicated Auth App for Workspace OAuth
const AUTH_APP_NAME = "googleWorkspaceAuthApp";
const existingAuthApp = getApps().find((a) => a.name === AUTH_APP_NAME);
export const authApp =
  existingAuthApp || initializeApp(firebaseAppletConfig, AUTH_APP_NAME);
export const auth = getAuth(authApp);

const provider = new GoogleAuthProvider();
// Add all requested Drive scopes to the Google Auth Provider
DRIVE_SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: "consent",
  access_type: "offline",
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token strictly in memory (per skill guidelines)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

// Initialize auth state listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedGoogleUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token not in memory; user needs to click Sign in with Google to obtain fresh token
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedGoogleUser = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google with Workspace Drive scopes
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal memperoleh token otorisasi dari Google");
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("[GoogleAuth] Sign-in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getGoogleUser = (): User | null => {
  return cachedGoogleUser;
};

export const isGoogleSignedIn = (): boolean => {
  return Boolean(cachedAccessToken && cachedGoogleUser);
};

export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("[GoogleAuth] SignOut warning:", e);
  } finally {
    cachedAccessToken = null;
    cachedGoogleUser = null;
  }
};
