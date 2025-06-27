const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const { verifyLogin } = require("../middlewares/verify_login.middleware");

const router = express.Router();

// Rate limiting for auth endpoints (relaxed for development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 10 : 100, // 100 for dev, 10 for production
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @fileoverview Authentication Routes
 * @description RESTful API routes for Web3 authentication using SIWE
 * @module routes/auth
 */

/**
 * @swagger
 * /api/auth/nonce:
 *   post:
 *     summary: Generate nonce for SIWE authentication
 *     tags: [Authentication]
 *     description: Generate a unique nonce for Sign-In with Ethereum (SIWE) authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - domain
 *               - address
 *               - statement
 *               - uri
 *               - version
 *               - chainId
 *             properties:
 *               domain:
 *                 type: string
 *                 description: Domain requesting the signature
 *                 example: "localhost:3000"
 *               address:
 *                 type: string
 *                 description: Ethereum address performing the signing
 *                 example: "0x742d35Cc6634C0532925a3b8D"
 *               statement:
 *                 type: string
 *                 description: Human-readable ASCII assertion
 *                 example: "Sign in to Head Ball Arena"
 *               uri:
 *                 type: string
 *                 description: RFC 3986 URI referring to the resource
 *                 example: "http://localhost:3000"
 *               version:
 *                 type: string
 *                 description: Current version of the message
 *                 example: "1"
 *               chainId:
 *                 type: number
 *                 description: EIP-155 Chain ID
 *                 example: 1
 *               nonce:
 *                 type: string
 *                 description: Randomized token (will be generated if not provided)
 *               issuedAt:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 datetime string
 *               expirationTime:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 datetime string
 *               notBefore:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 datetime string
 *               requestId:
 *                 type: string
 *                 description: System-specific identifier
 *               resources:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of information or references
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               description: Generated nonce for SIWE message
 *               example: "abcd1234efgh5678"
 *       400:
 *         description: Bad request - invalid SIWE message data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * POST /api/auth/nonce
 * Generate nonce for SIWE authentication
 */
router.post("/nonce", authLimiter, authController.generateNonce);

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Verify SIWE message and return JWT token
 *     tags: [Authentication]
 *     description: |
 *       Verify Sign-In with Ethereum (SIWE) message signature and return JWT authentication token.
 *       Token is automatically stored in secure httpOnly cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - signature
 *             properties:
 *               message:
 *                 type: string
 *                 description: SIWE message string
 *                 example: "localhost:3000 wants you to sign in with your Ethereum account:\\n0x742d35Cc6634C0532925a3b8D\\n\\nSign in to Head Ball Arena\\n\\nURI: http://localhost:3000\\nVersion: 1\\nChain ID: 1\\nNonce: abcd1234efgh5678\\nIssued At: 2023-10-01T12:00:00.000Z"
 *               signature:
 *                 type: string
 *                 description: Hex-encoded signature of the SIWE message
 *                 example: "0x1234567890abcdef..."
 *     responses:
 *       200:
 *         description: Authentication successful (token stored in httpOnly cookie)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - signature verification failed or expired nonce
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * POST /api/auth/verify
 * Verify SIWE message and return JWT token in httpOnly cookie
 */
router.post("/verify", authLimiter, authController.verifySignature);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and clear authentication
 *     tags: [Authentication]
 *     description: |
 *       Clear authentication cookies. No authentication required.
 *       Works for all users regardless of token validity.
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 */
/**
 * POST /api/auth/logout
 * Simple logout - just clear authentication cookies
 * No authentication required
 */
router.post("/logout", authController.logout);

module.exports = router;
