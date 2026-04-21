const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let db;

try {
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/serviceAccountKey.json';
  
  // Resolve path safely relative to where node is executed (backend root)
  const serviceAccountPath = path.resolve(process.cwd(), envPath);

  console.log(`[Firebase] Checking for service account key at: ${serviceAccountPath}`);

  if (!fs.existsSync(serviceAccountPath)) {
    console.warn(`[Firebase WARNING] Service account JSON NOT FOUND at ${serviceAccountPath}`);
    console.warn("[Firebase WARNING] App will boot, but database operations will crash unless this is fixed.");
  } else {
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log("✅ Firebase initialized securely!");
  }
} catch (err) {
  console.error("❌ Firebase initialization error:", err.message);
}
const admin = require('firebase-admin');

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("✅ Firebase initialized from Render environment variable");
}

module.exports = { db };