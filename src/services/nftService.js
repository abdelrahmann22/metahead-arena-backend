const NFT = require("../models/nft");
const User = require("../models/user");

/**
 * @fileoverview NFT Service
 * @description Service for managing NFT collection and calculating gameplay modifiers
 * @module services/nftService
 */

/**
 * NFT Service - Handles NFT management and gameplay modifier calculations
 * @class NFTService
 */
class NFTService {
  constructor() {
    // Game modifier constants for gameplay
    this.POWER_MODIFIER = 0.1; // 10% per power point
  }

  /**
   * Get game modifiers for NFT (for gameplay)
   */
  getGameModifiers(nft) {
    if (!nft) {
      return {
        jumpMultiplier: 1,
        superkickMultiplier: 1,
        speedMultiplier: 1,
        totalPowerScore: 0,
      };
    }

    return {
      jumpMultiplier: 1 + nft.power.jump * this.POWER_MODIFIER,
      superkickMultiplier: 1 + nft.power.superkick * this.POWER_MODIFIER,
      speedMultiplier: 1 + nft.power.speed * this.POWER_MODIFIER,
      totalPowerScore: nft.power.jump + nft.power.superkick + nft.power.speed,
    };
  }

  /**
   * Get all NFTs from database
   */
  async getAllNFTs() {
    try {
      const nfts = await NFT.find().sort({ tokenId: 1 }); // Sort by tokenId

      return { success: true, nfts: nfts };
    } catch (error) {
      console.error("Error getting all NFTs:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get single NFT by ID
   */
  async getNFTById(nftId) {
    try {
      const nft = await NFT.findById(nftId);

      if (!nft) {
        return { success: false, error: "NFT not found" };
      }

      return { success: true, nft: nft };
    } catch (error) {
      console.error("Error getting NFT by ID:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get NFT by tokenId
   */
  async getNFTByTokenId(tokenId) {
    try {
      const nft = await NFT.findOne({ tokenId: tokenId });

      if (!nft) {
        return { success: false, error: "NFT not found" };
      }

      return { success: true, nft: nft };
    } catch (error) {
      console.error("Error getting NFT by tokenId:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's NFTs (from User model)
   */
  async getUserNFTs(userId) {
    try {
      const user = await User.findById(userId).populate("nfts");

      if (!user) {
        return { success: false, error: "User not found" };
      }

      return { success: true, nfts: user.nfts };
    } catch (error) {
      console.error("Error getting user NFTs:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get specific user NFT by userId and nftId
   */
  async getUserNFT(userId, nftId) {
    try {
      const user = await User.findById(userId).populate("nfts");

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const nft = user.nfts.find((nft) => nft._id.toString() === nftId);

      if (!nft) {
        return { success: false, error: "NFT not found or not owned by user" };
      }

      return { success: true, nft: nft };
    } catch (error) {
      console.error("Error getting user NFT:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NFTService();
