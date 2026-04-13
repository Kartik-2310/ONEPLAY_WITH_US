const axios = require("axios");

exports.createOrder = async (req, res) => {
  try {
    const { amount, userId, phone } = req.body;
    
    console.log("Request received:", req.body);
    
    if (!amount || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing data"
      });
    }

    const orderId = "order_" + Date.now();
    console.log("Sending Cashfree response...");

    const response = await axios.post(
      "https://api.cashfree.com/pg/orders",
      {
        order_id: orderId,
        order_amount: Number(amount),
        order_currency: "INR",
        customer_details: {
          customer_id: userId || "user_" + Date.now(),
          customer_phone: phone || "9999999999"
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

    console.log("Response:", response.data);

    return res.json({
      success: true,
      payment_session_id: response.data.payment_session_id
    });

  } catch (err) {
    const cfError = err.response?.data;
    const errorMessage = cfError?.message || cfError?.type || err.message || "Failed to process payment with Cashfree.";
    
    console.error("❌ Cashfree Error:", JSON.stringify(cfError || err.message));

    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};