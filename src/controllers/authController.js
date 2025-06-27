const authService = require("../services/authService");
const { SiweMessage } = require("siwe");

/**
 * @fileoverview Authentication Controller
 * @description Controller for handling Web3 authentication endpoints
 * @module controllers/authController
 */

/**
 * Generate nonce for SIWE authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateNonce = async (req, res) => {
  try {
    const siweMessageData = req.body;

    // Validate required SIWE fields
    if (!siweMessageData.domain || !siweMessageData.address) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: domain and address",
      });
    }

    // Use IP + address as unique identifier
    const userIdentifier = `${siweMessageData.address}_${req.ip}`;

    const result = await authService.generateNonce(
      userIdentifier,
      siweMessageData
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    // Return nonce as plain text (required by SIWE spec)
    res.status(200).send(result.nonce);
  } catch (error) {
    console.error("Error generating nonce:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Verify SIWE message signature and return JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifySignature = async (req, res) => {
  try {
    const { message, signature } = req.body;

    if (!message || !signature) {
      return res.status(400).json({
        success: false,
        message: "Missing message or signature",
      });
    }

    // Extract address from SIWE message for consistent identification
    let siweMessage;
    let userIdentifier;

    try {
      siweMessage = new SiweMessage(message);
      userIdentifier = `${siweMessage.address}_${req.ip}`;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid SIWE message format: " + error.message,
      });
    }

    // Verify signature and generate token
    const result = await authService.verifyAndGenerateToken(
      userIdentifier,
      message,
      signature
    );

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.error,
      });
    }

    // Always use httpOnly cookies (secure by default)
    res.cookie("authToken", result.token, {
      httpOnly: true, // Not accessible to JavaScript (XSS protection)
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict", // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain:
        process.env.NODE_ENV === "production"
          ? process.env.COOKIE_DOMAIN
          : undefined,
    });

    // Return user data (token is in httpOnly cookie)
    res.status(200).json({
      success: true,
      message: "Authentication successful",
      data: {
        user: {
          id: result.user._id,
          walletAddress: result.user.walletAddress,
          isNewUser: result.isNewUser,
        },
        address: result.address,
      },
    });
  } catch (error) {
    console.error("Auth verification error:", error);
    res.status(401).json({
      success: false,
      message: error.message || "Authentication failed",
    });
  }
};

/**
 * Simple logout - just clear the authentication cookie
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = async (req, res) => {
  try {
    // Clear httpOnly cookie
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      domain:
        process.env.NODE_ENV === "production"
          ? process.env.COOKIE_DOMAIN
          : undefined,
    });

    // Simple success response
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    // Still try to clear cookie even if there's an error
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      domain:
        process.env.NODE_ENV === "production"
          ? process.env.COOKIE_DOMAIN
          : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
};

module.exports = {
  generateNonce,
  verifySignature,
  logout,
};
