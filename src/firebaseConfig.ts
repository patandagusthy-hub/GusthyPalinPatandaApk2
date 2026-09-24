import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyC1Xd7jcMFHwqf8ervUNjW3W3U_bNtceBU",
  authDomain: "gusthypalinpatanda4ca94.firebaseapp.com",
  projectId: "gusthypalinpatanda4ca94",
  storageBucket: "gusthypalinpatanda4ca94.firebasestorage.app",
  messagingSenderId: "125371380021",
  appId: "1:125371380021:web:ee94b4d51ce2feb261dc7c",
  measurementId: "G-2FE2Y79SZY",
};

// Initialize Firebase (singleton pattern specifically targeting [DEFAULT] app)
export const app =
  getApps().find((a) => a.name === "[DEFAULT]") ||
  initializeApp(firebaseConfig);
export const db = getFirestore(app);

export default db;
