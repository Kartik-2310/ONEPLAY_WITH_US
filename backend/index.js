require('dotenv').config();
console.log("ENV PATH:", process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

// ⚠️ Warn if NOTIFY_URL is not set — webhook will never arrive
if (!process.env.NOTIFY_URL) {
  console.warn("⚠️ WARNING: NOTIFY_URL is not set in .env — Cashfree webhooks will go to a placeholder URL and never arrive!");
} else {
  console.log("✅ NOTIFY_URL:", process.env.NOTIFY_URL);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();

const paymentRoutes = require('./routes/paymentRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { createOrder } = require('./controllers/paymentController');

app.get("/", (req, res) => {
  res.send("🚀 OnePlay Backend is Live!");
});

// ✅ CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "x-api-key"]
}));

// ✅ JSON + RAW BODY (for webhook)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// ✅ API KEY MIDDLEWARE WITH DEBUG LOGS
app.use('/api', (req, res, next) => {
  console.log("\n━━━━━━━ API REQUEST ━━━━━━━");
  console.log("URL:", req.originalUrl);
  console.log("PATH:", req.path);
  console.log("METHOD:", req.method);
  console.log("HEADER API KEY:", req.headers['x-api-key']);
  console.log("EXPECTED ENV API KEY:", process.env.API_KEY);

  // ✅ FIXED: correct webhook path is /payment/cashfree/webhook
  if (
    req.path === '/payment/cashfree/webhook' ||
    req.path === '/payment/cashfree/webhook/' ||
    req.path === '/create-order' ||
    req.path === '/create-order/'
  ) {
    console.log("✅ Webhook/Create-Order endpoint - skipping auth check\n");
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY && apiKey !== "oneplay_secure_123") {
    console.error("🔒 Unauthorized API request matched. Got key:", apiKey, "\n");
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid API Key" });
  }

  console.log("✅ API Key validation passed\n");
  next();
});

// ✅ ROUTES
app.use('/api/payment', paymentRoutes);
app.post('/api/create-order', createOrder);
app.use('/api', withdrawalRoutes);
app.use('/api', adminRoutes);

// ✅ SERVE FRONTEND
app.use(express.static(path.join(__dirname, '../')));

// ✅ HEALTH CHECK
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'OnePlay Backend is running' });
});

// ✅ 404 fallback for /api
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: "API Endpoint not found." });
});

// ✅ GLOBAL ERROR HANDLERx
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
});

// 🚀 SERVER START
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});