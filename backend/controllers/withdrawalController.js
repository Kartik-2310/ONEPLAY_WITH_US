const { deductWalletBalance } = require('../services/firebaseService');
const { db } = require('../config/firebase');

exports.createWithdraw = async (req, res) => {
  try {
    const { userId, amount, upiId, upi } = req.body;
    
    // Support either userId or uid from frontend
    const uid = userId || req.body.uid;

    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: "Minimum withdraw ₹100"
      });
    }

    const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
    const actualUpi = upi || upiId;

    if (!actualUpi || !upiRegex.test(actualUpi)) {
      return res.status(400).json({
        success: false,
        message: "Invalid UPI ID"
      });
    }

    const [name, handle] = actualUpi.split("@");

    if (!name || !handle) {
      return res.status(400).json({
        success: false,
        message: "Invalid UPI ID"
      });
    }

    const validHandles = [
      "upi", "ybl", "okaxis", "okhdfcbank",
      "okicici", "paytm", "ibl", "axl"
    ];

    if (!validHandles.includes(handle)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported UPI handle"
      });
    }

    // 🔥 STEP 1: Deduct winnings FIRST
    await deductWalletBalance(uid, amount);

    // 🔥 STEP 2: Create withdrawal request safely AFTER deduction
    await db.collection("withdrawals").add({
      uid,
      amount,
      upiId: actualUpi,
      status: "pending",
      createdAt: new Date() // Will be converted properly by firestore or use admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: "Withdrawal request submitted"
    });

  } catch (error) {
    console.error("Withdraw Error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Withdraw failed"
    });
  }
};