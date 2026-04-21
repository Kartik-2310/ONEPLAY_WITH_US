const express = require("express");
const router = express.Router();

const { createOrder, webhook } = require("../controllers/paymentController");

router.post("/create-order", createOrder); // Auth middleware applied globally in index.js
router.post("/cashfree/webhook", webhook);

module.exports = router;