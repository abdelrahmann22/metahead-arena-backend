const User = require("../models/user");

/**
 * @fileoverview Chest Management Service
 * @description Service for managing user chest inventory and reward distribution
 * @module services/chestService
 */

/**
 * Chest Service - Handles chest inventory and reward system
 * @class ChestService
 */
class ChestService {
  // Get user's chest counts
  static async getUserChests(walletAddress) {
    try {
      const user = await User.findOne({ walletAddress }).select("chests");
      if (!user) {
        throw new Error("User not found");
      }
      return user.chests;
    } catch (error) {
      throw new Error(`Failed to get user chests: ${error.message}`);
    }
  }

  // Add chests to user
  static async addChests(walletAddress, chestType, amount = 1) {
    try {
      const validChestTypes = ["common", "rare", "legendary"];
      if (!validChestTypes.includes(chestType)) {
        throw new Error(
          "Invalid chest type. Must be common, rare, or legendary"
        );
      }

      if (amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      const updateQuery = {};
      updateQuery[`chests.${chestType}`] = amount;

      const user = await User.findOneAndUpdate(
        { walletAddress },
        { $inc: updateQuery },
        { new: true, select: "chests" }
      );

      if (!user) {
        throw new Error("User not found");
      }

      return user.chests;
    } catch (error) {
      throw new Error(`Failed to add chests: ${error.message}`);
    }
  }

  // Open/consume chests
  static async openChests(walletAddress, chestType, amount = 1) {
    try {
      const validChestTypes = ["common", "rare", "legendary"];
      if (!validChestTypes.includes(chestType)) {
        throw new Error(
          "Invalid chest type. Must be common, rare, or legendary"
        );
      }

      if (amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // First check if user has enough chests
      const user = await User.findOne({ walletAddress }).select("chests");
      if (!user) {
        throw new Error("User not found");
      }

      if (user.chests[chestType] < amount) {
        throw new Error(
          `Insufficient ${chestType} chests. Available: ${user.chests[chestType]}, Required: ${amount}`
        );
      }

      // Deduct chests
      const updateQuery = {};
      updateQuery[`chests.${chestType}`] = -amount;

      const updatedUser = await User.findOneAndUpdate(
        { walletAddress },
        { $inc: updateQuery },
        { new: true, select: "chests" }
      );

      return {
        remainingChests: updatedUser.chests,
        openedChests: {
          type: chestType,
          amount: amount,
        },
      };
    } catch (error) {
      throw new Error(`Failed to open chests: ${error.message}`);
    }
  }
}

module.exports = ChestService;
