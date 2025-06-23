const ChestService = require("../services/chestService");

class ChestController {
  // GET /api/chests/:walletAddress - Get user's chest counts
  static async getUserChests(req, res) {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet address is required",
        });
      }

      const chests = await ChestService.getUserChests(walletAddress);

      res.status(200).json({
        success: true,
        data: {
          walletAddress,
          chests,
        },
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/chests/:walletAddress/add - Add chests to user
  static async addChests(req, res) {
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

      const updatedChests = await ChestService.addChests(
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
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/chests/:walletAddress/open - Open/consume chests
  static async openChests(req, res) {
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

      const result = await ChestService.openChests(
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
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = ChestController;
