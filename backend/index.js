require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve frontend (IMPORTANT)
app.use(express.static(path.join(__dirname, "../")));

// ✅ API KEY MIDDLEWARE
app.use("/api", (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  console.log("Incoming Key:", apiKey);
  console.log("Expected Key:", process.env.API_KEY);

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  next();
});

// ✅ ROUTES
app.use("/api/payment", require("./routes/paymentRoutes"));

// ✅ GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({ success: false, message: err.message });
});

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});