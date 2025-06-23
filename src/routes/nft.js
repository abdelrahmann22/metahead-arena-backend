const express = require("express");
const nftController = require("../controllers/nftController");

const router = express.Router();

// GET /api/nfts - Get all NFTs
router.get("/", nftController.getAllNFTs);

// POST /api/nfts/seed - Create sample NFTs for testing (DEV ONLY)
router.post("/seed", nftController.seedSampleNFTs);

// GET /api/nfts/:nftId - Get NFT by database ID
router.get("/:nftId", nftController.getNFTById);

// GET /api/nfts/token/:tokenId - Get NFT by token ID (0-9)
router.get("/token/:tokenId", nftController.getNFTByTokenId);

// GET /api/nfts/:nftId/modifiers - Get NFT game modifiers
router.get("/:nftId/modifiers", nftController.getNFTGameModifiers);

// GET /api/nfts/user/:userId - Get user's NFTs
router.get("/user/:userId", nftController.getUserNFTs);

// GET /api/nfts/user/:userId/:nftId - Get specific user NFT
router.get("/user/:userId/:nftId", nftController.getUserNFT);

module.exports = router;
