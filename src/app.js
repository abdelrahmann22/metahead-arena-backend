const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
require("dotenv").config();

// Import configurations
const { connectDatabase } = require("./config/database");
const { initializeSocket } = require("./config/socket");

// Import routes
const routes = require("./routes");

const app = express();
const server = http.createServer(app);

// Connect to database first
connectDatabase();

// Initialize Socket.IO for real-time game functionality
const io = initializeSocket(server);

// Security middleware
// app.use(
//   helmet({
//     contentSecurityPolicy: false, // Disabled for WebSocket compatibility
//   })
// );

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api", limiter);

// CORS configuration
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use(morgan("combined"));

// Static files
app.use(express.static("public"));

// Make io available to routes
app.set("io", io);

// API Routes
app.use("/api", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Welcome endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Head Ball Real-Time Game API",
    version: "1.0.0",
    documentation: "/api",
    websocket: "Socket.IO enabled for real-time gameplay",
    endpoints: {
      health: "/health",
      api: "/api - General API info, players, rooms, stats",
      game: "/api/game - Real-time game management",
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
});

module.exports = server;
