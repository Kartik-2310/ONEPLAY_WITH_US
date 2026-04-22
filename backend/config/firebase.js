const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let db;

try {
  if (!admin.apps.length) {
    // First priority: Render environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });

      console.log("✅ Firebase initialized from Render environment variable");
    } else {
      // Fallback: Local JSON file
      const envPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        "./config/serviceAccountKey.json";

      const serviceAccountPath = path.resolve(process.cwd(), envPath);

      console.log(
        `[Firebase] Checking for service account key at: ${serviceAccountPath}`
      );

      if (!fs.existsSync(serviceAccountPath)) {
        console.warn(
          `[Firebase WARNING] Service account JSON NOT FOUND at ${serviceAccountPath}`
        );
      } else {
        const serviceAccount = require(serviceAccountPath);

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });

        console.log("✅ Firebase initialized securely from local JSON file");
      }
    }
  }

  db = admin.firestore();
} catch (err) {
  console.error("❌ Firebase initialization error:", err.message);
}

module.exports = { admin, db };