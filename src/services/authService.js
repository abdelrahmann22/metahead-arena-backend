const { SiweMessage } = require("siwe");
const jwt = require("jsonwebtoken");
const userService = require("./userService");

/**
 * @fileoverview Authentication Service
 * @description Service for handling Web3 authentication with SIWE and JWT
 * @module services/authService
 */

/**
 * Authentication Service - Handles SIWE authentication and JWT tokens
 * @class AuthService
 */
class AuthService {
  constructor() {
    // Validate required environment variables
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is required");
    }

    // In-memory nonce store (consider using Redis in production)
    this.nonceStore = new Map();

    // Start nonce cleanup interval
    this.startNonceCleanup();
  }

  /**
   * Generate and store nonce for SIWE authentication
   * @param {string} userIdentifier - User IP or unique identifier
   * @param {Object} siweMessageData - SIWE message data
   * @returns {Object} - Result with nonce
   */
  async generateNonce(userIdentifier, siweMessageData) {
    try {
      const siweMessage = new SiweMessage(siweMessageData);

      // Store nonce with expiration (5 minutes)
      this.nonceStore.set(userIdentifier, {
        nonce: siweMessage.nonce,
        expires: Date.now() + 1000 * 60 * 5,
      });

      return {
        success: true,
        nonce: siweMessage.nonce,
      };
    } catch (error) {
      console.error("Error generating nonce:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify SIWE message and generate JWT token
   * @param {string} userIdentifier - User IP or unique identifier
   * @param {string} message - SIWE message
   * @param {string} signature - Message signature
   * @returns {Object} - Result with JWT token
   */
  async verifyAndGenerateToken(userIdentifier, message, signature) {
    try {
      // Validate stored nonce
      const storedNonceData = this.nonceStore.get(userIdentifier);
      if (!storedNonceData || storedNonceData.expires < Date.now()) {
        return {
          success: false,
          error: "Invalid or expired nonce",
        };
      }

      // Verify SIWE message
      const siweMessage = new SiweMessage(message);
      const { data: fields } = await siweMessage.verify({
        signature,
        nonce: storedNonceData.nonce,
      });

      // Clean up used nonce
      this.nonceStore.delete(userIdentifier);

      // Create or get user in database
      const userResult = await userService.createUserFromWallet(fields.address);
      if (!userResult.success) {
        return {
          success: false,
          error: "Failed to create/retrieve user account",
        };
      }

      // Generate JWT token with user ID for efficient lookups
      const token = jwt.sign(
        {
          address: fields.address,
          userId: userResult.user._id,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      return {
        success: true,
        token,
        address: fields.address,
        user: userResult.user,
        isNewUser: userResult.isNewUser,
      };
    } catch (error) {
      console.error("Error verifying SIWE message:", error);
      return {
        success: false,
        error: error.message || "Verification failed",
      };
    }
  }

  /**
   * Clean expired nonces (call periodically)
   */
  cleanExpiredNonces() {
    const now = Date.now();
    for (const [key, value] of this.nonceStore.entries()) {
      if (value.expires < now) {
        this.nonceStore.delete(key);
      }
    }
  }

  /**
   * Start automatic nonce cleanup
   */
  startNonceCleanup() {
    // Clean expired nonces every 5 minutes
    setInterval(() => {
      this.cleanExpiredNonces();
    }, 5 * 60 * 1000);
  }
}

module.exports = new AuthService();
