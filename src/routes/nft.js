const express = require("express");
const nftController = require("../controllers/nftController");

const router = express.Router();

/**
 * @fileoverview NFT Management Routes
 * @description RESTful API routes for NFT collection and gameplay modifier management
 * @module routes/nft
 */

/**
 * @swagger
 * /api/nfts:
 *   get:
 *     summary: Get all NFTs
 *     tags: [NFTs]
 *     responses:
 *       200:
 *         description: List of all NFTs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   tokenId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   imageUrl:
 *                     type: string
 *                   attributes:
 *                     type: array
 *                     items:
 *                       type: object
 *                   gameModifiers:
 *                     type: object
 */
/**
 * GET /api/nfts
 * Retrieve all available NFTs in the collection
 */
router.get("/", nftController.getAllNFTs);

/**
 * @swagger
 * /api/nfts/{nftId}:
 *   get:
 *     summary: Get NFT by database ID
 *     tags: [NFTs]
 *     parameters:
 *       - in: path
 *         name: nftId
 *         required: true
 *         schema:
 *           type: string
 *         description: NFT database ID
 *     responses:
 *       200:
 *         description: NFT details retrieved
 *       404:
 *         description: NFT not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/nfts/:nftId
 * Retrieve specific NFT details by database ID
 */
router.get("/:nftId", nftController.getNFTById);

/**
 * @swagger
 * /api/nfts/token/{tokenId}:
 *   get:
 *     summary: Get NFT by token ID (0-9)
 *     tags: [NFTs]
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: NFT token ID (0-9)
 *     responses:
 *       200:
 *         description: NFT details retrieved
 *       404:
 *         description: NFT not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/nfts/token/:tokenId
 * Retrieve NFT details by blockchain token ID (0-9)
 */
router.get("/token/:tokenId", nftController.getNFTByTokenId);

/**
 * @swagger
 * /api/nfts/{nftId}/modifiers:
 *   get:
 *     summary: Get NFT game modifiers
 *     tags: [NFTs]
 *     parameters:
 *       - in: path
 *         name: nftId
 *         required: true
 *         schema:
 *           type: string
 *         description: NFT database ID
 *     responses:
 *       200:
 *         description: NFT game modifiers retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 speed:
 *                   type: number
 *                   description: Speed modifier
 *                 power:
 *                   type: number
 *                   description: Power modifier
 *                 agility:
 *                   type: number
 *                   description: Agility modifier
 *       404:
 *         description: NFT not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/nfts/:nftId/modifiers
 * Retrieve gameplay modifiers for specific NFT
 */
router.get("/:nftId/modifiers", nftController.getNFTGameModifiers);

/**
 * @swagger
 * /api/nfts/user/{userId}:
 *   get:
 *     summary: Get user's NFTs
 *     tags: [NFTs]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's database ID
 *     responses:
 *       200:
 *         description: User's NFTs retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/nfts/user/:userId
 * Retrieve all NFTs owned by specific user
 */
router.get("/user/:userId", nftController.getUserNFTs);

/**
 * @swagger
 * /api/nfts/user/{userId}/{nftId}:
 *   get:
 *     summary: Get specific user NFT
 *     tags: [NFTs]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's database ID
 *       - in: path
 *         name: nftId
 *         required: true
 *         schema:
 *           type: string
 *         description: NFT database ID
 *     responses:
 *       200:
 *         description: User's specific NFT retrieved
 *       404:
 *         description: User or NFT not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/nfts/user/:userId/:nftId
 * Retrieve specific NFT from user's collection
 */
router.get("/user/:userId/:nftId", nftController.getUserNFT);

module.exports = router;
