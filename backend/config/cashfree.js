const { Cashfree, CFEnvironment } = require("cashfree-pg");

// Set API credentials
Cashfree.XClientId = process.env.CASHFREE_APP_ID;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;

// Set environment (SANDBOX / PRODUCTION)
Cashfree.XEnvironment =
  process.env.CASHFREE_ENVIRONMENT === "PRODUCTION"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

module.exports = Cashfree;