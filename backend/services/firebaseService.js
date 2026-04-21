const { db } = require('../config/firebase');

// Guard: fail loudly if Firebase not initialized
if (!db) {
  throw new Error("❌ Firebase DB not initialized — check FIREBASE_SERVICE_ACCOUNT_PATH");
}

const walletsCollection = db.collection('wallets');
const transactionsCollection = db.collection('transactions');
const usersCollection = db.collection('users');

/**
 * Get user wallet balance
 */
const getWallet = async (userId) => {
  const walletDoc = await walletsCollection.doc(userId).get();
  if (!walletDoc.exists) {
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
 * ✅ FIXED: Update user's deposit balance in the WALLETS collection
 * Previously this was wrongly updating users/{uid}.depositBalance
 * Now correctly updates wallets/{uid}.balance and wallets/{uid}.deposit
 */
const updateDepositBalance = async (userId, amountToAdd) => {
  try {
    console.log("🔥 Updating deposit balance in wallet:", userId, amountToAdd);

    const walletRef = db.collection("wallets").doc(userId);

    await db.runTransaction(async (t) => {
      const walletDoc = await t.get(walletRef);

      if (!walletDoc.exists) {
        // Create wallet if it doesn't exist yet
        console.log("🆕 Wallet not found, creating new wallet for user:", userId);
        t.set(walletRef, {
          balance: amountToAdd,
          deposit: amountToAdd,
          winnings: 0,
          bonus: 0,
          updatedAt: new Date()
        });
      } else {
        const data = walletDoc.data();
        const currentBalance = Number(data.balance || 0);
        const currentDeposit = Number(data.deposit || 0);

        console.log("💰 Wallet before update — balance:", currentBalance, "deposit:", currentDeposit);

        t.update(walletRef, {
          balance: currentBalance + amountToAdd,
          deposit: currentDeposit + amountToAdd,
          updatedAt: new Date()
        });
      }
    });

    console.log("✅ Deposit balance updated in wallet for user:", userId);

  } catch (error) {
    console.error("❌ Deposit balance update failed:", error);
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
 * Deduct from wallet winnings if balance is sufficient
 * ✅ FIXED: only checks winnings (not balance) for withdrawal eligibility
 */
const deductWalletBalance = async (userId, amountToDeduct) => {
  const walletRef = walletsCollection.doc(userId);

  return await db.runTransaction(async (t) => {
    const doc = await t.get(walletRef);
    if (!doc.exists) {
      throw new Error('Wallet not found');
    }

    const w = doc.data();
    const currentBalance = Number(w.balance || 0);
    const currentWinnings = Number(w.winnings || 0);

    // ✅ Only gate on winnings — not balance (balance includes deposits)
    if (currentWinnings < amountToDeduct) {
      throw new Error('Insufficient winnings balance');
    }

    t.update(walletRef, {
      balance: Math.max(0, currentBalance - amountToDeduct),
      winnings: currentWinnings - amountToDeduct,
      updatedAt: new Date()
    });

    return currentWinnings - amountToDeduct;
  });
};

module.exports = {
  getWallet,
  updateWalletBalance,
  updateDepositBalance,
  createTransaction,
  deductWalletBalance
};