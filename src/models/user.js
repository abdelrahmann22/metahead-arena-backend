const mongoose = require("mongoose");

/**
 * User Model - Persistent Web3 User Accounts
 *
 * Purpose: Manages persistent user data and game statistics
 * Scope: MongoDB database, permanent storage
 * Lifespan: Permanent user accounts
 *
 * Features: Web3 wallet integration, NFT ownership, match history,
 *          game statistics, chest rewards
 *
 * Note: For temporary session data (Socket.IO), use Player model
 */
const userSchema = new mongoose.Schema(
  {
    // Web3 Identity (Primary)
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address format
    },

    // Optional Display Info
    username: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/,
      default: function () {
        // Generate default username from wallet address
        return `Player_${this.walletAddress.slice(-6)}`;
      },
    },

    // NFT Collection (References)
    nfts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NFT",
      },
    ],

    // Enhanced Game Statistics
    gameStats: {
      // Match References
      matchHistory: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Match",
        },
      ],

      // Win/Loss/Draw Counters
      wins: {
        type: Number,
        default: 0,
      },
      losses: {
        type: Number,
        default: 0,
      },
      draws: {
        type: Number,
        default: 0,
      },
      totalMatches: {
        type: Number,
        default: 0,
      },
    },

    // Chest System
    chests: {
      common: {
        type: Number,
        default: 0,
        min: 0,
      },
      rare: {
        type: Number,
        default: 0,
        min: 0,
      },
      legendary: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Account creation timestamp
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for performance
userSchema.index({ walletAddress: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
