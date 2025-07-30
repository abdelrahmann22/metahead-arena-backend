const jwt = require('jsonwebtoken');
const userService = require('../../services/userService');

/**
 * Colyseus Authentication Middleware
 * Maintains compatibility with existing JWT authentication system
 */

/**
 * Authentication middleware for Colyseus rooms
 * @param {Client} client - Colyseus client instance
 * @param {Object} options - Join options containing authentication data
 * @param {Request} request - HTTP request object
 * @returns {Promise<Object>} User data if authenticated, throws error if not
 */
async function authMiddleware(client, options, request) {
  try {
    console.log(`[AUTH] Authenticating client ${client.id}`, { 
      options: options ? Object.keys(options) : 'none',
      userAgent: request?.headers?.['user-agent']?.slice(0, 50)
    });

    // Extract token from multiple possible sources (maintain compatibility)
    let token = null;
    
    // 1. From options.token (primary method for Colyseus)
    if (options?.token) {
      token = options.token;
    }
    
    // 2. From Authorization header (fallback)
    if (!token && request?.headers?.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // 3. From query parameters (WebSocket compatibility)
    if (!token && request?.url) {
      const url = new URL(request.url, 'http://localhost');
      token = url.searchParams.get('token');
    }

    if (!token) {
      throw new Error('Authentication token required');
    }

    // Verify JWT token using existing system
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.userId) {
      throw new Error('Invalid token payload');
    }

    // Get user from database using existing service
    const userResult = await userService.findUserById(decoded.userId);
    
    if (!userResult.success || !userResult.user) {
      throw new Error('User not found in database');
    }

    const user = userResult.user;

    // Return user data that will be available as client.auth
    const authData = {
      userId: user._id.toString(),
      walletAddress: user.walletAddress,
      username: user.walletAddress ? 
        `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 
        `Guest-${decoded.userId.slice(0, 5)}`,
      authenticatedAt: Date.now(),
      tokenData: decoded
    };

    console.log(`[AUTH] ✅ Authentication successful for user ${authData.userId} (${authData.walletAddress})`);
    
    return authData;

  } catch (error) {
    console.error(`[AUTH] ❌ Authentication failed for client ${client.id}:`, error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

/**
 * Middleware to validate that a client is authenticated
 * Use this in room message handlers that require authentication
 */
function requireAuth(client, methodName = 'unknown') {
  if (!client.auth || !client.auth.userId) {
    console.warn(`[AUTH] ⚠️ Unauthenticated client ${client.id} attempted to call ${methodName}`);
    throw new Error('Authentication required for this action');
  }
  return true;
}

/**
 * Get authenticated user data from client
 * @param {Client} client - Colyseus client
 * @returns {Object|null} User auth data or null if not authenticated
 */
function getAuthenticatedUser(client) {
  return client.auth || null;
}

/**
 * Validate that client owns the specified wallet address
 * Important for preventing wallet spoofing
 */
function validateWalletOwnership(client, walletAddress) {
  const user = getAuthenticatedUser(client);
  
  if (!user || user.walletAddress !== walletAddress) {
    console.warn(`[AUTH] ⚠️ Wallet ownership validation failed:`, {
      clientId: client.id,
      authenticatedWallet: user?.walletAddress,
      claimedWallet: walletAddress
    });
    return false;
  }
  
  return true;
}

module.exports = {
  authMiddleware,
  requireAuth,
  getAuthenticatedUser,
  validateWalletOwnership
};