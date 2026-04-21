const admin = require('firebase-admin');
const { db } = require('../config/firebase');

exports.createWithdraw = async (req, res) => {
  try {
    console.log("📩 Withdrawal API called:");
    console.log("Body params:", req.body);
    const { userId, amount, upiId, upi, username, name, email } = req.body;

    const uid = userId || req.body.uid;
    const actualUsername = username || name || req.body.username || email || "OnePlay User";
    const actualUpi = upi || upiId;

    if (!uid) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    if (!amount || Number(amount) < 100) {
      return res.status(400).json({ success: false, message: "Minimum withdraw ₹100" });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
    }

    const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
    if (!actualUpi || !upiRegex.test(actualUpi)) {
      return res.status(400).json({ success: false, message: "Invalid UPI ID" });
    }

    const [namePart, handle] = actualUpi.split("@");
    if (!namePart || !handle) {
      return res.status(400).json({ success: false, message: "Invalid UPI ID" });
    }

    const validHandles = [
      "upi", "ybl", "okaxis", "okhdfcbank",
      "okicici", "paytm", "ibl", "axl"
    ];

    if (!validHandles.includes(handle.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Unsupported UPI handle" });
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
      const currentWinnings = Number(walletData.winnings ?? walletData.withdrawable ?? walletData.winningBalance ?? walletData.winningsBalance ?? 0);

      console.log(`Wallet before withdrawal: balance=${currentBalance}, winnings=${currentWinnings}`);

      if (currentWinnings < parsedAmount) {
        throw new Error('Insufficient winnings balance');
      }

      const walletBefore = currentWinnings;
      const walletAfter = currentWinnings - parsedAmount;
      const walletUpdate = {
        winnings: walletAfter,
        updatedAt: new Date()
      };

      if (!Number.isNaN(currentBalance)) {
        walletUpdate.balance = Math.max(0, currentBalance - parsedAmount);
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

    console.log(`✅ Withdrawal request ${requestId} saved to withdrawRequests:`, {
      requestId,
      userId: uid,
      username: actualUsername,
      amount: parsedAmount,
      upiId: actualUpi,
      status: 'pending'
    });
    res.json({ success: true, message: 'Withdrawal request submitted', requestId });
  } catch (error) {
    console.error('Withdraw Error:', error);
    res.status(400).json({ success: false, message: error.message || 'Withdraw failed' });
  }
};