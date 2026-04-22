require('dotenv').config();

const authMiddleware = (req, res, next) => {
  // Skip auth for webhook endpoints
  if (req.path.includes('/webhook')) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !process.env.API_KEY || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  next();
};

module.exports = authMiddleware;