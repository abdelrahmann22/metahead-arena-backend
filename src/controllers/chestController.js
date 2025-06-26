const chestService = require("../services/chestService");

/**
 * Get user's chest counts
 * @route GET /api/chests/:walletAddress
 * @param {string} walletAddress - User's wallet address
 */
const getUserChests = async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address is required",
      });
    }

    const chests = await chestService.getUserChests(walletAddress);

    res.status(200).json({
      success: true,
      data: {
        walletAddress,
        chests,
      },
    });
  } catch (error) {
    console.error("Error getting user chests:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Add chests to user
 * @route POST /api/chests/:walletAddress/add
 * @param {string} walletAddress - User's wallet address
 * @body {string} chestType - Type of chest to add
 * @body {number} amount - Number of chests to add (default: 1)
 */
const addChests = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { chestType, amount = 1 } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address is required",
      });
    }

    if (!chestType) {
      return res.status(400).json({
        success: false,
        message: "Chest type is required",
      });
    }

    const updatedChests = await chestService.addChests(
      walletAddress,
      chestType,
      amount
    );

    res.status(200).json({
      success: true,
      message: `Successfully added ${amount} ${chestType} chest(s)`,
      data: {
        walletAddress,
        chests: updatedChests,
      },
    });
  } catch (error) {
    console.error("Error adding chests:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Open/consume chests
 * @route POST /api/chests/:walletAddress/open
 * @param {string} walletAddress - User's wallet address
 * @body {string} chestType - Type of chest to open
 * @body {number} amount - Number of chests to open (default: 1)
 */
const openChests = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { chestType, amount = 1 } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address is required",
      });
    }

    if (!chestType) {
      return res.status(400).json({
        success: false,
        message: "Chest type is required",
      });
    }

    const result = await chestService.openChests(
      walletAddress,
      chestType,
      amount
    );

    res.status(200).json({
      success: true,
      message: `Successfully opened ${amount} ${chestType} chest(s)`,
      data: {
        walletAddress,
        remainingChests: result.remainingChests,
        openedChests: result.openedChests,
      },
    });
  } catch (error) {
    console.error("Error opening chests:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getUserChests,
  addChests,
  openChests,
};
