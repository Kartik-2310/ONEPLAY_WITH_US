const express = require("express");
const router = express.Router();
const { createWithdraw } = require("../controllers/withdrawalController");

router.post("/withdraw", createWithdraw);

module.exports = router;