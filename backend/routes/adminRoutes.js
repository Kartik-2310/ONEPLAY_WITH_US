const express = require("express");
const router = express.Router();

const { approveWithdraw, rejectWithdraw, getPendingWithdrawals } = require("../controllers/adminController");

router.get("/admin/pending-withdrawals", getPendingWithdrawals);
router.post("/admin/withdrawals/:id/approve", approveWithdraw);
router.post("/admin/approve-withdrawal", approveWithdraw);
router.post("/admin/reject-withdrawal", rejectWithdraw);

module.exports = router;
