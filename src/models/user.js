const mongoose = require("mongoose");

/**
 * User Model - Persistent Web3 User Accounts
 *
 * Purpose: Manages persistent user data and game statistics
 * Scope: MongoDB database, permanent storage
 * Lifespan: Permanent user accounts
 *
 * Features: Web3 wallet integration, match history,
 *          game statistics
 *
 * Note: For temporary session data (Socket.IO), use Player model
 */
const userSchema = new mongoose.Schema(
  {
    // Web3 Identity (Primary)
    walletAddress: {
      type: String,
      required: true,
      unique: true, // This automatically creates a unique index
      lowercase: true,
      trim: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address format
    },

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
        min: 0,
      },
      losses: {
        type: Number,
        default: 0,
        min: 0,
      },
      draws: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalMatches: {
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

// Note: walletAddress already has unique: true, so no need for explicit index

module.exports = mongoose.model("User", userSchema);
