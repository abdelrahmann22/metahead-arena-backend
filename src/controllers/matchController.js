const matchService = require("../services/matchService");

/**
 * Get match by ID
 */
const getMatchById = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({
        success: false,
        message: "Match ID is required",
      });
    }

    const result = await matchService.getMatchById(matchId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "Match retrieved successfully",
      data: result.match,
    });
  } catch (error) {
    console.error("Error getting match by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get user match history
 */
const getUserMatchHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, page = 1 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);

    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be a number between 1 and 100",
      });
    }

    if (isNaN(pageNum) || pageNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive number",
      });
    }

    const result = await matchService.getUserMatchHistory(
      userId,
      limitNum,
      pageNum
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "User match history retrieved successfully",
      data: result.matches,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error getting user match history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get specific match for a specific user
 */
const getUserSpecificMatch = async (req, res) => {
  try {
    const { userId, matchId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!matchId) {
      return res.status(400).json({
        success: false,
        message: "Match ID is required",
      });
    }

    const result = await matchService.getUserSpecificMatch(userId, matchId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "User specific match retrieved successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error getting user specific match:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getMatchById,
  getUserMatchHistory,
  getUserSpecificMatch,
};
