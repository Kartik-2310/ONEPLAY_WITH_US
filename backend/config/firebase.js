const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let db;

try {
  if (!admin.apps.length) {
    // First priority: Render/production environment variable (full JSON string)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase initialized from environment variable");
    } else {
      // Fallback: Local JSON file
      const envPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        "./config/serviceAccountKey.json";

      const serviceAccountPath = path.resolve(process.cwd(), envPath);
      console.log(`[Firebase] Checking service account at: ${serviceAccountPath}`);

      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account JSON NOT FOUND at ${serviceAccountPath}`);
      }

      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase initialized from local JSON file");
    }
  }

  db = admin.firestore();
  console.log("✅ Firestore connected");
} catch (err) {
  console.error("❌ Firebase initialization error:", err.message);
  process.exit(1); // Stop server if Firebase fails — better than silent failures
}

module.exports = { admin, db };