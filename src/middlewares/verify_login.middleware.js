const jwt = require("jsonwebtoken");

exports.verifyLogin = (req, res, next) => {
  // Get token from Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7) // Remove 'Bearer ' prefix
      : null;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
      hint: "Please provide a valid token in the Authorization header",
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
