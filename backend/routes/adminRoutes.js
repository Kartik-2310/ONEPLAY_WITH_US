const express = require("express");
const router = express.Router();
const { approveWithdraw, rejectWithdraw, getPendingWithdrawals } = require("../controllers/adminController");

router.get("/admin/pending-withdrawals", getPendingWithdrawals);

// ✅ FIXED: Kept only one approve route (using URL param)
// The body-based route was redundant — removed to avoid confusion
router.post("/admin/withdrawals/:id/approve", approveWithdraw);
router.post("/admin/reject-withdrawal", rejectWithdraw);

module.exports = router;