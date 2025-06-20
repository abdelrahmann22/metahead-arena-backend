const mongoose = require("mongoose");

const connectDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully");
    console.log(`Database: ${mongoose.connection.name}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    console.log(
      "Server will continue without database (WebSocket functionality only)"
    );
    console.log(
      "To enable full functionality, start MongoDB and restart the server"
    );
  }
};

const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  } catch (error) {
    console.error("Error disconnecting from database:", error);
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
