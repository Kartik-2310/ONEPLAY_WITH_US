const admin = require('firebase-admin');
const { db } = require('../config/firebase');

exports.approveWithdraw = async (req, res) => {
  console.log("[approveWithdraw] Received request:", { body: req.body, params: req.params });
  try {
    const withdrawalId = req.params?.id || req.body?.withdrawalId;
    console.log(`[approveWithdraw] Incoming withdrawal ID: ${withdrawalId || "undefined"}`);

    if (!withdrawalId) {
      console.log("[approveWithdraw] Missing withdrawalId");
      return res.status(400).json({
        success: false,
        message: "Failed to approve withdrawal",
        error: "Withdrawal ID is required"
      });
    }

    console.log(`[approveWithdraw] Processing withdrawal ID: ${withdrawalId}`);
    const withdrawalRef = db.collection("withdrawRequests").doc(withdrawalId);
    const withdrawalDoc = await withdrawalRef.get();
    console.log(`[approveWithdraw] Firestore document exists: ${withdrawalDoc.exists}`);

    if (!withdrawalDoc.exists) {
      console.log(`[approveWithdraw] Withdrawal request ${withdrawalId} not found`);
      return res.status(404).json({
        success: false,
        message: "Failed to approve withdrawal",
        error: "Withdrawal not found"
      });
    }

    const data = withdrawalDoc.data();
    console.log(`[approveWithdraw] Current status: ${data.status}`);
    if (data.status !== 'pending') {
      console.log(`[approveWithdraw] Withdrawal ${withdrawalId} already processed: ${data.status}`);
      return res.status(400).json({
        success: false,
        message: "Failed to approve withdrawal",
        error: "Withdrawal already approved/processed"
      });
    }

    await withdrawalRef.update({
      status: "approved",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectedAt: null
    });
    console.log(`[approveWithdraw] Update success for ${withdrawalId}`);

    const targetUid = data.userId || data.uid || null;
    if (targetUid) {
      try {
        await db.collection("notifications").add({
          target: targetUid,
          type: "withdrawal_approved",
          title: "Withdrawal Approved",
          message: `Your withdrawal of ₹${Number(data.amount || 0)} has been approved.`,
          read: false,
          date: admin.firestore.FieldValue.serverTimestamp(),
          sourceId: withdrawalId
        });
        console.log(`[approveWithdraw] Notification success for user: ${targetUid}`);
      } catch (notificationError) {
        console.error("[approveWithdraw] Notification failed:", notificationError.message);
      }
    } else {
      console.log("[approveWithdraw] Notification skipped: missing userId on withdrawal record");
    }

    console.log(`✅ Approved withdrawal request ${withdrawalId} for user ${data.userId}`);
    console.log("[approveWithdraw] Final JSON response sent");
    return res.status(200).json({
      success: true,
      message: "Withdrawal approved successfully"
    });

  } catch (error) {
    console.error("Approve error:", error);
    console.log("[approveWithdraw] Final JSON error response sent");
    return res.status(500).json({
      success: false,
      message: "Failed to approve withdrawal",
      error: error.message || "Unknown error"
    });
  }
};

exports.getPendingWithdrawals = async (req, res) => {
  try {
    console.log("Fetching pending withdrawals...");

    const snapshot = await db
      .collection("withdrawRequests")
      .where("status", "==", "pending")
      .get();

    const withdrawals = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      withdrawals.push({
        id: doc.id,
        username: data.username || "Unknown",
        userId: data.userId || "",
        amount: Number(data.amount || 0),
        upiId: data.upiId || "",
        status: data.status || "pending",
        createdAt: data.createdAt || null
      });
    });

    console.log("Pending withdrawals count:", withdrawals.length);

    return res.status(200).json({
      success: true,
      withdrawals
    });

  } catch (error) {
    console.error("Pending withdrawals route error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pending withdrawals"
    });
  }
};

exports.rejectWithdraw = async (req, res) => {
  console.log("[rejectWithdraw] Received request:", req.body);
  try {
    const { withdrawalId, rejectReason } = req.body;
    if (!withdrawalId) {
      console.log("[rejectWithdraw] Missing withdrawalId");
      return res.status(400).json({ success: false, message: 'Withdrawal ID is required' });
    }

    console.log(`[rejectWithdraw] Processing rejection for withdrawal ID: ${withdrawalId}`);
    await db.runTransaction(async (t) => {
      const ref = db.collection('withdrawRequests').doc(withdrawalId);
      const docSnap = await t.get(ref);

      if (!docSnap.exists) throw new Error('Withdraw request not found');
      const data = docSnap.data();
      console.log(`[rejectWithdraw] Current status: ${data.status}`);
      if (data.status !== 'pending') throw new Error('Withdrawal request already processed');

      const targetUid = data.userId || data.uid;
      if (!targetUid) throw new Error('User ID missing on withdrawal record');

      const amount = Number(data.amount || 0);
      if (amount <= 0) throw new Error('Invalid withdrawal amount');

      console.log(`[rejectWithdraw] Refunding ${amount} to user ${targetUid}`);
      const walletRef = db.collection('wallets').doc(targetUid);
      const walletSnap = await t.get(walletRef);

      if (walletSnap.exists) {
        const walletData = walletSnap.data();
        const currentBalance = Number(walletData.balance || 0);
        const currentWinnings = Number(walletData.winnings ?? walletData.withdrawable ?? 0);
        const updatedFields = {
          winnings: currentWinnings + amount,
          updatedAt: new Date()
        };

        if (!Number.isNaN(currentBalance)) {
          updatedFields.balance = currentBalance + amount;
        }

        if (walletData.withdrawable !== undefined) {
          const currentWithdrawable = Number(walletData.withdrawable || 0);
          updatedFields.withdrawable = currentWithdrawable + amount;
        }

        t.update(walletRef, updatedFields);
      } else {
        t.set(walletRef, {
          balance: amount,
          winnings: amount,
          withdrawable: amount,
          updatedAt: new Date()
        });
      }

      t.update(ref, {
        status: 'rejected',
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectReason: rejectReason || 'Rejected by admin'
      });
    });

    console.log(`❌ Rejected withdrawal request ${withdrawalId}`);
    return res.status(200).json({ success: true, message: 'Withdrawal rejected and refunded successfully' });
  } catch (error) {
    console.error('rejectWithdraw error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
