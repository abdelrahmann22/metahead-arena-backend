const nftService = require("../services/nftService");

/**
 * Get all NFTs
 * @route GET /api/nfts
 */
const getAllNFTs = async (req, res) => {
  try {
    const result = await nftService.getAllNFTs();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "All NFTs retrieved successfully",
      data: result.nfts,
    });
  } catch (error) {
    console.error("Error getting all NFTs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get NFT by ID
 * @route GET /api/nfts/:nftId
 * @param {string} nftId - NFT ID
 */
const getNFTById = async (req, res) => {
  try {
    const { nftId } = req.params;

    if (!nftId) {
      return res.status(400).json({
        success: false,
        message: "NFT ID is required",
      });
    }

    const result = await nftService.getNFTById(nftId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "NFT retrieved successfully",
      data: result.nft,
    });
  } catch (error) {
    console.error("Error getting NFT by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get NFT by token ID
 * @route GET /api/nfts/token/:tokenId
 * @param {number} tokenId - Token ID (0-9)
 */
const getNFTByTokenId = async (req, res) => {
  try {
    const { tokenId } = req.params;

    if (tokenId === undefined || tokenId === null) {
      return res.status(400).json({
        success: false,
        message: "Token ID is required",
      });
    }

    const tokenIdNum = parseInt(tokenId);
    if (isNaN(tokenIdNum) || tokenIdNum < 0 || tokenIdNum > 9) {
      return res.status(400).json({
        success: false,
        message: "Token ID must be a number between 0 and 9",
      });
    }

    const result = await nftService.getNFTByTokenId(tokenIdNum);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "NFT retrieved successfully",
      data: result.nft,
    });
  } catch (error) {
    console.error("Error getting NFT by token ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get user's NFTs
 * @route GET /api/nfts/user/:userId
 * @param {string} userId - User ID
 */
const getUserNFTs = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = await nftService.getUserNFTs(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "User NFTs retrieved successfully",
      data: result.nfts,
    });
  } catch (error) {
    console.error("Error getting user NFTs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get specific user NFT
 * @route GET /api/nfts/user/:userId/nft/:nftId
 * @param {string} userId - User ID
 * @param {string} nftId - NFT ID
 */
const getUserNFT = async (req, res) => {
  try {
    const { userId, nftId } = req.params;

    if (!userId || !nftId) {
      return res.status(400).json({
        success: false,
        message: "User ID and NFT ID are required",
      });
    }

    const result = await nftService.getUserNFT(userId, nftId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "User NFT retrieved successfully",
      data: result.nft,
    });
  } catch (error) {
    console.error("Error getting user NFT:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get NFT game modifiers (for gameplay)
 * @route GET /api/nfts/:nftId/modifiers
 * @param {string} nftId - NFT ID
 */
const getNFTGameModifiers = async (req, res) => {
  try {
    const { nftId } = req.params;

    if (!nftId) {
      return res.status(400).json({
        success: false,
        message: "NFT ID is required",
      });
    }

    // First get the NFT
    const nftResult = await nftService.getNFTById(nftId);

    if (!nftResult.success) {
      return res.status(404).json({
        success: false,
        message: "NFT not found",
      });
    }

    // Calculate game modifiers
    const modifiers = nftService.getGameModifiers(nftResult.nft);

    res.json({
      success: true,
      message: "NFT game modifiers calculated successfully",
      data: {
        nft: nftResult.nft,
        modifiers: modifiers,
      },
    });
  } catch (error) {
    console.error("Error getting NFT game modifiers:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAllNFTs,
  getNFTById,
  getNFTByTokenId,
  getUserNFTs,
  getUserNFT,
  getNFTGameModifiers,
};
