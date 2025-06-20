const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Basic Identity
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/,
    },

    // Socket connection ID (for real-time gameplay)
    socketId: {
      type: String,
    },

    // Game Statistics
    gameStats: {
      level: {
        type: Number,
        default: 1,
      },
      experience: {
        type: Number,
        default: 0,
      },
      totalMatches: {
        type: Number,
        default: 0,
      },
      totalWins: {
        type: Number,
        default: 0,
      },
      totalLosses: {
        type: Number,
        default: 0,
      },
      totalGoals: {
        type: Number,
        default: 0,
      },
      totalPlayTime: {
        type: Number,
        default: 0, // in minutes
      },
      rankPoints: {
        type: Number,
        default: 1000, // Starting ELO
      },
    },

    // System fields
    isActive: {
      type: Boolean,
      default: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes only - no logic
userSchema.index({ socketId: 1 });
userSchema.index({ "gameStats.rankPoints": -1 });
userSchema.index({ isOnline: 1 });

module.exports = mongoose.model("User", userSchema);
