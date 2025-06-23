const Match = require("../models/match");
const User = require("../models/user");
const userService = require("./userService");

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
            nft: player1Data.nftId || null,
            position: "player1",
            goals: 0,
          },
          {
            user: player2Data.userId,
            nft: player2Data.nftId || null,
            position: "player2",
            goals: 0,
          },
        ],
        status: "waiting",
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
  async endMatch(matchId, finalScore, duration) {
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

      // Determine winner and outcome
      let winner = null;
      let outcome = "draw";

      if (finalScore.player1 > finalScore.player2) {
        winner = match.players[0].user._id;
        outcome = "player1_wins";
      } else if (finalScore.player2 > finalScore.player1) {
        winner = match.players[1].user._id;
        outcome = "player2_wins";
      }

      match.result.winner = winner;
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
        await userService.updateUserMatchStats(user._id, matchResult);

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
        .populate("players.user", "username walletAddress")
        .populate("players.nft", "name power")
        .populate("result.winner", "username walletAddress");

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
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("players.user", "username walletAddress")
        .populate("players.nft", "name power")
        .populate("result.winner", "username walletAddress");

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
}

module.exports = new MatchService();
