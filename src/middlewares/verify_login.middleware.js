const jwt = require("jsonwebtoken");

exports.verifyLogin = (req, res, next) => {
  // Get token from httpOnly cookie
  const token = req.cookies?.authToken;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
      hint: "Please log in to access this resource",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      message: "Invalid or expired token",
      error: error.message,
    });
  }
};
