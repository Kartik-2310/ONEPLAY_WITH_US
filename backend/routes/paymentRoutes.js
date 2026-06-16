const express = require("express");
const router = express.Router();

const {
  createOrder,
  webhook
} = require("../controllers/paymentController");

router.get("/test", (req, res) => {
  res.json({
    success: true,
    route: "payment route working"
  });
});

router.post("/create-order", createOrder);

router.post("/cashfree/webhook", webhook);

module.exports = router;