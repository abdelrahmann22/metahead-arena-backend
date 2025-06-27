const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Import configurations
const { connectDatabase } = require("./config/database");
const { initializeSocket } = require("./config/socket");
const { specs, swaggerUi } = require("./config/swagger");

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
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5500",
          ],
    credentials: true, // Allow cookies in CORS
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // Add cookie parser for handling cookies

// Logging middleware
app.use(morgan("combined"));

// Static files
app.use(express.static("public"));

// Make io available to routes
app.set("io", io);

// Swagger API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Head Ball Game API Documentation",
  })
);

// Security headers for production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    // Prevent XSS
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // HTTPS enforcement
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );

    // Content Security Policy
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';"
    );

    next();
  });
}

// API Routes
app.use("/api", routes);

// Simple connection check
app.get("/", (req, res) => {
  res.json({
    message: "Connected",
    status: "Server is running",
    documentation: "Visit /api-docs for API documentation",
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
