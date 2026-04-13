const { db } = require('../config/firebase');

const walletsCollection = db.collection('wallets');
const transactionsCollection = db.collection('transactions');
const usersCollection = db.collection('users');
if (!db) {
  throw new Error("❌ Firebase DB not initialized");
}
/**
 * Get user wallet balance
 */
const getWallet = async (userId) => {
  const walletDoc = await walletsCollection.doc(userId).get();
  if (!walletDoc.exists) {
    // If it doesn't exist, you can create a default one or throw an error
    return { balance: 0 };
  }
  return walletDoc.data();
};

const updateWalletBalance = async (userId, amountToAdd) => {
  try {
    console.log("🔥 Updating wallet:", userId, amountToAdd);

    await db.runTransaction(async (t) => {
      const ref = db.collection("wallets").doc(userId);
      const doc = await t.get(ref);

      if (!doc.exists) {
        console.log("🆕 Creating new wallet");
        t.set(ref, {
          balance: amountToAdd,
          deposit: amountToAdd,
          winnings: 0,
          bonus: 0,
          updatedAt: new Date()
        });
      } else {
        const d = doc.data();
        console.log("💰 Current balance:", d.balance || 0);
        t.update(ref, {
          balance: (d.balance || 0) + amountToAdd,
          deposit: (d.deposit || 0) + amountToAdd,
          updatedAt: new Date()
        });
      }
    });

    console.log("✅ Wallet DB update DONE");

  } catch (error) {
    console.error("❌ Wallet update FAILED:", error);
    throw error;
  }
};

/**
 * Record a transaction
 */
const createTransaction = async (userId, data) => {
  await transactionsCollection.add({
    userId,
    ...data,
    createdAt: new Date()
  });
};

/**
 * Deduct from wallet if balance is sufficient
 */
const deductWalletBalance = async (userId, amountToDeduct) => {
  const walletRef = walletsCollection.doc(userId);

  return await db.runTransaction(async (t) => {
    const doc = await t.get(walletRef);
    if (!doc.exists) {
      throw new Error('Wallet not found');
    }

    const w = doc.data();
    const currentBalance = w.balance || 0;
    const currentWinnings = w.winnings || 0;

    if (currentBalance < amountToDeduct || currentWinnings < amountToDeduct) {
      throw new Error('Insufficient winnings balance');
    }

    t.update(walletRef, {
      balance: currentBalance - amountToDeduct,
      winnings: currentWinnings - amountToDeduct,
      updatedAt: new Date()
    });
    return currentBalance - amountToDeduct; // return new balance
  });
};

module.exports = {
  getWallet,
  updateWalletBalance,
  createTransaction,
  deductWalletBalance,
};
