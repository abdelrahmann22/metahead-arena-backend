const User = require("../models/user");

/**
 * @fileoverview User Management Service
 * @description Service for managing Web3 user accounts and authentication
 * @module services/userService
 */

/**
 * User Service - Handles Web3 user management operations
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
        walletAddress: walletAddress,
      });
      console.log(user);
      return { success: true, user: user };
    } catch (error) {
      console.error("Error finding user by wallet:", error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Find user by wallet address
   */
  async findUserById(id) {
    try {
      const user = await User.findById(id);
      console.log(user);
      return { success: true, user: user };
    } catch (error) {
      console.error("Error finding user by wallet:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new UserService();
