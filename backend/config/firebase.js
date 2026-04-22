const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let db;

try {
  if (!admin.apps.length) {
    console.log("🔧 Firebase initialization starting...");
    console.log("Environment:", process.env.NODE_ENV || "development");

    // ==========================================
    // PRIORITY 1: Environment Variables (Render/Production)
    // ==========================================
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      console.log("📋 Using individual environment variables (Render production method)");
      
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "",
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID || "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || ""
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase initialized from environment variables (RECOMMENDED)");
    }
    // ==========================================
    // PRIORITY 2: JSON String Environment Variable
    // ==========================================
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      console.log("📋 Using FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
      
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase initialized from JSON string");
      } catch (parseErr) {
        throw new Error(`Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON: ${parseErr.message}`);
      }
    }
    // ==========================================
    // PRIORITY 3: Local JSON File (Development Only)
    // ==========================================
    else if (process.env.NODE_ENV !== "production") {
      console.log("📋 Trying local serviceAccountKey.json (development only)");
      
      const envPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        "./config/serviceAccountKey.json";

      const serviceAccountPath = path.resolve(process.cwd(), envPath);
      console.log(`📂 Service account path: ${serviceAccountPath}`);

      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(
          `❌ Service account NOT FOUND at ${serviceAccountPath}\n` +
          `For Render: Set FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, and FIREBASE_PROJECT_ID\n` +
          `For local dev: Create/verify serviceAccountKey.json`
        );
      }

      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase initialized from local JSON file");
    }
    // ==========================================
    // ERROR: No credentials found
    // ==========================================
    else {
      throw new Error(
        "❌ No Firebase credentials found!\n\n" +
        "FOR RENDER (Production):\n" +
        "1. Go to Render Dashboard → Environment\n" +
        "2. Add these variables:\n" +
        "   - FIREBASE_PROJECT_ID: " + process.env.FIREBASE_PROJECT_ID + "\n" +
        "   - FIREBASE_PRIVATE_KEY: (from service account JSON)\n" +
        "   - FIREBASE_CLIENT_EMAIL: (from service account JSON)\n" +
        "   - FIREBASE_PRIVATE_KEY_ID: (optional)\n" +
        "   - FIREBASE_CLIENT_ID: (optional)\n\n" +
        "FOR LOCAL DEV:\n" +
        "Create backend/config/serviceAccountKey.json from Firebase Console"
      );
    }
  }

  // ==========================================
  // Initialize Firestore
  // ==========================================
  db = admin.firestore();
  console.log("✅ Firestore connected successfully for project: " + (process.env.FIREBASE_PROJECT_ID || "unknown"));
  
} catch (err) {
  console.error("\n" + "=".repeat(60));
  console.error("❌ FIREBASE INITIALIZATION FAILED");
  console.error("=".repeat(60));
  console.error("Error:", err.message);
  console.error("=".repeat(60) + "\n");

  // Do NOT exit — let server start so diagnostic endpoints work
  // Firestore calls will fail until credentials are set
  db = null;
}

module.exports = { admin, db };