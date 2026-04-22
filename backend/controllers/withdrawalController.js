const admin = require('firebase-admin');
const { db } = require('../config/firebase');

// ✅ FIXED: Extended list of valid UPI handles
const VALID_UPI_HANDLES = [
  "upi", "ybl", "okaxis", "okhdfcbank", "okicici", "oksbi",
  "paytm", "ibl", "axl", "axisbank", "hdfcbank", "icici",
  "sbi", "kotak", "kmbl", "rbl", "barodampay", "pnb",
  "indus", "aubank", "fbl", "jsb", "utbi", "abfspay",
  "idbi", "federal", "unionbank", "cnrb", "jkb", "dbs",
  "boi", "mahb", "vijb", "dcb", "scb", "citi", "hsbc",
  "allbank", "obc", "ucorp", "apl", "rapl", "gpay",
  "phonepe", "airtel", "jio", "ikwik", "timecosmos",
  "niyoicici", "freecharge", "tapicici", "yapl",
  "amazonpay", "waaxis", "wahdfcbank", "wasbi"
];

exports.createWithdraw = async (req, res) => {
  try {
    console.log("📩 Withdrawal API called:");
    console.log("Body params:", req.body);

    const { userId, amount, upiId, upi, username, name, email } = req.body;

    const uid = userId || req.body.uid;
    const actualUsername = username || name || email || "OnePlay User";
    const actualUpi = (upi || upiId || "").trim();

    if (!uid) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    if (!amount || isNaN(amount) || Number(amount) < 100) {
      return res.status(400).json({ success: false, message: "Minimum withdraw ₹100" });
    }

    const parsedAmount = Number(amount);

    // ✅ UPI format validation
    const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
    if (!actualUpi || !upiRegex.test(actualUpi)) {
      return res.status(400).json({ success: false, message: "Invalid UPI ID format" });
    }

    const [, handle] = actualUpi.split("@");
    if (!handle || !VALID_UPI_HANDLES.includes(handle.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Unsupported UPI handle '@${handle}'. Please use a valid UPI ID.`
      });
    }

    const withdrawRef = db.collection('withdrawRequests').doc();
    const requestId = withdrawRef.id;

    console.log(`⏳ Processing withdrawal for UID: ${uid}, amount: ${parsedAmount}, requestId: ${requestId}`);

    await db.runTransaction(async (t) => {
      const walletRef = db.collection('wallets').doc(uid);
      const walletSnap = await t.get(walletRef);

      if (!walletSnap.exists) {
        throw new Error('Wallet not found');
      }

      const walletData = walletSnap.data();
      const currentBalance = Number(walletData.balance || 0);
      const currentWinnings = Number(
        walletData.winnings ??
        walletData.withdrawable ??
        walletData.winningBalance ??
        walletData.winningsBalance ?? 0
      );

      console.log(`Wallet before withdrawal: balance=${currentBalance}, winnings=${currentWinnings}`);

      if (currentWinnings < parsedAmount) {
        throw new Error('Insufficient winnings balance');
      }

      const walletUpdate = {
        winnings: currentWinnings - parsedAmount,
        updatedAt: new Date()
      };

      if (!isNaN(currentBalance)) {
        walletUpdate.balance = Math.max(0, currentBalance - parsedAmount);
      }

      if (walletData.withdrawable !== undefined) {
        const currentWithdrawable = Number(walletData.withdrawable || 0);
        walletUpdate.withdrawable = Math.max(0, currentWithdrawable - parsedAmount);
      }

      t.update(walletRef, walletUpdate);

      t.set(withdrawRef, {
        userId: uid,
        username: actualUsername,
        amount: parsedAmount,
        upiId: actualUpi,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: null,
        rejectedAt: null
      });
    });

    console.log(`✅ Withdrawal request ${requestId} created for user ${uid}`);
    res.json({ success: true, message: 'Withdrawal request submitted', requestId });

  } catch (error) {
    console.error('Withdraw Error:', error);
    res.status(400).json({ success: false, message: error.message || 'Withdraw failed' });
  }
};