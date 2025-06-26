const mongoose = require("mongoose");

/**
 * NFT Model - Game Character NFTs
 *
 * Purpose: Stores NFT metadata and game power attributes
 * Scope: MongoDB database, permanent storage
 * Lifespan: Permanent NFT records
 *
 * Features: Limited collection (0-9), power attributes for gameplay,
 *          IPFS metadata, game statistics tracking
 */
const nftSchema = new mongoose.Schema(
  {
    // Token Identity (0-9 limited collection)
    tokenId: {
      type: Number,
      required: true,
      min: 0,
      max: 9,
    },

    // NFT Metadata
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    // IPFS Storage
    ipfsUrl: {
      type: String,
      required: true,
      trim: true,
      match: /^https?:\/\/.+/, // Basic URL validation
    },

    // Game Power Attributes
    power: {
      // Jump Power (affects player jump height and strength)
      jump: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
        default: 5,
      },

      // Super Kick Power (affects ball shooting strength and power)
      superkick: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
        default: 5,
      },

      // Speed (affects player movement speed)
      speed: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
        default: 5,
      },

      // Total Power Score (for ranking/comparison)
      totalPower: {
        type: Number,
        default: function () {
          return this.power.jump + this.power.superkick + this.power.speed;
        },
        min: 3,
        max: 30,
      },
    },

    // Game Status
    isEquipped: {
      type: Boolean,
      default: false,
    },

    // Blockchain Data
    blockchainData: {
      txHash: {
        type: String,
        trim: true,
      },
      blockNumber: {
        type: Number,
        min: 0,
      },
      mintedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // Metadata
    description: {
      type: String,
      maxlength: 200,
      default: "",
      trim: true,
    },

    // Game Statistics
    stats: {
      gamesPlayed: {
        type: Number,
        default: 0,
        min: 0,
      },
      goalsScored: {
        type: Number,
        default: 0,
        min: 0,
      },
      matchesWon: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Performance indexes
nftSchema.index({ tokenId: 1 });
nftSchema.index({ "power.totalPower": -1 });

module.exports = mongoose.model("NFT", nftSchema);
