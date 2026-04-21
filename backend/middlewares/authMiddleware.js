require('dotenv').config();

const authMiddleware = (req, res, next) => {
  if (req.path.includes('/webhook')) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  next();
};

module.exports = authMiddleware;
