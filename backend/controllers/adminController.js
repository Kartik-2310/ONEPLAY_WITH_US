const admin = require('firebase-admin');
const axios = require('axios');
const { db } = require('../config/firebase');

// ✅ Get Cashfree Payout Bearer Token
const getCashfreePayoutToken = async () => {
  const response = await axios.post(
    'https://payout-api.cashfree.com/payout/v1/authorize',
    {},
    {
      headers: {
        'X-Client-Id': process.env.CASHFREE_PAYOUT_CLIENT_ID,
        'X-Client-Secret': process.env.CASHFREE_PAYOUT_CLIENT_SECRET
      }
    }
  );

  if (response.data?.status !== 'SUCCESS') {
    throw new Error('Failed to get Cashfree Payout token: ' + JSON.stringify(response.data));
  }

  return response.data.data.token;
};

exports.approveWithdraw = async (req, res) => {
  console.log("[approveWithdraw] Received request:", { body: req.body, params: req.params });

  try {
    const withdrawalId = req.params?.id || req.body?.withdrawalId;
    if (!withdrawalId) {
      return res.status(400).json({ success: false, message: "Withdrawal ID is required" });
    }

    const withdrawalRef = db.collection("withdrawRequests").doc(withdrawalId);
    const withdrawalDoc = await withdrawalRef.get();

    if (!withdrawalDoc.exists) {
      return res.status(404).json({ success: false, message: "Withdrawal not found" });
    }

    const data = withdrawalDoc.data();

    if (data.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Withdrawal already ${data.status}` });
    }

    const upiId = data.upiId;
    const amount = Number(data.amount || 0);
    const targetUid = data.userId || data.uid;

    if (!upiId || amount <= 0 || !targetUid) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal data (missing upiId, amount, or userId)"
      });
    }

    // ✅ Step 1: Initiate Cashfree Payout
    let transferId = null;
    let referenceId = null;

    try {
      const token = await getCashfreePayoutToken();

      const payoutResponse = await axios.post(
        'https://payout-api.cashfree.com/payout/v1/directtransfer',
        {
          amount,
          transferId: `WD_${withdrawalId}`,
          transferMode: 'upi',
          beneficiaryDetails: {
            beneficiaryId: `BEN_${targetUid}`,
            beneficiaryName: data.username || 'OnePlay User',
            beneficiaryVpa: upiId
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log("[approveWithdraw] Cashfree Payout Response:", payoutResponse.data);

      if (payoutResponse.data?.status !== 'SUCCESS') {
        throw new Error('Payout failed: ' + JSON.stringify(payoutResponse.data));
      }

      transferId = `WD_${withdrawalId}`;
      referenceId = payoutResponse.data?.data?.referenceId || null;

    } catch (payoutErr) {
      console.error("[approveWithdraw] Cashfree Payout Error:", payoutErr.message);
      return res.status(500).json({
        success: false,
        message: "Cashfree payout failed: " + payoutErr.message
      });
    }

    // ✅ Step 2: Mark withdrawal as approved in Firestore
    await withdrawalRef.update({
      status: "approved",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      transferId,
      referenceId,
      rejectedAt: null
    });

    // ✅ Step 3: Send notification to user
    if (targetUid) {
      try {
        await db.collection("notifications").add({
          target: targetUid,
          type: "withdrawal_approved",
          title: "Withdrawal Approved",
          message: `Your withdrawal of ₹${amount} has been approved and sent to ${upiId}.`,
          read: false,
          date: admin.firestore.FieldValue.serverTimestamp(),
          sourceId: withdrawalId
        });
      } catch (notifErr) {
        console.error("[approveWithdraw] Notification failed:", notifErr.message);
      }
    }

    console.log(`✅ Approved and paid withdrawal ${withdrawalId} for user ${targetUid}`);
    return res.status(200).json({ success: true, message: "Withdrawal approved and payout initiated" });

  } catch (error) {
    console.error("approveWithdraw error:", error);
    return res.status(500).json({ success: false, message: error.message || "Unknown error" });
  }
};

exports.getPendingWithdrawals = async (req, res) => {
  try {
    console.log("Fetching pending withdrawals...");

    const snapshot = await db
      .collection("withdrawRequests")
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
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
    return res.status(200).json({ success: true, withdrawals });

  } catch (error) {
    console.error("getPendingWithdrawals error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch pending withdrawals" });
  }
};

exports.rejectWithdraw = async (req, res) => {
  console.log("[rejectWithdraw] Received request:", req.body);

  try {
    const { withdrawalId, rejectReason } = req.body;

    if (!withdrawalId) {
      return res.status(400).json({ success: false, message: 'Withdrawal ID is required' });
    }

    await db.runTransaction(async (t) => {
      const ref = db.collection('withdrawRequests').doc(withdrawalId);
      const docSnap = await t.get(ref);

      if (!docSnap.exists) throw new Error('Withdraw request not found');

      const data = docSnap.data();
      if (data.status !== 'pending') throw new Error('Withdrawal request already processed');

      const targetUid = data.userId || data.uid;
      if (!targetUid) throw new Error('User ID missing on withdrawal record');

      const amount = Number(data.amount || 0);
      if (amount <= 0) throw new Error('Invalid withdrawal amount');

      console.log(`[rejectWithdraw] Refunding ₹${amount} to user ${targetUid}`);

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

        if (!isNaN(currentBalance)) {
          updatedFields.balance = currentBalance + amount;
        }

        if (walletData.withdrawable !== undefined) {
          updatedFields.withdrawable = Number(walletData.withdrawable || 0) + amount;
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

      if (targetUid) {
        const notifRef = db.collection('notifications').doc();
        t.set(notifRef, {
          target: targetUid,
          type: "withdrawal_rejected",
          title: "Withdrawal Rejected",
          message: `Your withdrawal of ₹${amount} was rejected. Reason: ${rejectReason || 'Rejected by admin'}. Amount refunded to your wallet.`,
          read: false,
          date: admin.firestore.FieldValue.serverTimestamp(),
          sourceId: withdrawalId
        });
      }
    });

    console.log(`❌ Rejected withdrawal request ${withdrawalId}`);
    return res.status(200).json({ success: true, message: 'Withdrawal rejected and amount refunded' });

  } catch (error) {
    console.error('rejectWithdraw error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};