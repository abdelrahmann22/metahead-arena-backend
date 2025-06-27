const userService = require("../services/userService");

/**
 * Get user by wallet address
 * @route GET /api/users/wallet/:walletAddress
 * @param {string} walletAddress - User's wallet address
 */
const getUserByWallet = async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address is required",
      });
    }

    const result = await userService.findUserByWallet(walletAddress);

    if (!result.success || !result.user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User retrieved successfully",
      data: result.user,
    });
  } catch (error) {
    console.error("Error getting user by wallet:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get user profile with stats
 * @route GET /api/users/:userId/profile
 * @param {string} userId - User ID or wallet address
 */
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = await userService.findUserById(userId);

    if (!result.success || !result.user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Format user profile data
    const profile = {
      id: result.user._id,
      walletAddress: result.user.walletAddress,
      joinedAt: result.user.joinedAt,
      stats: {
        wins: result.user.gameStats.wins,
        losses: result.user.gameStats.losses,
        draws: result.user.gameStats.draws,
        totalMatches: result.user.gameStats.totalMatches,
      },
    };

    res.json({
      success: true,
      message: "User profile retrieved successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getUserByWallet,
  getUserProfile,
};
