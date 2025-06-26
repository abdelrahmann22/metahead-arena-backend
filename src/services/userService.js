const User = require("../models/user");
const NFT = require("../models/nft");

/**
 * @fileoverview User Management Service
 * @description Service for managing Web3 user accounts, authentication, and NFT integration
 * @module services/userService
 */

/**
 * User Service - Handles Web3 user management and NFT operations
 * @class UserService
 */
class UserService {
  /**
   * Create user from wallet address (wagmi integration)
   */
  async createUserFromWallet(walletAddress) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        walletAddress: walletAddress.toLowerCase(),
      });
      if (existingUser) {
        return { success: true, user: existingUser, isNewUser: false };
      }

      // Create new user
      const newUser = new User({
        walletAddress: walletAddress.toLowerCase(),
      });

      await newUser.save();

      return {
        success: true,
        user: newUser,
        isNewUser: true,
      };
    } catch (error) {
      console.error("Error creating user from wallet:", error);
      // Handle duplicate key error on email (old schema remnant)
      if (error.code === 11000 && error.message.includes("email_1")) {
        return {
          success: false,
          error:
            "Database schema conflict detected. Please contact support to clean up old indexes.",
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update user match statistics
   */
  async updateUserMatchStats(userId, matchResult) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Update match counters
      user.gameStats.totalMatches += 1;

      switch (matchResult.outcome) {
        case "win":
          user.gameStats.wins += 1;
          break;
        case "loss":
          user.gameStats.losses += 1;
          break;
        case "draw":
          user.gameStats.draws += 1;
          break;
      }

      await user.save();

      return { success: true, user: user };
    } catch (error) {
      console.error("Error updating user match stats:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find user by wallet address
   */
  async findUserByWallet(walletAddress) {
    try {
      const user = await User.findOne({
        walletAddress: walletAddress.toLowerCase(),
      })
        .populate("equippedNFT")
        .populate("nfts");

      return { success: true, user: user };
    } catch (error) {
      console.error("Error finding user by wallet:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Equip NFT for user
   */
  async equipNFT(userId, nftId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Check if NFT exists
      const nft = await NFT.findById(nftId);
      if (!nft) {
        return { success: false, error: "NFT not found" };
      }

      // Check if user owns this NFT
      if (!user.nfts.includes(nftId)) {
        return { success: false, error: "User does not own this NFT" };
      }

      // Equip the NFT
      user.equippedNFT = nftId;
      await user.save();

      // Populate the equipped NFT for response
      await user.populate("equippedNFT");

      return {
        success: true,
        user: user,
        equippedNFT: user.equippedNFT,
      };
    } catch (error) {
      console.error("Error equipping NFT:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unequip NFT for user
   */
  async unequipNFT(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      const previouslyEquipped = user.equippedNFT;
      user.equippedNFT = null;
      await user.save();

      return {
        success: true,
        user: user,
        previouslyEquipped: previouslyEquipped,
      };
    } catch (error) {
      console.error("Error unequipping NFT:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's equipped NFT with game modifiers
   */
  async getUserEquippedNFT(userId) {
    try {
      const user = await User.findById(userId).populate("equippedNFT");
      if (!user) {
        return { success: false, error: "User not found" };
      }

      if (!user.equippedNFT) {
        return {
          success: true,
          equippedNFT: null,
          modifiers: null,
        };
      }

      // Calculate game modifiers using NFT service
      const nftService = require("./nftService");
      const modifiers = nftService.getGameModifiers(user.equippedNFT);

      return {
        success: true,
        equippedNFT: user.equippedNFT,
        modifiers: modifiers,
      };
    } catch (error) {
      console.error("Error getting user equipped NFT:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add NFT to user's collection
   */
  async addNFTToUser(userId, nftId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Check if NFT exists
      const nft = await NFT.findById(nftId);
      if (!nft) {
        return { success: false, error: "NFT not found" };
      }

      // Check if user already owns this NFT
      if (user.nfts.includes(nftId)) {
        return { success: false, error: "User already owns this NFT" };
      }

      // Add NFT to user's collection
      user.nfts.push(nftId);
      await user.save();

      return { success: true, user: user };
    } catch (error) {
      console.error("Error adding NFT to user:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new UserService();
