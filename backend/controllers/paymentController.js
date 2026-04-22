const axios = require("axios");
const crypto = require("crypto");
const { db } = require('../config/firebase');

exports.createOrder = async (req, res) => {
  try {
    const { amount, userId, phone, email, name } = req.body;

    console.log("Create Order Request received:", { userId, amount });

    if (!amount || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or amount"
      });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    // ✅ Check Firebase is initialized
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable - Firebase not initialized. Check Render environment variables."
      });
    }

    const orderDocRef = db.collection("orders").doc();
    const orderId = orderDocRef.id;

    const safePhone = typeof phone === "string" && phone.trim() ? phone.trim() : "9999999999";
    const safeEmail = typeof email === "string" && email.trim() ? email.trim() : `${userId}@oneplay.local`;
    const safeName = typeof name === "string" && name.trim() ? name.trim() : "OnePlay User";

    console.log("Sending order request to Cashfree...");

    const response = await axios.post(
      "https://api.cashfree.com/pg/orders",
      {
        order_id: orderId,
        order_amount: Number(amount),
        order_currency: "INR",
        customer_details: {
          customer_id: userId,
          customer_phone: safePhone,
          customer_email: safeEmail,
          customer_name: safeName
        },
        order_meta: {
          return_url: `${process.env.FRONTEND_URL}/payment-status?order_id={order_id}`,
          notify_url: process.env.NOTIFY_URL
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": process.env.CASHFREE_APP_ID,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY,
          "x-api-version": "2023-08-01"
        }
      }
    );

    console.log("Cashfree Response:", response.data);

    await orderDocRef.set({
      userId,
      amount: Number(amount),
      orderId,
      cfOrderId: response.data.cf_order_id,
      paymentSessionId: response.data.payment_session_id,
      status: "pending",
      createdAt: new Date()
    });

    console.log("Order saved to Firestore:", orderId);

    return res.json({
      success: true,
      orderId: response.data.order_id,
      paymentSessionId: response.data.payment_session_id,
      payment_session_id: response.data.payment_session_id
    });

  } catch (err) {
    const cfError = err.response?.data;
    const errorMessage = cfError?.message || cfError?.type || err.message || "Failed to process payment with Cashfree.";
    console.error("❌ Cashfree Error:", JSON.stringify(cfError || err.message));
    return res.status(500).json({ success: false, message: errorMessage });
  }
};

exports.webhook = async (req, res) => {
  try {
    const payload = req.body || {};

    const timestamp = req.headers["x-webhook-timestamp"];
    const signature = req.headers["x-webhook-signature"];
    const secret = process.env.CASHFREE_WEBHOOK_SECRET;

    if (secret) {
      if (!timestamp || !signature) {
        console.error("❌ Webhook missing signature headers.");
        return res.status(403).json({ success: false, message: "Missing webhook signature headers" });
      }

      const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
      const expected = crypto
        .createHmac("sha256", secret)
        .update(String(timestamp) + rawBody)
        .digest("base64");

      if (expected !== signature) {
        console.error("❌ Invalid webhook signature.");
        return res.status(403).json({ success: false, message: "Invalid webhook signature" });
      }
    } else {
      console.warn("⚠️ CASHFREE_WEBHOOK_SECRET not set — skipping signature check");
    }

    const type = payload.type;
    const data = payload.data || {};
    const payment = data.payment || {};
    const order = data.order || {};

    if (type !== "PAYMENT_SUCCESS_WEBHOOK") {
      return res.status(200).json({ success: true, message: "Ignored" });
    }

    const paymentStatus = payment.payment_status;
    if (paymentStatus && paymentStatus !== "SUCCESS") {
      return res.status(200).json({ success: true, message: `Ignored payment_status: ${paymentStatus}` });
    }

    const orderId = order.order_id;
    if (!orderId) {
      console.error("❌ Missing orderId in webhook");
      return res.status(200).json({ success: true, message: "Missing orderId" });
    }

    console.log("Processing webhook for orderId:", orderId);

    let alreadyProcessed = false;
    let userId = null;
    let amount = null;

    await db.runTransaction(async (t) => {
      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await t.get(orderRef);

      if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");

      const orderData = orderSnap.data();

      if (orderData.status === "paid") {
        alreadyProcessed = true;
        return;
      }

      userId = orderData.userId;
      amount = orderData.amount;

      if (!userId || !amount) throw new Error("INVALID_ORDER_DATA");

      t.update(orderRef, {
        status: "paid",
        paidAt: new Date()
      });
    });

    if (alreadyProcessed) {
      console.log("✅ Order already processed (duplicate webhook ignored):", orderId);
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    console.log("Updating wallet for user:", userId, "amount:", amount);

    const { updateDepositBalance, createTransaction } = require("../services/firebaseService");

    await updateDepositBalance(userId, amount);

    await createTransaction(userId, {
      uid: userId,
      type: "deposit",
      subtype: "wallet_deposit",
      amount,
      status: "success",
      orderId,
      referenceId: payment.cf_payment_id ? String(payment.cf_payment_id) : null,
      gateway: "cashfree",
      date: new Date()
    });

    console.log("✅ Webhook processed successfully for order:", orderId);
    return res.status(200).json({ success: true, message: "Processed" });

  } catch (err) {
    if (err.message === "ORDER_NOT_FOUND") {
      console.error("❌ Order not found in Firestore:", err);
      return res.status(200).json({ success: true, message: "Order not found" });
    }
    if (err.message === "INVALID_ORDER_DATA") {
      console.error("❌ Invalid order data");
      return res.status(200).json({ success: true, message: "Invalid order data" });
    }
    console.error("Webhook error:", err);
    return res.status(200).json({ success: false, message: "Webhook error acknowledged" });
  }
};