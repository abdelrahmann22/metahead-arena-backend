const { SiweMessage, generateNonce } = require("siwe");
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
      // Generate a random nonce using SIWE's utility function
      const nonce = generateNonce();

      // Validate required fields
      if (!siweMessageData.domain || !siweMessageData.address) {
        throw new Error("Missing required fields: domain and address");
      }

      // Create SIWE message with proper structure
      const messageData = {
        domain: siweMessageData.domain,
        address: siweMessageData.address,
        statement: siweMessageData.statement || "Sign in to HeadBall Web3 Game",
        uri: siweMessageData.uri || `http://${siweMessageData.domain}`,
        version: siweMessageData.version || "1",
        chainId: siweMessageData.chainId || 1,
        nonce: nonce,
        issuedAt: siweMessageData.issuedAt || new Date().toISOString(),
        expirationTime: siweMessageData.expirationTime,
        notBefore: siweMessageData.notBefore,
        requestId: siweMessageData.requestId,
        resources: siweMessageData.resources,
      };

      // Test creating the SIWE message to validate format
      const testMessage = new SiweMessage(messageData);

      // Store nonce with expiration (5 minutes)
      this.nonceStore.set(userIdentifier, {
        nonce: nonce,
        messageData: messageData,
        expires: Date.now() + 1000 * 60 * 5,
      });

      console.log("Generated nonce:", nonce, "for user:", userIdentifier);

      return {
        success: true,
        nonce: nonce,
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
   * @param {string} message - SIWE message string
   * @param {string} signature - Message signature
   * @returns {Object} - Result with JWT token
   */
  async verifyAndGenerateToken(userIdentifier, message, signature) {
    try {
      console.log("Verifying message for user:", userIdentifier);
      console.log("Message received:", message);

      // Validate stored nonce
      const storedNonceData = this.nonceStore.get(userIdentifier);
      if (!storedNonceData || storedNonceData.expires < Date.now()) {
        console.error("Invalid or expired nonce for user:", userIdentifier);
        return {
          success: false,
          error: "Invalid or expired nonce. Please request a new nonce.",
        };
      }

      console.log("Stored nonce:", storedNonceData.nonce);

      // Parse the SIWE message string
      let siweMessage;
      try {
        siweMessage = new SiweMessage(message);
      } catch (parseError) {
        console.error("Failed to parse SIWE message:", parseError);
        return {
          success: false,
          error: `Invalid SIWE message format: ${parseError.message}`,
        };
      }

      console.log("Parsed SIWE message nonce:", siweMessage.nonce);

      // Verify the nonce matches
      if (siweMessage.nonce !== storedNonceData.nonce) {
        console.error(
          "Nonce mismatch. Expected:",
          storedNonceData.nonce,
          "Got:",
          siweMessage.nonce
        );
        return {
          success: false,
          error: "Nonce mismatch. Please request a new nonce.",
        };
      }

      // Verify SIWE message signature
      const verification = await siweMessage.verify({
        signature,
        nonce: storedNonceData.nonce,
      });

      if (!verification.success) {
        console.error("SIWE verification failed:", verification.error);
        return {
          success: false,
          error: "Signature verification failed",
        };
      }

      // Clean up used nonce
      this.nonceStore.delete(userIdentifier);

      // Create or get user in database
      const userResult = await userService.createUserFromWallet(
        verification.data.address
      );
      if (!userResult.success) {
        return {
          success: false,
          error: "Failed to create/retrieve user account",
        };
      }

      // Generate JWT token with user ID for efficient lookups
      const token = jwt.sign(
        {
          address: verification.data.address,
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
        address: verification.data.address,
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
