require('dotenv').config();
console.log("ENV PATH:", process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

// ⚠️ Warn if NOTIFY_URL is not set
if (!process.env.NOTIFY_URL) {
  console.warn("⚠️ WARNING: NOTIFY_URL is not set in .env — Cashfree webhooks will go to a placeholder URL and never arrive!");
} else {
  console.log("✅ NOTIFY_URL:", process.env.NOTIFY_URL);
}

const express = require('express');
const cors = require('cors');
const path = require('path');

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
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "x-api-key"]
}));

// ✅ JSON + RAW BODY (for webhook signature verification)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// ✅ API KEY MIDDLEWARE
app.use('/api', (req, res, next) => {
  console.log("\n━━━━━━━ API REQUEST ━━━━━━━");
  console.log("URL:", req.originalUrl);
  console.log("METHOD:", req.method);

  // Skip auth for webhook and create-order (called by Cashfree / frontend without API key)
  const openPaths = [
    '/payment/cashfree/webhook',
    '/payment/cashfree/webhook/',
    '/payment/create-order',
    '/payment/create-order/',
    '/create-order',
    '/create-order/'
  ];

  if (openPaths.includes(req.path)) {
    console.log("✅ Open endpoint - skipping auth check\n");
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  // ✅ FIXED: No hardcoded fallback key — only env variable
  if (!apiKey || apiKey !== process.env.API_KEY) {
    console.error("🔒 Unauthorized. Got key:", apiKey, "\n");
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

// ✅ GLOBAL ERROR HANDLER
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