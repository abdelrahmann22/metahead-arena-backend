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

    console.log(
      "Nonce request received:",
      JSON.stringify(siweMessageData, null, 2)
    );

    // Validate required SIWE fields
    if (!siweMessageData.domain || !siweMessageData.address) {
      console.error("Missing required fields:", siweMessageData);
      return res.status(400).json({
        success: false,
        message: "Missing required fields: domain and address",
      });
    }

    // Use IP + address as unique identifier
    const userIdentifier = `${siweMessageData.address}_${req.ip}`;
    console.log("User identifier:", userIdentifier);

    const result = await authService.generateNonce(
      userIdentifier,
      siweMessageData
    );

    if (!result.success) {
      console.error("Nonce generation failed:", result.error);
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    console.log("Nonce generated successfully:", result.nonce);
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

    console.log("Verify request received:");
    console.log("Message:", message);
    console.log("Signature:", signature);

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
      console.log("Parsed address:", siweMessage.address);
      console.log("User identifier:", userIdentifier);
    } catch (error) {
      console.error("SIWE message parsing error:", error);
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
      console.error("Authentication failed:", result.error);
      return res.status(401).json({
        success: false,
        message: result.error,
      });
    }

    console.log("Authentication successful for:", result.address);

    // Return JWT token in response body for localStorage storage
    res.status(200).json({
      success: true,
      message: "Authentication successful",
      data: {
        token: result.token, // Return token for localStorage
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
 * Simple logout - client should clear localStorage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = async (req, res) => {
  try {
    // Simple success response - client handles localStorage cleanup
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
      note: "Please clear the token from localStorage on the client side",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
};

/**
 * Test endpoint to verify cookie setting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testCookie = async (req, res) => {
  try {
    // Set a simple test cookie
    res.cookie("testCookie", "test-value", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: "Test cookie set successfully",
      environment: process.env.NODE_ENV || "undefined",
      cookieSettings: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      },
    });
  } catch (error) {
    console.error("Test cookie error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set test cookie",
    });
  }
};

module.exports = {
  generateNonce,
  verifySignature,
  logout,
  testCookie,
};
