import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDVJje6GosXzmFzPAdFQ3qA2sDwOfjthKY",
  authDomain: "high-beacon-8xctm.firebaseapp.com",
  projectId: "high-beacon-8xctm",
  storageBucket: "high-beacon-8xctm.firebasestorage.app",
  messagingSenderId: "966508498471",
  appId: "1:966508498471:web:d9df6f31e504a7d5520802",
  measurementId: "",
};

export const FIRESTORE_DATABASE_ID = "ai-studio-gusthypalinpatan-c08bed96-8ce9-4794-a290-3b116849de0a";

// Initialize Firebase (singleton pattern specifically targeting [DEFAULT] app)
export const app =
  getApps().find((a) => a.name === "[DEFAULT]") ||
  initializeApp(firebaseConfig);

export const db = getFirestore(app, FIRESTORE_DATABASE_ID);

export default db;
