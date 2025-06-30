const Match = require("../models/match");
const User = require("../models/user");
const userService = require("./userService");

/**
 * @fileoverview Match Management Service
 * @description Service for managing game matches, results, and match history
 * @module services/matchService
 */

/**
 * Match Service - Handles match creation, management, and result processing
 * @class MatchService
 */
class MatchService {
  /**
   * Create new match (for Socket.IO)
   */
  async createMatch(player1Data, player2Data) {
    try {
      const match = new Match({
        players: [
          {
            user: player1Data.userId,
            position: "player1",
            goals: 0,
            walletAddress: player1Data.walletAddress,
          },
          {
            user: player2Data.userId,
            position: "player2",
            goals: 0,
            walletAddress: player2Data.walletAddress,
          },
        ],
        status: "waiting",
        // Initialize result with wallet addresses for easy access
        result: {
          player1WalletAddress: player1Data.walletAddress,
          player2WalletAddress: player2Data.walletAddress,
        },
      });

      await match.save();

      return { success: true, match: match };
    } catch (error) {
      console.error("Error creating match:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start match (for Socket.IO)
   */
  async startMatch(matchId) {
    try {
      const match = await Match.findById(matchId);
      if (!match) {
        return { success: false, error: "Match not found" };
      }

      match.status = "playing";
      match.startedAt = new Date();
      await match.save();

      return { success: true, match: match };
    } catch (error) {
      console.error("Error starting match:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * End match (for Socket.IO)
   */
  async endMatch(matchId, finalScore, duration, walletData = {}) {
    try {
      const match = await Match.findById(matchId).populate("players.user");

      if (!match) {
        return { success: false, error: "Match not found" };
      }

      // Update match result
      match.status = "finished";
      match.endedAt = new Date();
      match.result.finalScore = finalScore;
      match.result.duration = duration;

      // Get wallet addresses (use provided data or fallback to user data)
      const player1WalletAddress =
        walletData.player1WalletAddress || match.players[0].user.walletAddress;
      const player2WalletAddress =
        walletData.player2WalletAddress || match.players[1].user.walletAddress;

      // Store wallet addresses in result
      match.result.player1WalletAddress = player1WalletAddress;
      match.result.player2WalletAddress = player2WalletAddress;

      // Determine winner and outcome
      let winner = null;
      let winnerWalletAddress = null;
      let outcome = "draw";

      if (finalScore.player1 > finalScore.player2) {
        winner = match.players[0].user._id;
        winnerWalletAddress = player1WalletAddress;
        outcome = "player1_wins";
      } else if (finalScore.player2 > finalScore.player1) {
        winner = match.players[1].user._id;
        winnerWalletAddress = player2WalletAddress;
        outcome = "player2_wins";
      }

      match.result.winner = winner;
      match.result.winnerWalletAddress = winnerWalletAddress;
      match.result.outcome = outcome;

      // Update player goals in match
      match.players[0].goals = finalScore.player1;
      match.players[1].goals = finalScore.player2;

      await match.save();

      // Update user statistics
      await this.updateUserStatsAfterMatch(match);

      return { success: true, match: match };
    } catch (error) {
      console.error("Error ending match:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user statistics after match
   */
  async updateUserStatsAfterMatch(match) {
    try {
      for (let i = 0; i < match.players.length; i++) {
        const playerData = match.players[i];
        const user = playerData.user;

        let outcome = "draw";
        if (match.result.outcome === "player1_wins") {
          outcome = i === 0 ? "win" : "loss";
        } else if (match.result.outcome === "player2_wins") {
          outcome = i === 1 ? "win" : "loss";
        }

        const matchResult = {
          outcome: outcome,
        };

        // Update match stats
        await userService.updateUserMatchStats(user.walletAddress, matchResult);

        // Add match to user's history
        await User.findByIdAndUpdate(user._id, {
          $push: { "gameStats.matchHistory": match._id },
        });
      }
    } catch (error) {
      console.error("Error updating user stats after match:", error);
    }
  }

  /**
   * Get match by ID (for HTTP API)
   */
  async getMatchById(matchId) {
    try {
      const match = await Match.findById(matchId)
        .populate("players.user", "walletAddress")
        .populate("result.winner", "walletAddress");

      if (!match) {
        return { success: false, error: "Match not found" };
      }

      return { success: true, match: match };
    } catch (error) {
      console.error("Error getting match by ID:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user match history (for HTTP API)
   */
  async getUserMatchHistory(userId, limit = 10, page = 1) {
    try {
      const skip = (page - 1) * limit;

      const matches = await Match.find({ "players.user": userId })
        .populate("players.user", "walletAddress")
        .populate("result.winner", "walletAddress")
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalMatches = await Match.countDocuments({
        "players.user": userId,
      });

      return {
        success: true,
        matches: matches,
        pagination: {
          page: page,
          limit: limit,
          total: totalMatches,
          totalPages: Math.ceil(totalMatches / limit),
        },
      };
    } catch (error) {
      console.error("Error getting user match history:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get specific match for a specific user (for HTTP API)
   */
  async getUserSpecificMatch(userId, matchId) {
    try {
      const match = await Match.findOne({
        _id: matchId,
        "players.user": userId,
      })
        .populate("players.user", "walletAddress")
        .populate("result.winner", "walletAddress");

      if (!match) {
        return {
          success: false,
          error: "Match not found or user not in this match",
        };
      }

      // Find the user's player data in the match
      const userPlayer = match.players.find(
        (player) => player.user._id.toString() === userId
      );
      const opponentPlayer = match.players.find(
        (player) => player.user._id.toString() !== userId
      );

      // Determine user's outcome
      let userOutcome = "draw";
      if (match.result.winner) {
        if (match.result.winner._id.toString() === userId) {
          userOutcome = "win";
        } else {
          userOutcome = "loss";
        }
      }

      // Create user-specific match data
      const userMatchData = {
        match: match,
        userPlayer: userPlayer,
        opponent: opponentPlayer,
        userOutcome: userOutcome,
        userStats: {
          goals: userPlayer ? userPlayer.goals : 0,
          position: userPlayer ? userPlayer.position : null,
        },
        opponentStats: {
          goals: opponentPlayer ? opponentPlayer.goals : 0,
          position: opponentPlayer ? opponentPlayer.position : null,
          walletAddress: opponentPlayer
            ? opponentPlayer.user.walletAddress
            : "Unknown",
        },
      };

      return { success: true, data: userMatchData };
    } catch (error) {
      console.error("Error getting user specific match:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MatchService();
