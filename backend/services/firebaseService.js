const { db, admin } = require('../config/firebase');

/**
 * Adds deposit amount to user's wallet balance.
 * Uses a Firestore transaction to safely increment balance.
 */
exports.updateDepositBalance = async (userId, amount) => {
  if (!userId || !amount || isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid userId or amount: userId=${userId}, amount=${amount}`);
  }

  const walletRef = db.collection('wallets').doc(userId);

  await db.runTransaction(async (t) => {
    const walletSnap = await t.get(walletRef);

    if (walletSnap.exists) {
      const data = walletSnap.data();
      const currentBalance = Number(data.balance || 0);
      const currentDeposit = Number(data.deposit || 0);

      t.update(walletRef, {
        balance: currentBalance + amount,
        deposit: currentDeposit + amount,
        updatedAt: new Date()
      });
    } else {
      // Create wallet if it doesn't exist
      t.set(walletRef, {
        userId,
        balance: amount,
        deposit: amount,
        winnings: 0,
        withdrawable: 0,
        updatedAt: new Date(),
        createdAt: new Date()
      });
    }
  });

  console.log(`✅ Wallet updated for userId=${userId}, deposited ₹${amount}`);
};

/**
 * Creates a transaction record in Firestore under user's transactions subcollection
 * and also in a top-level 'transactions' collection.
 */
exports.createTransaction = async (userId, transactionData) => {
  if (!userId) {
    throw new Error('userId is required to create a transaction');
  }

  const batch = db.batch();

  // Top-level transactions collection
  const globalTxRef = db.collection('transactions').doc();
  batch.set(globalTxRef, {
    ...transactionData,
    userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // User's subcollection for quick lookup
  const userTxRef = db
    .collection('wallets')
    .doc(userId)
    .collection('transactions')
    .doc(globalTxRef.id);

  batch.set(userTxRef, {
    ...transactionData,
    userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  console.log(`✅ Transaction recorded for userId=${userId}, type=${transactionData.type}, amount=₹${transactionData.amount}`);
  return globalTxRef.id;
};