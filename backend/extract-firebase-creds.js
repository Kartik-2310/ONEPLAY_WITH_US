#!/usr/bin/env node

/**
 * 🔐 Safely Extract Firebase Service Account Credentials
 * 
 * This script helps you extract credentials from your Firebase service account JSON
 * and format them correctly for Render environment variables.
 * 
 * Usage:
 *   node extract-firebase-creds.js /path/to/serviceAccountKey.json
 */

const fs = require('fs');
const path = require('path');

function extractCredentials(filePath) {
  try {
    // Read the service account JSON file
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const serviceAccount = JSON.parse(content);

    // Validate required fields
    const required = ['project_id', 'private_key', 'client_email'];
    const missing = required.filter(field => !serviceAccount[field]);
    
    if (missing.length > 0) {
      console.error(`❌ Missing required fields: ${missing.join(', ')}`);
      process.exit(1);
    }

    // Extract values
    const projectId = serviceAccount.project_id;
    const clientEmail = serviceAccount.client_email;
    const privateKeyId = serviceAccount.private_key_id || '';
    const clientId = serviceAccount.client_id || '';
    const clientCertUrl = serviceAccount.client_x509_cert_url || '';
    // Keep private key with \n as literal characters for env var
    const privateKey = serviceAccount.private_key;

    // Display extracted credentials
    console.log('\n' + '='.repeat(70));
    console.log('🔐 FIREBASE CREDENTIALS FOR RENDER ENVIRONMENT VARIABLES');
    console.log('='.repeat(70) + '\n');

    console.log('📋 Copy these values to Render Dashboard → Environment:\n');

    console.log('1️⃣  FIREBASE_PROJECT_ID:');
    console.log(`   ${projectId}\n`);

    console.log('2️⃣  FIREBASE_CLIENT_EMAIL:');
    console.log(`   ${clientEmail}\n`);

    console.log('3️⃣  FIREBASE_PRIVATE_KEY_ID (optional):');
    console.log(`   ${privateKeyId}\n`);

    console.log('4️⃣  FIREBASE_CLIENT_ID (optional):');
    console.log(`   ${clientId}\n`);

    console.log('5️⃣  FIREBASE_CLIENT_CERT_URL (optional):');
    console.log(`   ${clientCertUrl}\n`);

    console.log('6️⃣  FIREBASE_PRIVATE_KEY (⚠️ MOST IMPORTANT):');
    console.log('   Paste this entire key (including -----BEGIN/END lines):');
    console.log(`   ${privateKey}\n`);

    // ⚠️ SECURITY WARNING
    console.log('='.repeat(70));
    console.log('⚠️  SECURITY WARNING');
    console.log('='.repeat(70));
    console.log('✋ DO NOT:');
    console.log('   - Commit serviceAccountKey.json to git');
    console.log('   - Share these credentials');
    console.log('   - Post them online or in screenshots');
    console.log('   - Store them in plain text locally\n');
    console.log('✅ DO:');
    console.log('   - Add to Render environment variables');
    console.log('   - Delete the JSON file after extracting');
    console.log('   - Use git .gitignore to prevent accidental commits');
    console.log('   - Rotate keys if ever exposed\n');

    // Verify the key format
    if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
      console.error('❌ WARNING: Private key format looks incorrect!');
      console.error('   Make sure you copied the entire key with BEGIN/END lines.');
      process.exit(1);
    }

    console.log('✅ Credentials extracted successfully!\n');

    // Create a JSON version for reference (not for env vars)
    const json = {
      FIREBASE_PROJECT_ID: projectId,
      FIREBASE_CLIENT_EMAIL: clientEmail,
      FIREBASE_PRIVATE_KEY_ID: privateKeyId,
      FIREBASE_CLIENT_ID: clientId,
      FIREBASE_CLIENT_CERT_URL: clientCertUrl,
      FIREBASE_PRIVATE_KEY: privateKey
    };

    // Save to optional temp file for reference (HIGHLY SECRET!)
    const tempFile = path.join(process.cwd(), '.env.firebase.temp');
    fs.writeFileSync(tempFile, Object.entries(json)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n'), { mode: 0o600 });
    
    console.log(`📝 Temporary reference saved to: ${tempFile}`);
    console.log('   ⚠️  DELETE THIS FILE after adding to Render!\n');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error instanceof SyntaxError) {
      console.error('\n📋 Make sure the file is valid JSON.');
    }
    process.exit(1);
  }
}

// Main
const filePath = process.argv[2];

if (!filePath) {
  console.log('Usage: node extract-firebase-creds.js /path/to/serviceAccountKey.json');
  console.log('\nExample:');
  console.log('  node extract-firebase-creds.js ./config/serviceAccountKey.json');
  process.exit(1);
}

extractCredentials(filePath);
