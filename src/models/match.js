const mongoose = require("mongoose");

/**
 * Match Model - Game Match Records
 *
 * Purpose: Stores completed match data for statistics and history
 * Scope: MongoDB database, permanent storage
 * Lifespan: Permanent match records
 *
 * Features: Player match data, scores, results, timestamps
 */
const matchSchema = new mongoose.Schema(
  {
    // Match Identity
    matchId: {
      type: String,
      required: true,
      unique: true, // This automatically creates a unique index
      default: function () {
        return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      },
    },

    // Players in the match
    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        position: {
          type: String,
          enum: ["player1", "player2"],
          required: true,
        },
        goals: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],

    // Match Result
    result: {
      winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null, // Null for draw
      },
      finalScore: {
        player1: {
          type: Number,
          default: 0,
          min: 0,
        },
        player2: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
      outcome: {
        type: String,
        enum: ["player1_wins", "player2_wins", "draw", "abandoned"],
        default: null, // Set when match ends
      },
      duration: {
        type: Number, // Duration in seconds
        default: null, // Set when match ends
        min: 0,
      },
    },

    // Match Status
    status: {
      type: String,
      enum: ["waiting", "playing", "finished", "abandoned"],
      default: "waiting",
    },

    // Timestamps
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Performance indexes (matchId already has unique: true)
matchSchema.index({ "players.user": 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ startedAt: -1 });

// Compound index for user match history queries
matchSchema.index({ "players.user": 1, startedAt: -1 });

module.exports = mongoose.model("Match", matchSchema);
